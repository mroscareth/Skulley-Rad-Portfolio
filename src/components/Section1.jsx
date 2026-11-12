import React from 'react'
import Lenis from 'lenis'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import DragShaderOverlay from './DragShaderOverlay.jsx'
import WorkCard, { transformApiProject } from './work/WorkCard.jsx'
import { ProjectDetailArticle } from './work/ProjectDetail.jsx'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'

// Fallback: static projects in case the API fails. Se pinta también mientras responde
// la API, así que sus imágenes se piden en cada visita. Las de Art Toys y 2D Heads son
// las portadas del CMS: misma URL que la tarjeta real, y no se bajan dos veces.
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
    image: `${import.meta.env.BASE_URL}uploads/3/cover.jpg`,
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
    image: `${import.meta.env.BASE_URL}uploads/5/cover.webp`,
    url: null,
    slug: '2dheads',
  },
]

// Utility to preload images from the CTA preload
export function getWorkImageUrls() {
  try {
    // One local asset is enough (cached by the browser)
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}

export default function Section1({ scrollerRef, scrollbarOffsetRight = 0, scrollVelocityRef, lenisRef, initialSlug = null, onSlugChange }) {
  const { t, lang } = useLanguage()
  const [items, setItems] = React.useState(FALLBACK_ITEMS)

  // Fetch dynamic projects from API (with fallback to static)
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
        // Silence errors — use fallback
      }
    }
    fetchProjects()
    return () => { cancelled = true }
  }, [])

  const [detailSlug, setDetailSlug] = React.useState(null)
  const [detailProject, setDetailProject] = React.useState(null) // { title, description_en, description_es, external_url, ... }
  const [detailMedia, setDetailMedia] = React.useState([]) // { type: 'image'|'video', path: string }
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [detailError, setDetailError] = React.useState('')
  const [backPos, setBackPos] = React.useState({ top: 24, left: null })
  const [detailClosing, setDetailClosing] = React.useState(false)
  const [detailOpening, setDetailOpening] = React.useState(false)
  const openTimerRef = React.useRef(null)
  const closeTimerRef = React.useRef(null)
  const [hover, setHover] = React.useState({ active: false, title: '', x: 0, y: 0 })
  const listRef = React.useRef(null)
  const detailOverlayRef = React.useRef(null)
  const detailLenisRef = React.useRef(null)

  // Hovered card index for shader darkening (-1 = none)
  const [hoveredIdx, setHoveredIdx] = React.useState(-1)

  // Manage Lenis for detail overlay: pause main Lenis, create overlay Lenis
  // Three stable states:
  //   opening  → stop main Lenis (overlay not interactive yet)
  //   open     → create overlay Lenis
  //   closed   → destroy overlay Lenis, resume + resize main Lenis
  const detailVisible = !!(detailSlug || detailClosing || detailOpening)
  const detailFullyOpen = !!(detailSlug && !detailClosing && !detailOpening)

  // The shader overlay is always mounted (never unmounted/remounted to avoid
  // WebGL Canvas re-init flicker). We use CSS visibility to show/hide it instead.

  // Stop main Lenis as soon as detail starts opening
  React.useEffect(() => {
    if (detailVisible) {
      try { if (lenisRef?.current) lenisRef.current.stop() } catch { }
    }
  }, [detailVisible, lenisRef])

  // Create overlay Lenis once the detail is fully open (interactive)
  React.useEffect(() => {
    if (!detailFullyOpen) return
    // Wait a tick for the DOM element to be rendered
    const timer = setTimeout(() => {
      const el = detailOverlayRef.current
      if (!el) return
      try {
        const lenis = new Lenis({
          wrapper: el,
          content: el.firstElementChild || el,
          lerp: 0.18,
          smoothWheel: true,
          syncTouch: true,
        })
        detailLenisRef.current = lenis
        let raf
        const tick = (time) => {
          try { lenis.raf(time) } catch { }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        lenis.__raf = raf
      } catch { }
    }, 50)
    return () => {
      clearTimeout(timer)
      // Destroy overlay Lenis when closing starts
      if (detailLenisRef.current) {
        try { cancelAnimationFrame(detailLenisRef.current.__raf) } catch { }
        try { detailLenisRef.current.destroy() } catch { }
        detailLenisRef.current = null
      }
    }
  }, [detailFullyOpen])

  // Resume main Lenis only after the overlay is completely gone
  React.useEffect(() => {
    if (!detailVisible) {
      const main = lenisRef?.current
      if (main) {
        try {
          main.start()
          // Force Lenis to recalculate scroll limits so all cards are reachable
          main.resize()
        } catch { }
      }
    }
  }, [detailVisible, lenisRef])

  // Card DOM refs for shader overlay sync
  const cardDomRefs = React.useRef([])
  const cardRefsMap = React.useMemo(() => new Map(), [])

  // El overlay solo dibuja las tarjetas que ya están en el mapa cuando se
  // renderiza, y el mapa se llena aquí, un cuadro después. Si los proyectos
  // llegaban antes de ese cuadro (la home rápida ya los había pedido y venían
  // de caché), nada volvía a renderizar y Work se quedaba en blanco.
  const [, setRectsNuevos] = React.useState(0)

  // Keep card DOM rects updated for the shader overlay
  React.useEffect(() => {
    let raf
    const update = () => {
      try {
        let nuevos = false
        for (let i = 0; i < items.length; i++) {
          const el = cardDomRefs.current[i]
          if (!el) continue
          let ref = cardRefsMap.get(i)
          if (!ref) {
            ref = { current: null }
            cardRefsMap.set(i, ref)
            nuevos = true
          }
          ref.current = el.getBoundingClientRect()
        }
        if (nuevos) setRectsNuevos((n) => n + 1)
      } catch { }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [items, cardRefsMap])

  // Hover handlers
  const onEnter = (e, it) => {
    const slug = it?.slug
    let title = it.title
    if (slug === 'heritage') {
      const key = 'work.items.heritage.tooltip'
      const val = t(key)
      title = (val && typeof val === 'string' && val !== key) ? val : 'Heritage Creative Studio'
    } else if (slug === 'ethereans') {
      const key = 'work.items.ethereans.tooltip'
      const val = t(key)
      title = (val && typeof val === 'string' && val !== key) ? val : 'The Ethereans'
    }
    setHover({ active: true, title: title || it.title, x: e.clientX + 20, y: e.clientY + 20 })
  }
  const onMove = (e, preferLeft = false) => setHover((h) => ({ ...h, x: e.clientX + 20, y: e.clientY + 20, preferLeft }))
  const onLeave = () => setHover({ active: false, title: '', x: 0, y: 0 })

  const openDetail = (slug) => {
    // Idempotent guard: si ya estamos mostrando (o animando hacia) este mismo
    // slug, no re-abrimos. Evita el race donde el effect de sync con initialSlug
    // dispara un setTimeout(200ms) que llama openDetail una segunda vez DESPUÉS
    // de que el fetch ya resolvió — el reset a detailMedia=[]/detailLoading=true
    // nunca re-disparaba el effect fetch (detailSlug no cambiaba de valor),
    // dejando "Loading…" colgado indefinidamente hasta que el usuario cerraba
    // y reabría el proyecto.
    if (slug && slug === detailSlug && !detailClosing) return
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    setDetailClosing(false)
    setDetailOpening(true)
    setDetailProject(null)
    setDetailMedia([])
    setDetailError('')
    // Mark as loading synchronously so the first render shows "Loading…"
    // instead of briefly flashing "No images" before the fetch effect runs.
    setDetailLoading(true)
    setDetailSlug(slug)
    // Allow the grid to fade-out before starting the slower overlay fade-in
    openTimerRef.current = setTimeout(() => { setDetailOpening(false); openTimerRef.current = null }, 380)
    try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'back' } })) } catch { }
    try { window.dispatchEvent(new CustomEvent('detail-open')) } catch { }
    // Notify parent to update URL
    if (typeof onSlugChange === 'function') onSlugChange(slug)
  }
  const closeDetail = () => {
    if (detailClosing) return
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    setDetailClosing(true)
    // Immediately re-enable grid interaction
    setDetailSlug(null)
    // Notify parent to update URL (back to /work)
    if (typeof onSlugChange === 'function') onSlugChange(null)
    // Notify immediately to reactivate marquee
    try { window.dispatchEvent(new CustomEvent('detail-close')) } catch { }
    // Wait for overlay exit animation
    closeTimerRef.current = setTimeout(() => {
      setDetailProject(null)
      setDetailMedia([])
      setDetailLoading(false)
      setDetailError('')
      setDetailClosing(false)
      try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'close' } })) } catch { }
      closeTimerRef.current = null
    }, 320)
  }

  // Load detail media (images and videos) from the API
  React.useEffect(() => {
    if (!detailSlug) return
    let cancelled = false
    async function load() {
      setDetailLoading(true)
      setDetailError('')
      try {
        // Fetch all active projects to find the one matching the slug
        const apiRes = await fetch(`/api/projects.php?active=1`)
        if (!apiRes.ok) throw new Error('API error')

        const apiData = await apiRes.json()
        if (!apiData.ok || !Array.isArray(apiData.projects)) {
          throw new Error('Invalid API response')
        }

        const project = apiData.projects.find(p => p.slug === detailSlug)
        if (!project || !project.id) {
          throw new Error('Project not found')
        }

        // Fetch full project details with files
        const detailRes = await fetch(`/api/projects.php?id=${project.id}`)
        if (!detailRes.ok) throw new Error('Detail API error')

        const detailData = await detailRes.json()
        if (!detailData.ok || !detailData.project) {
          throw new Error('Invalid project data')
        }

        // Store full project data for title/description display
        if (!cancelled) setDetailProject(detailData.project)

        const files = detailData.project.files || []

        if (files.length === 0) {
          if (!cancelled) {
            setDetailMedia([])
            setDetailError('No media found')
          }
          return
        }

        // Filter and sort media files
        const media = files
          .filter(f => f.file_type === 'image' || f.file_type === 'video')
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          .map(f => ({
            type: f.file_type,
            path: f.file_path || f.path
          }))
          .filter(m => m.path)

        if (!cancelled) {
          setDetailMedia(media)
          if (media.length === 0) {
            setDetailError('No media found')
          }
        }
      } catch (e) {
        console.error('Error loading project media:', e)
        if (!cancelled) {
          setDetailMedia([])
          setDetailError('No media found')
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [detailSlug])

  // Close detail when portrait emits the back event
  React.useEffect(() => {
    const onBack = () => closeDetail()
    window.addEventListener('detail-close', onBack)
    return () => window.removeEventListener('detail-close', onBack)
  }, [])

  // Auto-open detail when initialSlug is provided (deep link)
  const initialSlugHandled = React.useRef(false)
  React.useEffect(() => {
    if (initialSlugHandled.current) return
    if (!initialSlug || items.length === 0) return
    // If the detail is already open for this slug (user clicked a card, which
    // propagated onSlugChange → parent → back down as initialSlug), just mark
    // as handled. Skipping the timer avoids the 200ms-later duplicate openDetail
    // that would wipe the freshly-loaded state.
    if (detailSlug === initialSlug) {
      initialSlugHandled.current = true
      return
    }
    // Wait a tick for items to load from API (deep-link case)
    const timer = setTimeout(() => {
      if (!initialSlugHandled.current && initialSlug) {
        initialSlugHandled.current = true
        openDetail(initialSlug)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [initialSlug, items, detailSlug])

  // Handle URL changes from popstate (browser back/forward)
  React.useEffect(() => {
    if (initialSlugHandled.current && initialSlug === null && detailSlug) {
      // User went back to /work — close the detail
      closeDetail()
    } else if (initialSlugHandled.current && initialSlug && initialSlug !== detailSlug && !detailClosing) {
      // User navigated forward to a different project
      openDetail(initialSlug)
    }
  }, [initialSlug])

  // Position back button just above the portrait
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

  return (
    <div className="pointer-events-auto select-none relative">
      {/* Drag shader overlay: always mounted to avoid WebGL Canvas re-init flicker.
          Never toggle visibility — the detail overlay (z-14000) covers it naturally,
          and the paused prop stops GPU work when the detail is open. */}
      <DragShaderOverlay
        items={items}
        cardRefsMap={cardRefsMap}
        scrollVelocityRef={scrollVelocityRef}
        scrollerRef={scrollerRef}
        scrollbarOffsetRight={scrollbarOffsetRight}
        hoveredIdx={hoveredIdx}
        paused={detailVisible}
      />

      {/* Card list — natural scroll layout */}
      {/* Parent container already applies paddingTop for the marquee clearance,
          so we only need a small top margin here for breathing room */}
      <div
        ref={listRef}
        className="relative z-[12010] w-full pt-4 pb-28"
      >
        {items.map((it, idx) => (
          <section
            key={it.id || idx}
            className="py-8 sm:py-12 flex items-center justify-center px-6 sm:px-10"
          >
            <div
              className="relative w-full max-w-[min(90vw,860px)]"
              data-work-card
              data-work-card-i={idx}
              ref={(el) => { cardDomRefs.current[idx] = el }}
            >
              <WorkCard
                item={it}
                idx={idx}
                onEnter={onEnter}
                onMove={onMove}
                onLeave={onLeave}
                onOpenDetail={(slug) => openDetail(slug)}
                hideImage={!detailVisible}
                setHoveredIdx={setHoveredIdx}
              />
              {/* Babosa de slime oculta (#3) — pegada a UNA tarjeta. Reto: no se
                  anuncia cuál. */}
              {idx === 1 && (
                <SlimeSlugDOM id="work" size={30} className="absolute" style={{ top: '8px', right: '8px' }} />
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Hover tooltip */}
      {hover.active && (
        <div
          className="fixed z-[13060] pointer-events-none px-4 py-2 rounded-full bg-black/70 backdrop-blur-sm text-white text-sm font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-white/10"
          style={{ left: `${hover.x + 12}px`, top: `${hover.y + 12}px` }}
        >
          <span className="mr-1" aria-hidden>✨</span>{hover.title}
        </div>
      )}

      {/* Detail overlay (two-column: info left, media right) */}
      {(detailSlug || detailClosing || detailOpening) && (() => {
        // Resolve project info: prefer API detail data, fall back to items list
        const currentItem = items.find(it => it.slug === detailSlug) || {}
        const projTitle = detailProject?.title || currentItem.title || ''

        return (
          <div
            ref={detailOverlayRef}
            className={`fixed inset-0 z-[14000] bg-[#0a0510]/90 backdrop-blur-sm ${(!detailOpening && !detailClosing) ? 'pointer-events-auto' : 'pointer-events-none'} overflow-y-auto no-native-scrollbar transition-opacity ${detailOpening ? 'duration-600' : 'duration-300'} ease-out ${detailClosing || detailOpening ? 'opacity-0' : 'opacity-100'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={projTitle ? 'project-detail-title' : undefined}
            onClick={(e) => { if (e.target === e.currentTarget) closeDetail() }}
            onKeyDown={(e) => { if (e.key === 'Escape') closeDetail() }}
            tabIndex={-1}
          >
            <ProjectDetailArticle
              slug={detailSlug}
              project={detailProject}
              item={currentItem}
              media={detailMedia}
              loading={detailLoading}
              error={detailError}
            />
          </div>
        )
      })()}
    </div>
  )
}
