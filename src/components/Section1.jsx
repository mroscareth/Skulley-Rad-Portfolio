import React from 'react'
import WorkDotsIndicator from './WorkDotsIndicator.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid'
import { useGLTF, Environment } from '@react-three/drei'
import * as THREE from 'three'
import PauseFrameloop from './PauseFrameloop.jsx'

// Fallback: proyectos estáticos en caso de que la API falle
const FALLBACK_ITEMS = [
  {
    id: 'item-heritage',
    title: 'Heritage Design Studio',
    image: `${import.meta.env.BASE_URL}heritage.jpg`,
    url: 'https://www.theheritage.mx/',
    slug: 'heritage',
  },
  {
    id: 'item-ethereans',
    title: 'The Ethereans',
    image: `${import.meta.env.BASE_URL}Etherean.jpg`,
    url: 'https://ethereans.xyz/',
    slug: 'ethereans',
  },
  {
    id: 'item-arttoys',
    title: 'Art Toys',
    image: `${import.meta.env.BASE_URL}ArtToys/HouseBird.jpg`,
    url: null,
    slug: 'arttoys',
  },
  {
    id: 'item-heads',
    title: '3D Heads',
    image: `${import.meta.env.BASE_URL}3dheads.webp`,
    url: null,
    slug: 'heads',
  },
  {
    id: 'item-2dheads',
    title: '2D Heads',
    image: `${import.meta.env.BASE_URL}2DHeads/cover.webp`,
    url: null,
    slug: '2dheads',
  },
]

/**
 * Transformar proyecto de API al formato esperado por el componente
 */
function transformApiProject(project) {
  // Determinar la imagen de cover
  let image = project.cover_image
  if (image && !image.startsWith('http')) {
    image = `${import.meta.env.BASE_URL}${image}`
  } else if (!image) {
    image = `${import.meta.env.BASE_URL}3dheads.webp` // fallback
  }

  return {
    id: `item-${project.slug}`,
    title: project.title,
    image,
    url: project.project_type === 'link' ? project.external_url : null,
    slug: project.slug,
    // Campos adicionales para traducciones dinámicas
    description_en: project.description_en,
    description_es: project.description_es,
  }
}

