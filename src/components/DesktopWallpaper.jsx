import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownTrayIcon, ArrowsPointingOutIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { ArrowLeftIcon, ArrowPathIcon, FaceSmileIcon, HandRaisedIcon, MagnifyingGlassPlusIcon, MinusIcon, PlusIcon, QuestionMarkCircleIcon, ViewfinderCircleIcon } from '@heroicons/react/24/outline'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { playSfx } from '../lib/sfx.js'
import ColorWell from './ColorWell.jsx'
import { WALLPAPER_H, WALLPAPER_W, WALLPAPER_W_POCA_MEMORIA, wallpaperEstado as est } from '../lib/wallpaperEscritorio.js'
import { dibujarTexto, FUENTE_TEXTO } from '../lib/wallpaperTexto.js'
import { STICKERS } from '../lib/wallpaperStickers.js'

// El marco del wallpaper de escritorio, encima de Skulley aislado (se abre desde
// Customize). Tiene la proporción del archivo y lo que cae adentro es lo que sale.
// Crear hace el archivo y Guardar lo baja, y cualquier cambio después de Crear lo
// tira, igual que en el teléfono. La escena hace lo demás (home/WallpaperEscena.jsx).
//
// La interfaz emula un software de diseño en cápsulas flotantes (pedido de Oscar):
// herramientas a la izquierda, archivo arriba y, abajo al centro, los ajustes de la
// herramienta elegida. Van en la franja oscura: nada tapa lo que sale en el archivo.
// Con cualquier herramienta la rueda acerca hacia el cursor, y el botón derecho o
// Mayús mueven el cuadro.
//
// El texto gigante, en la tipografía de la marquesina, lo pinta la trama detrás de
// Skulley; los stickers se arrastran, giran y escalan encima de todo. Los dos se
// quedan aunque cierres el marco.
const PLANOS = [
  { id: 'cuerpo', label: 'customizer.wallBody' },
  { id: 'cara', label: 'customizer.wallFace' },
]
const GIRO_POR_PX = 0.0105
const ZOOM_MAX = 5
const RUEDA = 0.0015
// La franja libre alrededor del marco: lo que ocupan las cápsulas con su aire.
const FRANJA = 76
const ZOOM_PASO = 1.4
const TEXTO_MAX = 40
const STICKERS_MAX = 12
const STICKER_ANCHO = 0.2
const ANCHO_MIN = 0.04
const ANCHO_MAX = 0.9

// Los gestos del escenario. Texto, Stickers y Fondo dejan girar a Skulley.
const HERRAMIENTAS = [
  { id: 'rota', tecla: 'R', label: 'customizer.wallToolRotate', Icono: ArrowPathIcon },
  { id: 'mano', tecla: 'H', label: 'customizer.wallToolMove', Icono: HandRaisedIcon },
  { id: 'zoom', tecla: 'Z', label: 'customizer.wallToolZoom', Icono: MagnifyingGlassPlusIcon },
  { sep: true },
  { id: 'texto', tecla: 'T', label: 'customizer.wallText' },
  ...(STICKERS.length ? [{ id: 'stickers', tecla: 'S', label: 'customizer.wallStickers', Icono: FaceSmileIcon }] : []),
  { sep: true },
  { id: 'fondo', tecla: 'F', label: 'customizer.wallBg' },
]

// El tutorial: sale la primera vez que se entra al marco y se repite con el botón
// de ayuda. Va señalando cada cápsula con un aro que se mueve de una a otra, y
// enciende la herramienta de la que habla para que se vea su cápsula de abajo.
const GUIA_KEY = 'skulley_wallpaper_guia'
const GUIA_ANCHO = 300
const GUIA_AIRE = 16
const GUIA_PASOS = [
  { selector: '.dwp-cap--riel', lado: 'derecha', herramienta: 'rota', texto: 'customizer.wallGuideTools' },
  { selector: '.dwp-marco', lado: 'dentro', herramienta: 'rota', texto: 'customizer.wallGuideMouse', raton: true },
  { selector: '.dwp-cap--ajustes', lado: 'arriba', herramienta: 'texto', texto: 'customizer.wallGuideText' },
  ...(STICKERS.length ? [{ selector: '.dwp-cap--ajustes', lado: 'arriba', herramienta: 'stickers', texto: 'customizer.wallGuideStickers' }] : []),
  { selector: '.dwp-cap--ajustes', lado: 'arriba', herramienta: 'fondo', texto: 'customizer.wallGuideBg' },
  { selector: '.dwp-boton', lado: 'abajo', herramienta: 'rota', texto: 'customizer.wallGuideCreate' },
]