function PauseWhenHidden() {
  const [hidden, setHidden] = React.useState(false)
  React.useEffect(() => {
    const onVis = () => {
      try { setHidden(document.visibilityState === 'hidden') } catch { setHidden(false) }
    }
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  return <PauseFrameloop paused={hidden} />
}

// Export util para pre-cargar imágenes desde el preload del CTA
export function getWorkImageUrls() {
  try {
    // Un solo asset local es suficiente (cacheado por el navegador)
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}

export default function Section1({ scrollerRef, scrollbarOffsetRight = 0, disableInitialSeed = false, navOffset = 0, simpleMode = true }) {
  const { t, lang } = useLanguage()
  const [items, setItems] = React.useState(FALLBACK_ITEMS)

  // Fetch proyectos dinámicos desde la API (con fallback a estáticos)
  React.useEffect(() => {
    let cancelled = false
    async function fetchProjects() {
      try {
        const res = await fetch('/api/projects.php?active=1')
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        if (data.ok && Array.isArray(data.projects) && data.projects.length > 0 && !cancelled) {
          setItems(data.projects.map(transformApiProject))
        }
      } catch {
        // Silenciar errores - usar fallback
      }
    }
    fetchProjects()
    return () => { cancelled = true }
  }, [])
  const [detailSlug, setDetailSlug] = React.useState(null)
  const [detailImages, setDetailImages] = React.useState([])
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState('')
  const [backPos, setBackPos] = React.useState({ top: 24, left: null })
  const [detailClosing, setDetailClosing] = React.useState(false)
  const [detailOpening, setDetailOpening] = React.useState(false)
  const openTimerRef = React.useRef(null)
  const closeTimerRef = React.useRef(null)
  const [hover, setHover] = React.useState({ active: false, title: '', x: 0, y: 0 })
  const listRef = React.useRef(null)
  const rafRef = React.useRef(0)
  const lastUpdateRef = React.useRef(0)
  const hoverTiltRef = React.useRef({ el: null, rx: 0, ry: 0 })
  const invalidateRef = React.useRef(null)
  const [overlayKey, setOverlayKey] = React.useState(0)
  const degradedRef = React.useRef(false)
  // Modo de entrada “baraja”: apila visualmente las tarjetas del grupo que contiene el proyecto i=0
  const [stackMode, setStackMode] = React.useState(true)
  const [stackRep, setStackRep] = React.useState(null)
  const stackModeRef = React.useRef(false)
  const stackRepRef = React.useRef(null)
  React.useEffect(() => { stackModeRef.current = stackMode }, [stackMode])
  React.useEffect(() => { stackRepRef.current = stackRep }, [stackRep])

  // (simpleMode render moved below, after handlers are defined)

  const onEnter = (e, it) => {
    const slug = it?.slug
    let title = it.title
    // Intentar obtener traducción para slugs conocidos
    if (slug === 'heritage') {
      const key = 'work.items.heritage.tooltip'
      const val = t(key)
      title = (val && typeof val === 'string' && val !== key) ? val : 'Heritage Creative Studio'
    } else if (slug === 'ethereans') {
      const key = 'work.items.ethereans.tooltip'
      const val = t(key)
      title = (val && typeof val === 'string' && val !== key) ? val : 'The Ethereans'
    }
    // Para cualquier proyecto, usar el título del item
    setHover({ active: true, title: title || it.title, x: e.clientX + 20, y: e.clientY + 20 })
  }
  const onMove = (e, preferLeft = false) => setHover((h) => ({ ...h, x: e.clientX + 20, y: e.clientY + 20, preferLeft }))
  const onLeave = () => setHover({ active: false, title: '', x: 0, y: 0 })

  // Abrir/cerrar detalle
  const openDetail = (slug) => {
    // Cancelar timers previos
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    setDetailClosing(false)
    setDetailOpening(true)
    setDetailImages([])
    setDetailError('')
    setDetailSlug(slug)
    // Permitir que el grid haga fade-out antes de iniciar el fade-in del overlay (más lento)
    openTimerRef.current = setTimeout(() => { setDetailOpening(false); openTimerRef.current = null }, 380)
    try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'back' } })) } catch {}
    try { window.dispatchEvent(new CustomEvent('detail-open')) } catch {}
  }
  const closeDetail = () => {
    if (detailClosing) return
    // Cancelar timers de apertura si quedara alguno
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    setDetailClosing(true)
    // Habilitar inmediatamente interacción con la grilla
    setDetailSlug(null)
    // Avisar de inmediato para reactivar marquee
    try { window.dispatchEvent(new CustomEvent('detail-close')) } catch {}
    // Espera animación de salida del overlay
    closeTimerRef.current = setTimeout(() => {
      setDetailImages([])
      setDetailLoading(false)
      setDetailError('')
      setDetailClosing(false)
      try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'close' } })) } catch {}
      closeTimerRef.current = null
    }, 320)
  }

  // Cargar imágenes del detalle (soporta proyectos originales y nuevos desde API)
  React.useEffect(() => {
    if (!detailSlug) return
    let cancelled = false
    async function load() {
      setDetailLoading(true); setDetailError('')
      try {
        // Slugs originales con carpetas de manifest
        const originalSlugs = ['heads', 'arttoys', '2dheads']
        
        if (originalSlugs.includes(detailSlug)) {
          const folders = detailSlug === 'heads'
            ? ['3Dheads', '3dheads']
            : (detailSlug === 'arttoys' ? ['ArtToys', 'arttoys'] : ['2DHeads', '2dheads'])
          let res = await fetch(`${import.meta.env.BASE_URL}${folders[0]}/manifest.json`, { cache: 'no-cache' })
          if (!res.ok) {
            res = await fetch(`${import.meta.env.BASE_URL}${folders[1]}/manifest.json`, { cache: 'no-cache' })
          }
          if (res.ok) {
            const arr = await res.json()
            const imgs = Array.isArray(arr) ? arr.map((x) => (typeof x === 'string' ? x : x?.src)).filter(Boolean) : []
            const filtered = (detailSlug === 'arttoys')
              ? imgs.filter((p) => !/HouseBird\.jpg$/i.test(p || ''))
              : (detailSlug === '2dheads'
                  ? imgs.filter((p) => !/cover\.webp$/i.test(p || ''))
                  : imgs)
            if (!cancelled) setDetailImages(filtered)
          } else {
            // Fallback DEV: intentar parsear listado de directorio del dev server
            let html
            try {
              let resHtml = await fetch(`${import.meta.env.BASE_URL}${folders[0]}/`, { cache: 'no-cache' })
              if (!resHtml.ok) resHtml = await fetch(`${import.meta.env.BASE_URL}${folders[1]}/`, { cache: 'no-cache' })
              if (resHtml.ok) html = await resHtml.text()
            } catch {}
            if (html) {
              const exts = /(href\s*=\s*"([^"]+\.(?:png|jpe?g|webp|gif))")/ig
              const found = []
              let m
              while ((m = exts.exec(html)) !== null) {
                const href = m[2]
                if (/^https?:/i.test(href)) continue
                const clean = href.replace(/^\.\//, '')
                const prefixed = (folders.some((f) => clean.startsWith(`${f}/`))) ? clean : `${folders[0]}/${clean}`
                if (!found.includes(prefixed)) found.push(prefixed)
              }
              const filtered = (detailSlug === 'arttoys')
                ? found.filter((p) => !/HouseBird\.jpg$/i.test(p || ''))
                : (detailSlug === '2dheads'
                    ? found.filter((p) => !/cover\.webp$/i.test(p || ''))
                    : found)
              if (!cancelled) setDetailImages(filtered)
            } else {
              // Fallback PROBE: intentar descubrir nombres comunes 1..60.(webp|jpg|jpeg|png)
              const bases = folders
              const exts = ['webp', 'jpg', 'jpeg', 'png']
              const pad = (n, w) => String(n).padStart(w, '0')
              const candidates = []
              for (const folder of bases) {
                for (let i = 1; i <= 60; i++) {
                  const nums = [String(i), pad(i, 2), pad(i, 3)]
                  for (const num of nums) {
                    for (const ext of exts) {
                      candidates.push(`${folder}/${num}.${ext}`)
                    }
                  }
                }
              }
              const found = []
              await Promise.all(candidates.map(async (p) => {
                try {
                  const r = await fetch(`${import.meta.env.BASE_URL}${p}`, { cache: 'no-cache' })
                  if (r.ok) found.push(p)
                } catch {}
              }))
              if (found.length > 0) {
                const filtered = (detailSlug === '2dheads')
                  ? found.filter((p) => !/cover\.webp$/i.test(p || ''))
                  : (detailSlug === 'arttoys' ? found.filter((p) => !/HouseBird\.jpg$/i.test(p || '')) : found)
                if (!cancelled) setDetailImages(filtered)
              } else {
                throw new Error('manifest not found')
              }
            }
          }
        } else {
          // Para proyectos nuevos: cargar archivos desde la API
          try {
            // Buscar el proyecto por slug en la API
            const apiRes = await fetch(`/api/projects.php?active=1`)
            if (apiRes.ok) {
              const apiData = await apiRes.json()
              if (apiData.ok && Array.isArray(apiData.projects)) {
                const project = apiData.projects.find(p => p.slug === detailSlug)
                if (project && project.id) {
                  // Obtener el proyecto con sus archivos
                  const detailRes = await fetch(`/api/projects.php?id=${project.id}`)
                  if (detailRes.ok) {
                    const detailData = await detailRes.json()
                    if (detailData.ok && detailData.project?.files?.length > 0) {
                      const imgs = detailData.project.files
                        .filter(f => f.file_type === 'image')
                        .sort((a, b) => a.display_order - b.display_order)
                        .map(f => f.path || f.file_path)
                        .filter(Boolean)
                      if (!cancelled) setDetailImages(imgs)
                      return
                    }
                  }
                }
              }
            }
            // Si no hay archivos o proyecto no encontrado
            if (!cancelled) setDetailImages([])
          } catch {
            if (!cancelled) setDetailImages([])
          }
        }
      } catch (e) {
        if (!cancelled) setDetailError('No images found')
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [detailSlug])

  // Cerrar detalle si el retrato emite el evento de back
  React.useEffect(() => {
    const onBack = () => closeDetail()
    window.addEventListener('detail-close', onBack)
    return () => window.removeEventListener('detail-close', onBack)
  }, [])

  // Posicionar botón back justo encima del retrato (como el botón de cerrar del retrato)
  React.useEffect(() => {
    if (!detailSlug) return
    const compute = () => {
      try {
        const root = document.querySelector('[data-portrait-root]')
        if (!root) { setBackPos((p) => ({ ...p, left: null })); return }
        const r = root.getBoundingClientRect()
        const top = Math.max(8, r.top - 56)
        const left = Math.round(r.left + r.width / 2)
        setBackPos({ top, left })
      } catch { setBackPos((p) => ({ ...p, left: null })) }
    }
    compute()
    const on = () => compute()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, { passive: true })
    const id = setInterval(compute, 400)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('scroll', on); clearInterval(id) }
  }, [detailSlug])

  const renderItems = React.useMemo(() => {
    const REPEATS = 12
    const out = []
    for (let r = 0; r < REPEATS; r++) {
      for (let i = 0; i < items.length; i++) {
        out.push({ key: `r${r}-i${i}`, i, r, item: items[i] })
      }
    }
    return out
  }, [items])

  React.useEffect(() => {
    const scroller = scrollerRef?.current
    const container = listRef.current
    if (!scroller || !container) return
    let scheduled = false
    // Medidas para bucle infinito
    const periodPxRef = { current: 0 }
    const top0Ref = { current: 0 }
    const repeatsRef = { current: 0 }

    const measurePeriod = () => {
      try {
        const sRect = scroller.getBoundingClientRect()
        const anchors = Array.from(container.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
        if (anchors.length >= 2) {
          const a0 = anchors[0].getBoundingClientRect()
          const a1 = anchors[1].getBoundingClientRect()
          const t0 = (scroller.scrollTop || 0) + (a0.top - sRect.top)
          const t1 = (scroller.scrollTop || 0) + (a1.top - sRect.top)
          periodPxRef.current = Math.max(1, Math.round(t1 - t0))
          top0Ref.current = t0
          repeatsRef.current = anchors.length
        }
      } catch {}
    }
    measurePeriod()
    setTimeout(measurePeriod, 0)
    const update = () => {
      scheduled = false
      lastUpdateRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      try {
        const sRect = scroller.getBoundingClientRect()
        const viewCenterY = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2 - Math.round((navOffset || 0) / 2)
        const half = (scroller.clientHeight || 1) / 2
        const cards = container.querySelectorAll('[data-work-card]')
        cards.forEach((el) => {
          const r = el.getBoundingClientRect()
          const center = (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2
          const dy = Math.abs(center - viewCenterY)
          const t = Math.max(0, Math.min(1, dy / (half)))
          const ease = (x) => 1 - Math.pow(1 - x, 2)
          let baseScale = 0.88 + 0.18 * (1 - ease(t))
          const boost = dy < 14 ? 0.04 : 0
          let fade = 0.55 + 0.45 * (1 - ease(t))
          const dyStack = parseFloat(el.getAttribute('data-stack-dy') || '0') || 0
          const idx = parseInt(el.getAttribute('data-work-card-i') || '0', 10)
          const rep = el.getAttribute('data-work-rep')
          const isStacked = stackModeRef.current && rep != null && String(rep) === String(stackRepRef.current) && dyStack > 0
          let transformBase = 'perspective(1200px) translateZ(0)'
          if (isStacked) {
            // Mover ligeramente hacia arriba para “salir” desde detrás del proyecto 1
            transformBase += ` translateY(${-Math.round(dyStack)}px)`
            const maxIdx = Math.max(1, items.length - 1)
            const depthFrac = Math.min(1, Math.max(0, idx / maxIdx))
            // Reducir un poco la escala y opacidad según profundidad para el efecto baraja
            baseScale = Math.max(0.82, baseScale - 0.06 * depthFrac)
            fade = Math.min(fade, 0.85 - 0.35 * depthFrac)
            try { el.style.zIndex = String(1000 - idx) } catch {}
          } else {
            try { el.style.zIndex = '' } catch {}
          }
          el.__scale = baseScale + boost
          el.style.opacity = Math.max(0, Math.min(1, fade)).toFixed(3)
          el.style.transform = `${transformBase} scale(${(el.__scale || 1).toFixed(3)})`
        })
      } catch {}
    }
    const onScroll = () => {
      if (scheduled) return
      // Ajuste de bucle infinito: cuando se supera el penúltimo ancla o antes del segundo, reubicar
      try {
        const p = periodPxRef.current
        const t0 = top0Ref.current
        const reps = repeatsRef.current
        if (p > 0 && reps >= 2) {
          const st = scroller.scrollTop || 0
          const lower = t0 + p * 1
          const upper = t0 + p * (reps - 2)
          if (st < lower) scroller.scrollTop = st + p * (reps - 3)
          else if (st > upper) scroller.scrollTop = st - p * (reps - 3)
        }
      } catch {}
      scheduled = true
      rafRef.current = requestAnimationFrame(update)
      try { if (typeof invalidateRef.current === 'function') invalidateRef.current() } catch {}
    }
    const onResize = () => { onScroll(); try { if (typeof invalidateRef.current === 'function') invalidateRef.current() } catch {} }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    // Sembrar: situar en mitad de las repeticiones y centrar la tarjeta i=0 en el viewport
    const seed = () => {
      try {
        measurePeriod()
        const anchors = Array.from(container.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
        if (anchors.length >= 2) {
          const k = Math.floor(anchors.length / 2)
          const sRect = scroller.getBoundingClientRect()
          const r = anchors[k].getBoundingClientRect()
          const center = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
          const target = Math.max(0, Math.round(center - (scroller.clientHeight || 0) / 2))
          scroller.scrollTop = target
        } else {
          // Fallback: usar el primer anchor si no hay suficientes repeticiones
          const sRect = scroller.getBoundingClientRect()
          const a0 = container.querySelector('[data-work-card][data-work-card-i="0"]')
          if (a0) {
            const r0 = a0.getBoundingClientRect()
            const c0 = (scroller.scrollTop || 0) + (r0.top - sRect.top) + (r0.height / 2)
            scroller.scrollTop = Math.max(0, Math.round(c0 - (scroller.clientHeight || 0) / 2))
          }
        }
      } catch {}
      onScroll()
    }
    if (!disableInitialSeed) {
      setTimeout(() => { seed() }, 0)
    } else {
      // Sin seed inicial: aplicar una primera actualización de estilos sin mover el scroll
      setTimeout(() => { update() }, 0)
    }
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollerRef, disableInitialSeed])

  // Tilt desactivado: transiciones entre tarjetas más limpias
  // Determinar el grupo (repetición r) cuyo anchor i=0 está centrado y activar apilado de entrada
  React.useEffect(() => {
    const scroller = scrollerRef?.current
    const container = listRef.current
    if (!scroller || !container) return
    let rafId
    const measure = () => {
      try {
        const anchors = Array.from(container.querySelectorAll('[data-work-card][data-work-card-i="0"]'))
        if (!anchors.length) return
        const sRect = scroller.getBoundingClientRect()
        const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2
        let bestRep = null
        let bestD = Infinity
        for (const el of anchors) {
          const r = el.getBoundingClientRect()
          const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + (r.height / 2)
          const d = Math.abs(c - viewCenter)
          const rep = parseInt(el.getAttribute('data-work-rep') || '-1', 10)
          if (!Number.isNaN(rep) && d < bestD) { bestD = d; bestRep = rep }
        }
        if (typeof bestRep === 'number') setStackRep(bestRep)
        setStackMode(true)
      } catch {}
    }
    rafId = requestAnimationFrame(measure)
    const onFirstScroll = () => {
      try { setTimeout(() => setStackMode(false), 0) } catch {}
      try { scroller.removeEventListener('scroll', onFirstScroll) } catch {}
    }
    scroller.addEventListener('scroll', onFirstScroll, { passive: true })
    const t = setTimeout(() => { try { setStackMode(false) } catch {} }, 800)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      try { scroller.removeEventListener('scroll', onFirstScroll) } catch {}
      clearTimeout(t)
    }
  }, [scrollerRef])

  // Forzar un refresco de transformaciones cuando cambia el estado de apilado.
  React.useEffect(() => {
    const scroller = scrollerRef?.current
    if (!scroller) return
    try { scroller.dispatchEvent(new Event('scroll')) } catch {}
  }, [stackMode, stackRep, scrollerRef])

  // MODO SIMPLE: lista vertical de secciones a pantalla completa con CSS scroll-snap
  if (simpleMode) {
    // Índice activo según scroll del contenedor principal
    const [activeIdx, setActiveIdx] = React.useState(0)
    const [indicatorRight, setIndicatorRight] = React.useState(16)
    const DOT = 12
    const GAP = 26
    const lineH = (items.length > 0) ? ((items.length - 1) * GAP + DOT) : DOT
    React.useEffect(() => {
      const scroller = scrollerRef?.current
      if (!scroller) return
      const onScroll = () => {
        try {
          const h = Math.max(1, scroller.clientHeight || 1)
          const idx = Math.round(Math.max(0, (scroller.scrollTop || 0)) / h)
          setActiveIdx(Math.max(0, Math.min(items.length - 1, idx)))
        } catch {}
      }
      onScroll()
      scroller.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('resize', onScroll)
      return () => {
        try { scroller.removeEventListener('scroll', onScroll) } catch {}
        window.removeEventListener('resize', onScroll)
      }
    }, [scrollerRef, items.length])
    // Medir el ancho real de la tarjeta para colocar los dots “al lado” (no al borde del viewport)
    React.useEffect(() => {
      const measure = () => {
        try {
          const firstCard = listRef.current?.querySelector('[data-work-card]')
          if (!firstCard) return
          const rect = firstCard.getBoundingClientRect()
          const vw = Math.max(1, window.innerWidth || rect.right)
          const right = Math.round(((vw - rect.width) / 2) - 36 - (scrollbarOffsetRight || 0))
          setIndicatorRight(Math.max(8, right))
        } catch {}
      }
      measure()
      const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(measure) : null
      if (ro && listRef.current) ro.observe(listRef.current)
      window.addEventListener('resize', measure)
      const t = setTimeout(measure, 60)
      return () => {
        if (ro && listRef.current) ro.unobserve(listRef.current)
        window.removeEventListener('resize', measure)
        clearTimeout(t)
      }
    }, [listRef, scrollbarOffsetRight, items.length])
    const scrollToIndex = (i) => {
      try {
        const scroller = scrollerRef?.current
        if (!scroller) return
        const top = i * Math.max(1, scroller.clientHeight || 1)
        scroller.scrollTo({ top, behavior: 'smooth' })
      } catch {}
    }
    return (
      <div
        className="pointer-events-auto select-none relative"
      >
        {/* Overlay 3D */}
        <div
          className="fixed inset-0 z-[0] pointer-events-none"
          aria-hidden
          style={{ right: `${scrollbarOffsetRight}px` }}
        >
          <Canvas
            key={overlayKey}
            className="w-full h-full block"
            orthographic
            frameloop="always"
            dpr={[1, 1]}
            gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
            camera={{ position: [0, 0, 10] }}
            events={undefined}
            style={{ pointerEvents: 'none' }}
            onCreated={(state) => {
              try { state.gl.domElement.style.pointerEvents = 'none' } catch {}
              try { invalidateRef.current = state.invalidate } catch {}
              try {
                const canvas = state.gl.domElement
                const onLost = (e) => { try { e.preventDefault() } catch {}; try { degradedRef.current = true } catch {}; try { setOverlayKey((k) => k + 1) } catch {} }
                const onRestored = () => { try { setOverlayKey((k) => k + 1) } catch {} }
                canvas.addEventListener('webglcontextlost', onLost, { passive: false })
                canvas.addEventListener('webglcontextrestored', onRestored)
              } catch {}
            }}
          >
            <PauseWhenHidden />
            <ScreenOrthoCamera />
            <React.Suspense fallback={null}>
              {!degradedRef.current && (<Environment files={`${import.meta.env.BASE_URL}light.hdr`} background={false} />)}
              <ambientLight intensity={0.6} />
              <directionalLight intensity={0.4} position={[0.5, 0.5, 1]} />
              <ParallaxBirds scrollerRef={scrollerRef} />
            </React.Suspense>
          </Canvas>
        </div>

        <div
          ref={listRef}
          className="relative z-[12010] w-full"
        >
          {items.map((it, idx) => (
            <section key={it.id || idx} className="min-h-screen grid place-items-center px-10 py-10">
              <div
                className="w-full max-w-[min(90vw,860px)]"
                data-work-card
                data-work-card-i={idx}
                data-work-rep={0}
              >
                <Card
                  item={it}
                  onEnter={onEnter}
                  onMove={onMove}
                  onLeave={onLeave}
                  onOpenDetail={(slug) => openDetail(slug)}
                />
              </div>
            </section>
          ))}
        </div>
        {/* Indicador: dots verticales (scrollbar custom) */}
        <WorkDotsIndicator
          items={items}
          activeIndex={activeIdx}
          onSelect={scrollToIndex}
          listRef={listRef}
          scrollbarOffsetRight={scrollbarOffsetRight}
          onEnter={onEnter}
          onMove={onMove}
          onLeave={onLeave}
        />
        {hover.active && (
          <div
            className="fixed z-[13060] pointer-events-none px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-white/10"
            style={{ left: `${hover.x + 12}px`, top: `${hover.y + 12}px` }}
          >
            <span className="mr-1" aria-hidden>✨</span>{hover.title}
          </div>
        )}
        {/* Overlay de detalle se mantiene igual */}
        {(detailSlug || detailClosing || detailOpening) && (
          <div
            className={`fixed inset-0 z-[14000] bg-black/80 backdrop-blur-sm ${(!detailOpening && !detailClosing) ? 'pointer-events-auto' : 'pointer-events-none'} overflow-y-auto no-native-scrollbar transition-opacity ${detailOpening ? 'duration-600' : 'duration-300'} ease-out ${detailClosing || detailOpening ? 'opacity-0' : 'opacity-100'}`}
            role="dialog"
            aria-modal="true"
            onKeyDown={(e) => { if (e.key === 'Escape') closeDetail() }}
            tabIndex={-1}
          >
            <div className="mx-auto w-[min(1024px,92vw)] pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6">
              {detailLoading && (<div className="text-center text-white/80 copy-base">{t('common.loading')}</div>)}
              {!detailLoading && detailError && (<div className="text-center text-white/80 copy-base">{detailError}</div>)}
              {!detailLoading && !detailError && detailImages.length === 0 && (
                <div className="text-center text-white/80 copy-base">{t('common.noImages')}</div>
              )}
              {detailImages.map((src, i) => (
                <img
                  key={`${src}-${i}`}
                  src={`${import.meta.env.BASE_URL}${src}`}
                  alt={t('common.imageAlt', { n: i + 1 })}
                  className="w-full h-auto block rounded-lg shadow-lg"
                  loading="lazy"
                  decoding="async"
                />
              ))}
              <div className="h-8" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pointer-events-auto select-none relative">
      {/* Overlay capturador de scroll sobre áreas sin tarjetas (por encima del canvas, debajo del contenido) */}
      <ScrollForwarder scrollerRef={scrollerRef} />
      {/* Parallax 3D overlay como fondo de todo el viewport (no ocupa layout) */}
      <div className="fixed inset-0 z-[0]" aria-hidden style={{ right: `${scrollbarOffsetRight}px`, pointerEvents: 'none' }}>
        <Canvas
          key={overlayKey}
          className="w-full h-full block"
          orthographic
          frameloop="always"
          dpr={[1, 1]}
          gl={{ alpha: true, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
          camera={{ position: [0, 0, 10] }}
          events={undefined}
          onCreated={(state) => {
            try { state.gl.domElement.style.pointerEvents = 'none' } catch {}
            try { invalidateRef.current = state.invalidate } catch {}
            try {
              const canvas = state.gl.domElement
              const onLost = (e) => { try { e.preventDefault() } catch {}; try { degradedRef.current = true } catch {}; try { setOverlayKey((k) => k + 1) } catch {} }
              const onRestored = () => { try { setOverlayKey((k) => k + 1) } catch {} }
              canvas.addEventListener('webglcontextlost', onLost, { passive: false })
              canvas.addEventListener('webglcontextrestored', onRestored)
            } catch {}
          }}
        >
          {/* Pausar este canvas cuando la pestaña esté oculta para evitar consumo innecesario */}
          <PauseWhenHidden />
          <ScreenOrthoCamera />
          <React.Suspense fallback={null}>
            {!degradedRef.current && (<Environment files={`${import.meta.env.BASE_URL}light.hdr`} background={false} />)}
            <ambientLight intensity={0.6} />
            <directionalLight intensity={0.4} position={[0.5, 0.5, 1]} />
            <ParallaxBirds scrollerRef={scrollerRef} />
          </React.Suspense>
        </Canvas>
      </div>
      <div
        ref={listRef}
        className={`relative z-[12010] space-y-12 w-full min-h-screen flex flex-col items-center justify-start px-10 py-10 transition-opacity duration-500 ${detailSlug ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onWheel={(e) => {
          try {
            const el = scrollerRef?.current
            if (el) {
              e.preventDefault()
              el.scrollTop += e.deltaY
            }
          } catch {}
        }}
      >
        {/* Fade gradients top/bottom — disabled in Work to evitar halo sobre la primera tarjeta */}
        {false && (
          <>
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 z-[1]" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0))' }} />
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-32 z-[1]" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0))' }} />
          </>
        )}
        {renderItems.map((it) => {
          const STACK_GAP = 28
          const isStackGroup = stackMode && stackRep != null && it.r === stackRep
          const stackDy = isStackGroup && it.i > 0 ? it.i * STACK_GAP : 0
          return (
            <div
              key={it.key}
              className="py-4 will-change-transform"
              data-work-card
              data-work-card-i={it.i}
              data-work-rep={it.r}
              data-stack-dy={stackDy}
              style={{
                transform: 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale(0.96)',
                transition: 'transform 220ms ease',
                zIndex: isStackGroup ? (1000 - it.i) : 'auto',
              }}
            >
              <Card
                item={it.item}
                onEnter={onEnter}
                onMove={onMove}
                onLeave={onLeave}
                onOpenDetail={(slug) => openDetail(slug)}
              />
            </div>
          )
        })}
      </div>
      {hover.active && (() => {
        const TOOLTIP_W = 200
        const MARGIN = 12
        const vw = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 1920
        const vh = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 1080
        const forceLeft = Boolean(hover.preferLeft)
        const wantLeft = forceLeft || (hover.x + MARGIN + TOOLTIP_W > vw - 8)
        let left = wantLeft ? (hover.x - MARGIN - TOOLTIP_W) : (hover.x + MARGIN)
        left = Math.max(8, Math.min(vw - TOOLTIP_W - 8, left))
        let top = hover.y + 12
        top = Math.max(8, Math.min(vh - 40, top))
        return (
          <div
            className="fixed z-[13060] pointer-events-none px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-white/10"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              maxWidth: `${TOOLTIP_W}px`,
              textAlign: 'left',
              whiteSpace: 'normal',
            }}
          >
            <span className="mr-1" aria-hidden>✨</span>{hover.title}
          </div>
        )
      })()}

      {/* Detail overlay (subsección con scroll de imágenes) */}
      {(detailSlug || detailClosing || detailOpening) && (
        <div
          className={`fixed inset-0 z-[14000] bg-black/80 backdrop-blur-sm ${(!detailOpening && !detailClosing) ? 'pointer-events-auto' : 'pointer-events-none'} overflow-y-auto no-native-scrollbar transition-opacity ${detailOpening ? 'duration-600' : 'duration-300'} ease-out ${detailClosing || detailOpening ? 'opacity-0' : 'opacity-100'}`}
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => { if (e.key === 'Escape') closeDetail() }}
          tabIndex={-1}
        >
          <div className="mx-auto w-[min(1024px,92vw)] pt-6 sm:pt-8 pb-8 sm:pb-12 space-y-6">
            {detailLoading && (<div className="text-center text-white/80 copy-base">{t('common.loading')}</div>)}
            {!detailLoading && detailError && (<div className="text-center text-white/80 copy-base">{detailError}</div>)}
            {!detailLoading && !detailError && detailImages.length === 0 && (
              <div className="text-center text-white/80 copy-base">{t('common.noImages')}</div>
            )}
            {detailImages.map((src, idx) => (
              <img
                key={`${src}-${idx}`}
                src={`${import.meta.env.BASE_URL}${src}`}
                alt={t('common.imageAlt', { n: idx + 1 })}
                className="w-full h-auto block rounded-lg shadow-lg"
                loading="lazy"
                decoding="async"
              />
            ))}
            <div className="h-8" />
          </div>
        </div>
      )}
    </div>
  )
}

// moved inside component; no-op at module scope

function Card({ item, onEnter, onMove, onLeave, onOpenDetail }) {
  const { t, lang } = useLanguage()
  const slug = item?.slug
  const cardRef = React.useRef(null)
  const tiltRafRef = React.useRef(0)
  const hoveredRef = React.useRef(false)
  const resetTilt = React.useCallback(() => {
    const el = cardRef.current
    if (!el) return
    try {
      el.style.transition = 'transform 90ms ease-out'
      el.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)'
    } catch {}
  }, [])
  const isHeritage = slug === 'heritage'
  const isHeads = slug === 'heads'
  const isEthereans = slug === 'ethereans'
  const isArtToys = slug === 'arttoys'
  const is2DHeads = slug === '2dheads'
  const isKnownSlug = isHeritage || isHeads || isEthereans || isArtToys || is2DHeads
  
  // Determinar si es un proyecto tipo galería (clickeable para ver imágenes)
  const isGallery = !item.url // Si no tiene URL externa, es galería
  
  let overlayTitle = ''
  let overlayDesc = ''
  if (isHeritage) {
    overlayTitle = t('work.items.heritage.title')
    overlayDesc = t('work.items.heritage.desc')
  } else if (isHeads) {
    overlayTitle = t('work.items.heads.title')
    overlayDesc = t('work.items.heads.desc')
  } else if (isEthereans) {
    overlayTitle = t('work.items.ethereans.title')
    overlayDesc = t('work.items.ethereans.desc')
  } else if (isArtToys) {
    overlayTitle = t('work.items.arttoys.title')
    overlayDesc = t('work.items.arttoys.desc')
  } else if (is2DHeads) {
    overlayTitle = t('work.items.2dheads.title')
    overlayDesc = t('work.items.2dheads.desc')
  } else {
    // Para proyectos nuevos: usar datos del item directamente
    overlayTitle = item.title || ''
    // Usar descripción según idioma actual
    overlayDesc = (lang === 'es' ? item.description_es : item.description_en) || ''
  }
  
  const handleClick = () => {
    if (typeof onOpenDetail !== 'function') return
    // Abrir detalle para cualquier proyecto tipo galería
    if (isGallery && slug) {
      onOpenDetail(slug)
    }
  }
  const handleMouseMove = (e) => {
    const el = cardRef.current
    if (!el || !hoveredRef.current) return
    try {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / Math.max(1, rect.width)
      const y = (e.clientY - rect.top) / Math.max(1, rect.height)
      const MAX = 5
      const ry = (x - 0.5) * MAX * 2
      const rx = -(y - 0.5) * MAX * 2
      if (tiltRafRef.current) cancelAnimationFrame(tiltRafRef.current)
      tiltRafRef.current = requestAnimationFrame(() => {
        try {
          el.style.transition = 'transform 60ms ease-out'
          el.style.transform = `perspective(1200px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`
        } catch {}
      })
    } catch {}
  }
  const handleMouseLeave = () => {
    hoveredRef.current = false
    if (tiltRafRef.current) cancelAnimationFrame(tiltRafRef.current)
    resetTilt()
    onLeave()
  }
  return (
    <div
      ref={cardRef}
      className="group mx-auto w-full max-w-[min(90vw,860px)] aspect-[5/3] rounded-xl overflow-hidden shadow-xl relative"
      onMouseEnter={(e) => { hoveredRef.current = true; onEnter(e, item) }}
      onMouseMove={(e) => { onMove(e); handleMouseMove(e) }}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        transform: 'perspective(1200px) rotateX(0deg) rotateY(0deg)',
        transition: 'transform 90ms ease-out',
      }}
    >
      <img
        src={item.image}
        alt={item.title}
        className="w-full h-full object-cover block"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      {/* Icono de enlace externo (solo para tarjetas con URL) */}
      {item.url ? (
        <div className="absolute bottom-2 right-2 z-[3] pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center justify-center w-[54px] h-[54px] rounded-full bg-black/60 text-white shadow-[0_4px_10px_rgba(0,0,0,0.35)]">
            <ArrowTopRightOnSquareIcon className="w-[32px] h-[32px]" aria-hidden />
          </span>
        </div>
      ) : null}
      {/* Hover overlay with blur and centered content (pointer-events none to keep link clickable) */}
      {overlayTitle && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out bg-black/60 backdrop-blur-sm flex items-center justify-center text-center px-6"
          aria-hidden
        >
          <div>
            <h3 className="text-white heading-3">{overlayTitle}</h3>
            {overlayDesc && <p className="mt-2 text-white/90 copy-base" style={{ maxWidth: '52ch', marginLeft: 'auto', marginRight: 'auto' }}>{overlayDesc}</p>}
          </div>
        </div>
      )}
      {item.url ? (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-[1]"
          aria-label={item.title}
        />
      ) : null}
    </div>
  )
}

function ScreenOrthoCamera() {
  const { camera, size } = useThree()
  React.useEffect(() => {
    // Ampliar máscara/frustum para que no recorte elementos en los bordes
    const PAD = Math.max(80, Math.min(200, Math.round(Math.max(size.width, size.height) * 0.08)))
    camera.left = -size.width / 2 - PAD
    camera.right = size.width / 2 + PAD
    camera.top = size.height / 2 + PAD
    camera.bottom = -size.height / 2 - PAD
    // Para evitar clipping por detrás del plano cercano, llevar near muy negativo y far moderado
    // en ortho, valores grandes son seguros para nuestro overlay 2D
    camera.near = -5000
    camera.far = 5000
    camera.position.set(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, size])
  return null
}

function ParallaxField({ scrollerRef }) {
  const { size } = useThree()
  const groups = React.useRef([])
  const bases = React.useMemo(() => {
    const vh = size.height
    const leftX = size.width * 0.22
    const rightX = size.width * 0.78
    const pattern = [
      { x: leftX, y: vh * 0.20, size: 180, color: '#c9e5ff' },
      { x: rightX, y: vh * 0.85, size: 220, color: '#ffd7f6' },
      { x: leftX, y: vh * 1.55, size: 200, color: '#d7ffd9' },
      { x: rightX, y: vh * 2.20, size: 240, color: '#ffe6c9' },
    ]
    const repeats = 12
    const out = []
    for (let r = 0; r < repeats; r++) {
      const offset = r * vh * 2.4
      pattern.forEach((p) => out.push({ ...p, y: p.y + offset }))
    }
    return out
  }, [size])

  useFrame((state, delta) => {
    const scroller = scrollerRef?.current
    const top = scroller ? scroller.scrollTop : 0
    const viewportH = size.height
    bases.forEach((b, i) => {
      const g = groups.current[i]
      if (!g) return
      const x = b.x - size.width / 2
      const yBase = b.y - top
      const y = (viewportH / 2 - yBase) + (i % 2 === 0 ? -1 : 1) * 0.18 * top // Sin parallax
      g.position.set(x, y, 0)
      if (g.children[0]) {
        g.children[0].rotation.x += delta * 0.25
        g.children[0].rotation.z += delta * 0.06
      }
      const inView = yBase > -viewportH * 0.2 && yBase < viewportH * 1.2
      g.visible = inView
    })
  })

  return (
    <group>
      {bases.map((b, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)}>
          <mesh frustumCulled={false} castShadow={false} receiveShadow={false}>
            <boxGeometry args={[b.size, b.size, b.size * 0.35]} />
            <meshStandardMaterial color={b.color} transparent opacity={0.9} depthWrite={false} depthTest side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ParallaxBirds({ scrollerRef }) {
  const { size } = useThree()
  const leftRef = React.useRef()
  const rightRef = React.useRef()
  const whiteRef = React.useRef()
  const isMobile = React.useMemo(() => {
    try { return (typeof window !== 'undefined') ? window.matchMedia('(max-width: 640px)').matches : (size.width <= 640) } catch { return size.width <= 640 }
  }, [size])
  const mobileScale = React.useMemo(() => {
    try {
      // Runtime override (no-op por defecto)
      if (typeof window !== 'undefined' && typeof window.__birdsScaleMobile === 'number') {
        return isMobile ? Math.max(0.3, Math.min(1.0, window.__birdsScaleMobile)) : 1.0
      }
    } catch {}
    return isMobile ? 0.6 : 1.0
  }, [isMobile])
  React.useEffect(() => {
    try {
      if (leftRef.current) leftRef.current.scale.setScalar(mobileScale)
      if (rightRef.current) rightRef.current.scale.setScalar(mobileScale)
      if (whiteRef.current) whiteRef.current.scale.setScalar(mobileScale)
    } catch {}
  }, [mobileScale])
  const leftYRef = React.useRef(0)
  const rightYRef = React.useRef(0)
  const whiteYRef = React.useRef(0)
  const leftXRef = React.useRef(0)
  const rightXRef = React.useRef(0)
  const whiteXRef = React.useRef(0)
  const initRef = React.useRef(false)
  const prevTopRef = React.useRef(0)
  const phaseRef = React.useRef(0)
  const leftVyRef = React.useRef(0)
  const rightVyRef = React.useRef(0)
  const whiteVyRef = React.useRef(0)
  const leftVxRef = React.useRef(0)
  const rightVxRef = React.useRef(0)
  const whiteVxRef = React.useRef(0)
  const lastCollisionLRRef = React.useRef(0)
  const lastCollisionLWRef = React.useRef(0)
  const lastCollisionRWRef = React.useRef(0)
  const entryStartRef = React.useRef(null)
  const gltf = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebird.glb`)
  const gltfPink = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`)
  const gltfWhite = useGLTF(`${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`)
  const DEBUG = false
  const DEBUG_CENTER = false
  // Parámetros ajustables de zero‑g
  const ZERO_G = React.useMemo(() => ({
    windAmpX: 0.045, // fracción del width
    windFreqL: 0.60,
    windFreqR: 0.52,
    windFreqW: 0.58,
    driftYScale: 0.014, // fracción del height
    kY: { L: 44, R: 40, W: 42 }, // rigidez vertical
    cY: { L: 6.2, R: 6.6, W: 6.4 }, // amortiguación vertical
    bounceY: { L: 0.86, R: 0.88, W: 0.88 },
    minKickY: { L: 48, R: 55, W: 52 },
    kX: { L: 7.0, R: 6.6, W: 6.8 },
    cX: { L: 4.0, R: 4.2, W: 4.1 },
    bounceX: { L: 0.88, R: 0.90, W: 0.89 },
    minKickX: { L: 52, R: 58, W: 55 },
    repelK: { L: 200, R: 210, W: 205 },
    edgeThreshY: 0.12,
    edgeThreshX: 0.12,
  }), [])
  // preparar escena clonada y material amigable al overlay 2D
  const makeBird = React.useCallback((variant = 'default') => {
    let baseScene = gltf.scene
    if (variant === 'pink' && gltfPink?.scene) baseScene = gltfPink.scene
    else if (variant === 'white' && gltfWhite?.scene) baseScene = gltfWhite.scene
    const clone = baseScene.clone(true)
    clone.traverse((n) => {
      if (n.isMesh) {
        n.frustumCulled = false
        if (n.material) {
          try {
            n.material = n.material.clone()
            // Evitar artefactos/tearing al rotar: sin transparencia ni doble cara
            n.material.transparent = false
            n.material.opacity = 1.0
            n.material.depthWrite = true
            n.material.depthTest = true
            n.material.side = THREE.FrontSide
            n.material.alphaTest = 0
            n.material.needsUpdate = true
          } catch {}
        }
      }
    })
    // Auto‑escala a tamaño en píxeles del overlay ortográfico
    try {
      const box = new THREE.Box3().setFromObject(clone)
      const sizeV = new THREE.Vector3()
      box.getSize(sizeV)
      const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z) || 1
      const targetPx = 900 // más pequeño en ortho (px)
      const scale = targetPx / maxDim
      clone.scale.setScalar(scale)
    } catch {}
    return clone
  }, [gltf, gltfPink, gltfWhite])

  // layout aleatorio una vez
  const layout = React.useMemo(() => {
    const vh = size.height
    const vw = size.width
    if (DEBUG_CENTER) {
      return {
        left: { x: vw * 0.5 - vw * 0.15, y: vh * 0.5, scale: 3.0 },
        right: { x: vw * 0.5 + vw * 0.15, y: vh * 0.5, scale: 3.0 },
        white: { x: vw * 0.5, y: vh * 0.5, scale: 3.0 },
      }
    }
    return {
      left: { x: vw * 0.18, y: vh * 0.32, scale: 4.0 },
      right: { x: vw * 0.76, y: vh * 0.68, scale: 4.8 },
      white: { x: vw * 0.50, y: vh * 0.60, scale: 4.4 },
    }
  }, [size])

  const leftBird = React.useMemo(() => makeBird('default'), [makeBird])
  const rightBird = React.useMemo(() => makeBird('pink'), [makeBird])
  const whiteBird = React.useMemo(() => makeBird('white'), [makeBird])

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime()
    const w = size.width
    const h = size.height
    let ampFactor = isMobile ? 0.7 : 1.0
    try {
      if (typeof window !== 'undefined' && typeof window.__birdsAmpFactor === 'number') {
        ampFactor = Math.max(0.3, Math.min(1.5, window.__birdsAmpFactor))
      }
    } catch {}
    const ampX = Math.min(w, h) * 0.12 * ampFactor
    const ampY = Math.min(w, h) * 0.10 * ampFactor
    // Left
    if (leftRef.current) {
      const baseX = layout.left.x - w / 2
      const baseY = layout.left.y
      const x = baseX + Math.sin(t * 0.6) * ampX
      const scrY = baseY + Math.cos(t * 0.7) * ampY
      const y = h / 2 - scrY
      leftRef.current.position.set(x, y, 0)
      leftRef.current.rotation.y += delta * 0.08
      leftRef.current.rotation.x += delta * 0.03
      leftRef.current.rotation.z += delta * 0.028
    }
    // Right
    if (rightRef.current) {
      const baseX = layout.right.x - w / 2
      const baseY = layout.right.y
      const x = baseX + Math.sin(t * 0.52 + Math.PI * 0.33) * (ampX * 0.95)
      const scrY = baseY + Math.sin(t * 0.62 + 1.2) * (ampY * 0.9)
      const y = h / 2 - scrY
      rightRef.current.position.set(x, y, 0)
      rightRef.current.rotation.y -= delta * 0.075
      rightRef.current.rotation.x -= delta * 0.026
      rightRef.current.rotation.z -= delta * 0.03
    }
    // White
    if (whiteRef.current) {
      const baseX = layout.white.x - w / 2
      const baseY = layout.white.y
      const x = baseX + Math.sin(t * 0.58 + Math.PI * 0.18) * (ampX * 0.9)
      const scrY = baseY + Math.cos(t * 0.66 + 0.8) * (ampY * 0.85)
      const y = h / 2 - scrY
      whiteRef.current.position.set(x, y, 0)
      whiteRef.current.rotation.y += delta * 0.085
      whiteRef.current.rotation.x += delta * 0.024
      whiteRef.current.rotation.z += delta * 0.032
    }
  })

  return (
    <group>
      {DEBUG && (
        <>
          <axesHelper args={[200]} />
          {/* cruz en el centro de la pantalla */}
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={4}
                array={new Float32Array([
                  -size.width/2, 0, 0,
                   size.width/2, 0, 0,
                  0, -size.height/2, 0,
                  0,  size.height/2, 0,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#ffffff" opacity={0.4} transparent />
          </lineSegments>
        </>
      )}
      <group ref={leftRef}>
        <primitive object={leftBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#00ff88" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
      <group ref={rightRef}>
        <primitive object={rightBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ff0088" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
      <group ref={whiteRef}>
        <primitive object={whiteBird} />
        {DEBUG && (
          <mesh frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffffff" wireframe opacity={0.6} transparent />
          </mesh>
        )}
      </group>
    </group>
  )
}

useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebird.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebirdPink.glb`)
useGLTF.preload(`${import.meta.env.BASE_URL}3dmodels/housebirdWhite.glb`)


function ScrollForwarder({ scrollerRef }) {
  // Capa invisible que reenvía rueda/touch al contenedor scrolleable cuando el puntero no está sobre las tarjetas
  React.useEffect(() => {
    const onWheel = (e) => {
      try {
        e.preventDefault()
        const el = scrollerRef?.current
        if (el) el.scrollTop += e.deltaY
      } catch {}
    }
    let touchY = null
    const onTouchStart = (e) => { try { touchY = e.touches?.[0]?.clientY ?? null } catch {} }
    const onTouchMove = (e) => {
      try {
        if (touchY == null) return
        const y = e.touches?.[0]?.clientY ?? touchY
        const dy = touchY - y
        touchY = y
        const el = scrollerRef?.current
        if (el) el.scrollTop += dy
        e.preventDefault()
      } catch {}
    }
    const onTouchEnd = () => { touchY = null }
    const el = document.getElementById('work-scroll-forwarder')
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [scrollerRef])
  return (
    <div
      id="work-scroll-forwarder"
      className="fixed inset-0 z-[5]"
      style={{ pointerEvents: 'auto', background: 'transparent' }}
    />
  )
}