const RATON = [
  { parte: 'izq', texto: 'customizer.wallMouseLeft' },
  { parte: 'rueda', texto: 'customizer.wallMouseWheel' },
  { parte: 'der', texto: 'customizer.wallMouseRight' },
]

// Un mouse con la parte de la que se habla encendida.
function Raton({ parte }) {
  const on = (p) => (parte === p ? '#e600ff' : 'none')
  return (
    <svg className="dwp-raton" width="26" height="35" viewBox="0 0 24 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-10 10v3h10V2Z" fill={on('izq')} />
      <path d="M12 2a10 10 0 0 1 10 10v3H12V2Z" fill={on('der')} />
      <path d="M2 15v5a10 10 0 0 0 20 0v-5" />
      <rect x="10.5" y="5.5" width="3" height="7" rx="1.5" fill={parte === 'rueda' ? '#e600ff' : '#0d0714'} />
    </svg>
  )
}

const anchoPedido = () => ((navigator.deviceMemory || 8) <= 4 ? WALLPAPER_W_POCA_MEMORIA : WALLPAPER_W)
const altoDe = (w) => Math.floor((w * WALLPAPER_H) / WALLPAPER_W)
const dosCuadros = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// La tira de stickers se desvanece solo del lado donde hay más.
const marcarBordes = (el) => {
  if (!el) return
  el.classList.toggle('hay-izq', el.scrollLeft > 1)
  el.classList.toggle('hay-der', el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
}

// Con mouse la rueda solo va en vertical; aquí la tira corre de lado.
const onTiraWheel = (e) => {
  if (!e.deltaX) e.currentTarget.scrollLeft += e.deltaY
}

function capturar({ ancho, fondo, stickers }) {
  return new Promise((resolve, reject) => {
    let reloj = 0
    const pedido = {
      ancho,
      fondo,
      stickers,
      fase: 'pedida',
      resolve: (blob) => { clearTimeout(reloj); resolve({ blob, w: pedido.w, h: pedido.h }) },
      reject: (e) => { clearTimeout(reloj); reject(e) },
    }
    reloj = setTimeout(() => {
      if (est.captura === pedido) est.captura = null
      reject(new Error('timeout'))
    }, 30000)
    est.captura = pedido
  })
}

export default function DesktopWallpaper({ lista = false, onSalir, fondo, onFondo }) {
  const { t } = useLanguage()
  const marcoRef = useRef(null)
  const textoRef = useRef(null)
  const [plano, setPlano] = useState('cuerpo')
  const [creando, setCreando] = useState(false)
  const [archivo, setArchivo] = useState(null)
  const [fallo, setFallo] = useState(false)
  const [herramienta, setHerramienta] = useState('rota')
  const [zoomPct, setZoomPct] = useState(100)
  const [paso, setPaso] = useState(null)
  const [guiaCaja, setGuiaCaja] = useState(null)
  const guiaRef = useRef(null)
  const [texto, setTexto] = useState('')
  const [colorTexto, setColorTexto] = useState('#ffffff')
  const [pegados, setPegados] = useState([])
  const [elegido, setElegido] = useState(null)
  const siguiente = useRef(0)
  const imagenes = useRef(new Map())
  const sesion = useRef(0)
  const archivoRef = useRef(null)
  const planoRef = useRef('cuerpo')
  const gesto = useRef(null)

  const marcarPlano = (id) => {
    if (planoRef.current === id) return
    planoRef.current = id
    setPlano(id)
  }

  const tirarArchivo = () => {
    est.quieto = false
    if (!archivoRef.current) return
    archivoRef.current = null
    setArchivo(null)
  }

  const cambio = () => {
    tirarArchivo()
    setFallo(false)
  }

  // El marco: lo más grande que quepa con la proporción del archivo, dentro de la
  // franja de las cápsulas. El corrimiento y el zoom se miden contra la pantalla, así
  // que el marco puede cambiar de tamaño sin mover lo que se ve.
  useEffect(() => {
    const medir = () => {
      const marco = marcoRef.current
      if (!marco) return
      const W = window.innerWidth
      const H = window.innerHeight
      const proporcion = WALLPAPER_W / WALLPAPER_H
      const h = Math.max(1, Math.min(H - FRANJA * 2, (W - FRANJA * 2) / proporcion))
      const w = h * proporcion
      const x = (W - w) / 2
      const y = (H - h) / 2
      marco.style.width = `${w}px`
      marco.style.height = `${h}px`
      marco.style.left = `${x}px`
      marco.style.top = `${y}px`
      est.marco = { x, y, w, h }
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])

  // El texto se dibuja en un lienzo del tamaño del archivo; la trama lo toma de ahí.
  useEffect(() => {
    let vivo = true
    const pinta = () => {
      if (!vivo) return
      if (!est.capaLienzo) {
        const c = document.createElement('canvas')
        c.width = WALLPAPER_W
        c.height = WALLPAPER_H
        est.capaLienzo = c
      }
      dibujarTexto(est.capaLienzo, texto, colorTexto)
      est.capaHay = texto.trim().length > 0
      est.capaVersion += 1
    }
    const cargando = document.fonts?.load?.(`200px ${FUENTE_TEXTO}`, 'SKULLEY')
    if (cargando) cargando.then(pinta, pinta)
    else pinta()
    return () => { vivo = false }
  }, [texto, colorTexto])

  // Cada imagen se carga al pegarla: precargarlas todas pesaría a cada visita a
  // Customize, y pueden ser muchas.
  const cargarImagen = (s) => {
    if (imagenes.current.has(s.id)) return
    const img = new Image()
    img.src = s.src
    imagenes.current.set(s.id, img)
  }

  useEffect(() => {
    if (!lista) return undefined
    const onKey = (e) => {
      if (paso !== null) {
        if (e.key === 'Escape') cerrarGuia()
        if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); sigueGuia() }
        return
      }
      // Escribiendo, las letras son texto y Escape solo suelta el campo.
      if (e.target?.tagName === 'INPUT') {
        if (e.key === 'Escape') e.target.blur()
        return
      }
      if (e.key === 'Escape') { onSalir?.(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && elegido !== null) { quitarPegado(elegido); return }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.toUpperCase() === 'C') { e.preventDefault(); centrar(); return }
      const h = HERRAMIENTAS.find((x) => x.tecla === e.key.toUpperCase())
      if (h) { e.preventDefault(); setHerramienta(h.id) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista, onSalir, elegido, paso])

  useEffect(() => {
    if (lista && herramienta === 'texto' && paso === null) textoRef.current?.focus({ preventScroll: true })
  }, [lista, herramienta, paso])

  // La primera vez, cuando las cápsulas ya llegaron.
  useEffect(() => {
    if (!lista) { setPaso(null); return undefined }
    let vista = false
    try { vista = localStorage.getItem(GUIA_KEY) === '1' } catch { }
    if (vista) return undefined
    const id = setTimeout(() => abrirGuia(), 800)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista])

  // Dónde va el aro y dónde la tarjeta. Se mide después de encender la herramienta:
  // la cápsula de abajo cambia de ancho con ella.
  useLayoutEffect(() => {
    if (paso === null) return undefined
    const medir = () => {
      const p = GUIA_PASOS[paso]
      const el = document.querySelector(`.dwp ${p.selector}`)
      const tarjeta = guiaRef.current
      if (!el || !tarjeta) return
      const r = el.getBoundingClientRect()
      const alto = tarjeta.offsetHeight
      const W = window.innerWidth
      const H = window.innerHeight
      let x = r.left + r.width / 2 - GUIA_ANCHO / 2
      let y = r.top - alto - GUIA_AIRE
      if (p.lado === 'derecha') { x = r.right + GUIA_AIRE; y = r.top + r.height / 2 - alto / 2 }
      if (p.lado === 'abajo') { x = r.right - GUIA_ANCHO; y = r.bottom + GUIA_AIRE }
      if (p.lado === 'dentro') { x = r.left + GUIA_AIRE * 2; y = r.top + r.height / 2 - alto / 2 }
      setGuiaCaja({
        aro: { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 },
        tarjeta: { left: clamp(x, GUIA_AIRE, W - GUIA_ANCHO - GUIA_AIRE), top: clamp(y, GUIA_AIRE, H - alto - GUIA_AIRE) },
      })
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [paso, herramienta])

  // Al salir se deja todo como estaba para la siguiente vez.
  useEffect(() => {
    if (lista) return
    sesion.current += 1
    archivoRef.current = null
    setArchivo(null)
    setFallo(false)
    setCreando(false)
    setZoomPct(100)
    planoRef.current = 'cuerpo'
    setPlano('cuerpo')
  }, [lista])

  const abrirGuia = () => {
    setElegido(null)
    setHerramienta(GUIA_PASOS[0].herramienta)
    setPaso(0)
  }

  const cerrarGuia = () => {
    setPaso(null)
    setGuiaCaja(null)
    setHerramienta('rota')
    try { localStorage.setItem(GUIA_KEY, '1') } catch { }
  }

  const sigueGuia = () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    if (paso >= GUIA_PASOS.length - 1) { cerrarGuia(); return }
    setHerramienta(GUIA_PASOS[paso + 1].herramienta)
    setPaso(paso + 1)
  }

  const limitar = () => {
    const m = est.marco
    if (!m) return
    const maxX = (m.w / 2) * est.zoom
    const maxY = (m.h / 2) * est.zoom
    est.ox = clamp(est.ox, -maxX, maxX)
    est.oy = clamp(est.oy, -maxY, maxY)
  }

  // Zoom a `z` dejando el punto de pantalla (x, y) donde está.
  const acercar = (z, x, y) => {
    const z0 = est.zoom
    const z1 = clamp(z, 1, ZOOM_MAX)
    if (z1 === z0) return
    const m = est.marco
    const cx = window.innerWidth / 2
    const cy = m ? m.y + m.h / 2 : window.innerHeight / 2
    const k = z1 / z0
    est.ox = (est.ox + x - cx) * k - (x - cx)
    est.oy = (est.oy + y - cy) * k - (y - cy)
    est.zoom = z1
    if (z1 === 1) { est.ox = 0; est.oy = 0 }
    limitar()
    marcarPlano(z1 === 1 ? 'cuerpo' : null)
    setZoomPct(Math.round(z1 * 100))
    cambio()
  }

  const acercarAlCentro = (k) => {
    const m = est.marco
    acercar(est.zoom * k, window.innerWidth / 2, m ? m.y + m.h / 2 : window.innerHeight / 2)
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  // Regresa a Skulley al centro del marco, con el zoom y el giro que traiga.
  const centrar = () => {
    if (creando) return
    est.centrar = true
    if (est.zoom === 1) marcarPlano('cuerpo')
    else marcarPlano(null)
    cambio()
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  const onDown = (e) => {
    if (creando) return
    est.centrar = false
    setElegido(null)
    const mover = e.button !== 0 || e.shiftKey || herramienta === 'mano'
    gesto.current = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, mover, zoom: !mover && herramienta === 'zoom' }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.classList.add('is-arrastrando')
  }
  const onMove = (e) => {
    const g = gesto.current
    if (!g || g.zoom) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    g.x = e.clientX
    g.y = e.clientY
    if (!dx && !dy) return
    if (g.mover) {
      est.ox -= dx
      est.oy -= dy
      limitar()
      marcarPlano(null)
    } else {
      est.giro += dx * GIRO_POR_PX
    }
    cambio()
  }
  const onUp = (e) => {
    const g = gesto.current
    gesto.current = null
    e.currentTarget.classList.remove('is-arrastrando')
    // Con Zoom un clic acerca y Alt + clic aleja, como en un programa de diseño.
    if (g?.zoom && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 5) {
      acercar(est.zoom * (e.altKey ? 1 / ZOOM_PASO : ZOOM_PASO), e.clientX, e.clientY)
    }
  }
  const onWheel = (e) => {
    if (creando) return
    acercar(est.zoom * Math.exp(-e.deltaY * RUEDA), e.clientX, e.clientY)
  }

  const elegirPlano = (id) => {
    if (planoRef.current === id) return
    est.plano = id
    marcarPlano(id)
    tirarArchivo()
    setFallo(false)
    // El zoom lo decide la escena en su siguiente cuadro.
    dosCuadros().then(() => setZoomPct(Math.round(est.zoom * 100)))
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  const elegirFondo = (hex) => {
    onFondo?.(hex)
    tirarArchivo()
    setFallo(false)
  }

  const elegirTexto = (v) => {
    setTexto(v.slice(0, TEXTO_MAX))
    tirarArchivo()
    setFallo(false)
  }

  const elegirColorTexto = (hex) => {
    setColorTexto(hex)
    tirarArchivo()
    setFallo(false)
  }

  const pegar = (s) => {
    if (pegados.length >= STICKERS_MAX) return
    cargarImagen(s)
    const n = siguiente.current
    siguiente.current += 1
    // Cada uno cae un poco al lado del anterior, para que no se tapen.
    const paso = n % 5
    setPegados((l) => [...l, { n, id: s.id, src: s.src, x: 0.5 + 0.06 * (paso - 2), y: 0.5 + 0.05 * (paso - 2), s: STICKER_ANCHO, r: 0 }])
    setElegido(n)
    cambio()
    try { playSfx('click', { volume: 1.0 }) } catch { }
  }

  const moverPegado = (n, cambios) => {
    setPegados((l) => l.map((p) => (p.n === n ? { ...p, ...cambios } : p)))
    cambio()
  }

  const quitarPegado = (n) => {
    setPegados((l) => l.filter((p) => p.n !== n))
    setElegido(null)
    cambio()
  }

  // Arrastrar un sticker: lo mueve; el tirador de la esquina lo gira y lo escala
  // alrededor de su centro. Todo en fracciones del marco.
  const onStickerDown = (e, p, tirador) => {
    e.stopPropagation()
    e.preventDefault()
    setElegido(p.n)
    const m = est.marco
    if (!m) return
    const centro = { x: m.x + p.x * m.w, y: m.y + p.y * m.h }
    const inicio = { d: Math.hypot(e.clientX - centro.x, e.clientY - centro.y), a: Math.atan2(e.clientY - centro.y, e.clientX - centro.x), s: p.s, r: p.r, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY }
    const mueve = (ev) => {
      if (tirador) {
        const d = Math.hypot(ev.clientX - centro.x, ev.clientY - centro.y)
        const a = Math.atan2(ev.clientY - centro.y, ev.clientX - centro.x)
        moverPegado(p.n, { s: clamp(inicio.s * (d / Math.max(1, inicio.d)), ANCHO_MIN, ANCHO_MAX), r: inicio.r + (a - inicio.a) })
      } else {
        moverPegado(p.n, { x: clamp(inicio.x + (ev.clientX - inicio.cx) / m.w, 0, 1), y: clamp(inicio.y + (ev.clientY - inicio.cy) / m.h, 0, 1) })
      }
    }
    const suelta = () => {
      window.removeEventListener('pointermove', mueve)
      window.removeEventListener('pointerup', suelta)
    }
    window.addEventListener('pointermove', mueve)
    window.addEventListener('pointerup', suelta)
  }

  const onStickerWheel = (e, p) => {
    e.stopPropagation()
    moverPegado(p.n, { s: clamp(p.s * Math.exp(-e.deltaY * RUEDA), ANCHO_MIN, ANCHO_MAX) })
  }

  const crear = async () => {
    if (creando) return
    setElegido(null)
    // Lo que se ve es lo que sale, y se queda así hasta que cambies algo.
    est.giroVisto = est.giro
    est.quieto = true
    sesion.current += 1
    const s = sesion.current
    setFallo(false)
    setCreando(true)
    await dosCuadros()
    try {
      await Promise.all(pegados.map((p) => imagenes.current.get(p.id)?.decode().catch(() => { })))
      const stickers = pegados.flatMap((p) => {
        const img = imagenes.current.get(p.id)
        if (!img?.naturalWidth) return []
        return [{ img, x: p.x, y: p.y, s: p.s, r: p.r, alto: img.naturalHeight / img.naturalWidth }]
      })
      const r = await capturar({ ancho: anchoPedido(), fondo, stickers })
      if (sesion.current !== s) return
      archivoRef.current = r
      setArchivo(r)
    } catch {
      if (sesion.current === s) {
        setFallo(true)
        est.quieto = false
      }
    }
    if (sesion.current === s) setCreando(false)
  }

  const guardar = () => {
    const r = archivoRef.current
    if (!r) return
    try { playSfx('click', { volume: 1.0 }) } catch { }
    const url = URL.createObjectURL(r.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'skulley-rad-wallpaper-4k.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const salir = useCallback(() => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    onSalir?.()
  }, [onSalir])

  const anchoDato = archivo ? archivo.w : anchoPedido()
  const altoDato = archivo ? archivo.h : altoDe(anchoDato)

  return (
    <div className={`dwp ${lista ? 'is-lista' : ''} ${creando ? 'is-creando' : ''}`} aria-hidden={!lista}>
      <div
        className="dwp-escenario"
        data-h={herramienta}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div ref={marcoRef} className="dwp-marco">
        {pegados.map((p) => (
          <div
            key={p.n}
            className={`dwp-sticker ${elegido === p.n ? 'is-elegido' : ''}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.s * 100}%`, transform: `translate(-50%, -50%) rotate(${p.r}rad)` }}
            onPointerDown={(e) => onStickerDown(e, p, false)}
            onWheel={(e) => onStickerWheel(e, p)}
          >
            <img src={p.src} alt="" draggable="false" />
            {elegido === p.n && (
              <>
                <button
                  type="button"
                  className="dwp-sticker__quitar"
                  aria-label={t('customizer.wallRemoveSticker')}
                  data-tip={t('customizer.wallRemoveSticker')}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => quitarPegado(p.n)}
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
                <span className="dwp-sticker__tirador" onPointerDown={(e) => onStickerDown(e, p, true)} aria-hidden="true">
                  <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                </span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="dwp-cap dwp-cap--atras" inert={!lista || undefined}>
        <button type="button" className="dwp-h" onClick={salir} aria-label={t('common.back')} data-tip={t('common.back')} data-tip-side="bottom">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <button type="button" className="dwp-h" onClick={abrirGuia} aria-label={t('customizer.wallGuideHelp')} data-tip={t('customizer.wallGuideHelp')} data-tip-side="bottom">
          <QuestionMarkCircleIcon className="w-[22px] h-[22px]" />
        </button>
      </div>

      <div className="dwp-cap dwp-cap--riel" role="toolbar" aria-orientation="vertical" aria-label={t('customizer.wallpaper')} inert={!lista || undefined}>
        {HERRAMIENTAS.map((h, i) => (h.sep ? <span key={i} className="dwp-sep" /> : (
          <button
            key={h.id}
            type="button"
            className="dwp-h"
            aria-pressed={herramienta === h.id}
            aria-label={t(h.label)}
            data-tip={`${t(h.label)} (${h.tecla})`}
            onClick={() => { setHerramienta(h.id); try { playSfx('click', { volume: 1.0 }) } catch { } }}
          >
            {h.Icono && <h.Icono className="w-[22px] h-[22px]" />}
            {h.id === 'texto' && <span className="dwp-t" aria-hidden="true">T</span>}
            {h.id === 'fondo' && <span className="dwp-relleno" style={{ backgroundColor: fondo }} aria-hidden="true" />}
          </button>
        )))}
      </div>

      <div className="dwp-cap dwp-cap--archivo" inert={!lista || undefined}>
        <button type="button" className="dwp-h" onClick={() => acercarAlCentro(1 / ZOOM_PASO)} disabled={zoomPct <= 100} aria-label={t('customizer.wallZoomOut')} data-tip={t('customizer.wallZoomOut')} data-tip-side="bottom">
          <MinusIcon className="w-[18px] h-[18px]" />
        </button>
        <span className="dwp-zoom" role="status">{zoomPct} %</span>
        <button type="button" className="dwp-h" onClick={() => acercarAlCentro(ZOOM_PASO)} disabled={zoomPct >= ZOOM_MAX * 100} aria-label={t('customizer.wallZoomIn')} data-tip={t('customizer.wallZoomIn')} data-tip-side="bottom">
          <PlusIcon className="w-[18px] h-[18px]" />
        </button>
        <button type="button" className="dwp-h" onClick={centrar} aria-label={t('customizer.wallCenter')} data-tip={`${t('customizer.wallCenter')} (C)`} data-tip-side="bottom">
          <ViewfinderCircleIcon className="w-[22px] h-[22px]" />
        </button>
        <span className="dwp-sep" />
        <p className="dwp-dato" role="status">
          {fallo ? t('customizer.wallError') : `${anchoDato} × ${altoDato} px`}
        </p>
        <button
          type="button"
          className="shop-btn shop-btn--primary dwp-boton"
          onClick={archivo ? guardar : crear}
          disabled={creando}
          aria-busy={creando}
        >
          <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
          {archivo ? t('customizer.wallSave') : fallo ? t('customizer.wallRetry') : t('customizer.wallCreate')}
        </button>
      </div>

      <div className="dwp-cap dwp-cap--ajustes" inert={!lista || undefined}>
        {(herramienta === 'rota' || herramienta === 'mano' || herramienta === 'zoom') && PLANOS.map((p) => (
          <button key={p.id} type="button" className="dwp-chip" aria-pressed={plano === p.id} onClick={() => elegirPlano(p.id)}>
            {t(p.label)}
          </button>
        ))}
        {herramienta === 'texto' && (
          <>
            <input
              ref={textoRef}
              className="dwp-texto"
              type="text"
              value={texto}
              maxLength={TEXTO_MAX}
              placeholder={t('customizer.wallTextHint')}
              aria-label={t('customizer.wallText')}
              onChange={(e) => elegirTexto(e.target.value)}
            />
            <div className="dwp-fondo dwp-fondo--solo">
              <ColorWell label={t('customizer.wallText')} value={colorTexto} onChange={elegirColorTexto} />
            </div>
          </>
        )}
        {herramienta === 'stickers' && (
          <div className="dwp-tira" ref={marcarBordes} onScroll={(e) => marcarBordes(e.currentTarget)} onWheel={onTiraWheel}>
            {STICKERS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="dwp-miniatura"
                onClick={() => pegar(p)}
                aria-label={`${t('customizer.wallStickers')} ${i + 1}`}
              >
                <img src={p.src} alt="" draggable="false" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {herramienta === 'fondo' && (
          <div className="dwp-fondo">
            <ColorWell label={fondo.toUpperCase()} value={fondo} onChange={elegirFondo} />
          </div>
        )}
      </div>

      {paso !== null && (
        <>
          <div className="dwp-guia-capa" />
          <div className="dwp-guia-aro" style={guiaCaja?.aro || { opacity: 0 }} aria-hidden="true" />
          <section ref={guiaRef} className="dwp-guia" style={guiaCaja?.tarjeta || { visibility: 'hidden' }} role="dialog" aria-label={t('customizer.wallGuideHelp')}>
            <p key={paso} className="dwp-guia__texto" role="status">{t(GUIA_PASOS[paso].texto)}</p>
            {GUIA_PASOS[paso].raton && (
              <ul className="dwp-guia__raton">
                {RATON.map((b) => (
                  <li key={b.parte}>
                    <Raton parte={b.parte} />
                    <span>{t(b.texto)}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="dwp-guia__pie">
              <span className="dwp-guia__cuenta">{paso + 1} / {GUIA_PASOS.length}</span>
              <button type="button" className="dwp-guia__saltar" onClick={cerrarGuia}>{t('customizer.wallGuideSkip')}</button>
              <button type="button" className="shop-btn shop-btn--primary dwp-guia__sigue" onClick={sigueGuia}>
                {paso >= GUIA_PASOS.length - 1 ? t('customizer.done') : t('customizer.wallGuideNext')}
              </button>
            </div>
          </section>
        </>
      )}

      <div className="dwp-velo" role="status">{creando ? t('customizer.wallMaking') : ''}</div>
    </div>
  )
}
