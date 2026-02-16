import React from 'react'
import Lenis from 'lenis'
import WorkDotsIndicator from './WorkDotsIndicator.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import DragShaderOverlay from './DragShaderOverlay.jsx'
import parseRichText, { truncateRichText } from '../lib/parseRichText.jsx'

// Fallback: static projects in case the API fails
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
 * Transform an API project into the format expected by the component
 */
function transformApiProject(project) {
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
    // Additional fields for dynamic translations
    description_en: project.description_en,
    description_es: project.description_es,
    // Per-project link button
    link_url: project.link_url || null,
    link_text_en: project.link_text_en || null,
    link_text_es: project.link_text_es || null,
  }
}

// Utility to preload images from the CTA preload
export function getWorkImageUrls() {
  try {
    // One local asset is enough (cached by the browser)
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}

export default function Section1({ scrollerRef, scrollbarOffsetRight = 0, scrollVelocityRef, lenisRef }) {
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

  // Active index for dot indicator
  const [activeIdx, setActiveIdx] = React.useState(0)

  // Card DOM refs for shader overlay sync
  const cardDomRefs = React.useRef([])
  const cardRefsMap = React.useMemo(() => new Map(), [])

  // Keep card DOM rects updated for the shader overlay
  React.useEffect(() => {
    let raf
    const update = () => {
      try {
        for (let i = 0; i < items.length; i++) {
          const el = cardDomRefs.current[i]
          if (!el) continue
          let ref = cardRefsMap.get(i)
          if (!ref) {
            ref = { current: null }
            cardRefsMap.set(i, ref)
          }
          ref.current = el.getBoundingClientRect()
        }
      } catch { }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [items, cardRefsMap])

  // Track active index from scroll position
  React.useEffect(() => {
    const scroller = scrollerRef?.current
    if (!scroller) return
    const onScroll = () => {
      try {
        const cards = cardDomRefs.current.filter(Boolean)
        if (!cards.length) return
        const sRect = scroller.getBoundingClientRect()
        const viewCenter = scroller.scrollTop + scroller.clientHeight / 2
        let bestIdx = 0
        let bestD = Infinity
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i].getBoundingClientRect()
          const c = scroller.scrollTop + (r.top - sRect.top) + r.height / 2
          const d = Math.abs(c - viewCenter)
          if (d < bestD) { bestD = d; bestIdx = i }
        }
        setActiveIdx(bestIdx)
      } catch { }
    }
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      try { scroller.removeEventListener('scroll', onScroll) } catch { }
      window.removeEventListener('resize', onScroll)
    }
  }, [scrollerRef, items.length])

  // Measure card width to position dots indicator
  React.useEffect(() => {
    const measure = () => {
      try {
        const firstCard = cardDomRefs.current[0]
        if (!firstCard) return
        const rect = firstCard.getBoundingClientRect()
        const vw = Math.max(1, window.innerWidth || rect.right)
        const right = Math.round(((vw - rect.width) / 2) - 36 - (scrollbarOffsetRight || 0))
        setIndicatorRight(Math.max(8, right))
      } catch { }
    }
    measure()
    const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(measure) : null
    if (ro && listRef.current) ro.observe(listRef.current)
    window.addEventListener('resize', measure)
    const timer = setTimeout(measure, 60)
    return () => {
      if (ro && listRef.current) ro.unobserve(listRef.current)
      window.removeEventListener('resize', measure)
      clearTimeout(timer)
    }
  }, [scrollbarOffsetRight, items.length])

  const [indicatorRight, setIndicatorRight] = React.useState(16)

  const scrollToIndex = (i) => {
    try {
      const el = cardDomRefs.current[i]
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch { }
  }

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
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
    setDetailClosing(false)
    setDetailOpening(true)
    setDetailProject(null)
    setDetailMedia([])
    setDetailError('')
    setDetailSlug(slug)
    // Allow the grid to fade-out before starting the slower overlay fade-in
    openTimerRef.current = setTimeout(() => { setDetailOpening(false); openTimerRef.current = null }, 380)
    try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'back' } })) } catch { }
    try { window.dispatchEvent(new CustomEvent('detail-open')) } catch { }
  }
  const closeDetail = () => {
    if (detailClosing) return
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null }
    setDetailClosing(true)
    // Immediately re-enable grid interaction
    setDetailSlug(null)
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
              className="w-full max-w-[min(90vw,860px)]"
              data-work-card
              data-work-card-i={idx}
              ref={(el) => { cardDomRefs.current[idx] = el }}
            >
              <Card
                item={it}
                idx={idx}
                onEnter={onEnter}
                onMove={onMove}
                onLeave={onLeave}
                onOpenDetail={(slug) => openDetail(slug)}
                hideImage={!detailVisible}
                setHoveredIdx={setHoveredIdx}
              />
            </div>
          </section>
        ))}
      </div>

      {/* Vertical dot indicator */}
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
        const projDesc = (lang === 'es'
          ? (detailProject?.description_es || currentItem.description_es)
          : (detailProject?.description_en || currentItem.description_en)) || ''
        const projUrl = detailProject?.external_url || currentItem.url || ''
        // Per-project link button
        const projLinkUrl = detailProject?.link_url || currentItem.link_url || ''
        const projLinkText = (lang === 'es'
          ? (detailProject?.link_text_es || currentItem.link_text_es)
          : (detailProject?.link_text_en || currentItem.link_text_en)) || ''

        return (
          <div
            ref={detailOverlayRef}
            className={`fixed inset-0 z-[14000] bg-black/80 backdrop-blur-sm ${(!detailOpening && !detailClosing) ? 'pointer-events-auto' : 'pointer-events-none'} overflow-y-auto no-native-scrollbar transition-opacity ${detailOpening ? 'duration-600' : 'duration-300'} ease-out ${detailClosing || detailOpening ? 'opacity-0' : 'opacity-100'}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => { if (e.target === e.currentTarget) closeDetail() }}
            onKeyDown={(e) => { if (e.key === 'Escape') closeDetail() }}
            tabIndex={-1}
          >
            <div
              className="mx-auto w-[min(1280px,94vw)] pt-6 sm:pt-8 pb-8 sm:pb-12"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Two-column layout: info (left) + media gallery (right) */}
              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

                {/* Left column — title, description, link (sticky on desktop) */}
                <div className="lg:w-[25%] shrink-0 lg:sticky lg:top-8 lg:self-start space-y-5 px-1">
                  {projTitle && (
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
                      {projTitle}
                    </h2>
                  )}
                  {projDesc && (
                    <div className="text-white/70 text-base sm:text-lg leading-relaxed" style={{ maxWidth: '52ch' }}>
                      {parseRichText(projDesc)}
                    </div>
                  )}
                  {projUrl && (
                    <a
                      href={projUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-blue-400 border border-blue-500/40 rounded hover:border-blue-400 hover:text-blue-300 hover:shadow-[0_0_18px_rgba(59,130,246,0.35)] transition-all duration-200"
                      style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace', textShadow: '0 0 8px rgba(59, 130, 246, 0.4)' }}
                    >
                      <span>&gt;_ {t('work.visitSite') || 'Visit site'}</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                    </a>
                  )}
                  {projLinkUrl && (
                    <a
                      href={projLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-blue-400 border border-blue-500/40 rounded hover:border-blue-400 hover:text-blue-300 hover:shadow-[0_0_18px_rgba(59,130,246,0.35)] transition-all duration-200"
                      style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace', textShadow: '0 0 8px rgba(59, 130, 246, 0.4)' }}
                    >
                      <span>&gt;_ {projLinkText || t('work.visitWebsite') || 'Visit website'}</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
                    </a>
                  )}
                </div>

                {/* Right column — media gallery */}
                <div className="lg:w-[75%] space-y-6">
                  {detailLoading && (<div className="text-center text-white/80 copy-base py-12">{t('common.loading')}</div>)}
                  {!detailLoading && detailError && (<div className="text-center text-white/80 copy-base py-12">{detailError}</div>)}
                  {!detailLoading && !detailError && detailMedia.length === 0 && (
                    <div className="text-center text-white/80 copy-base py-12">{t('common.noImages')}</div>
                  )}
                  {detailMedia.map((media, i) => {
                    // Build correct URL - avoid double slashes
                    const mediaPath = media.path?.startsWith('/') ? media.path.slice(1) : media.path
                    const mediaUrl = `${import.meta.env.BASE_URL}${mediaPath}`

                    return media.type === 'video' ? (
                      <div key={`${media.path}-${i}`} className="relative w-full rounded-lg overflow-hidden shadow-lg bg-black">
                        <video
                          src={mediaUrl}
                          className="w-full h-auto max-h-[80vh] mx-auto"
                          controls
                          playsInline
                          preload="auto"
                          controlsList="nodownload"
                          onError={(e) => {
                            console.error('Video load error:', mediaUrl, e)
                          }}
                        >
                          {/* Fallback sources for better compatibility */}
                          <source src={mediaUrl} type="video/mp4" />
                          <source src={mediaUrl} type="video/webm" />
                          <p className="text-white/60 p-4">
                            Tu navegador no soporta este formato de video.
                            <a href={mediaUrl} className="text-cyan-400 ml-2 underline" target="_blank" rel="noopener noreferrer">
                              Descargar video
                            </a>
                          </p>
                        </video>
                      </div>
                    ) : (
                      <img
                        key={`${media.path}-${i}`}
                        src={mediaUrl}
                        alt={t('common.imageAlt', { n: i + 1 })}
                        className="w-full h-auto block rounded-lg shadow-lg"
                        loading="lazy"
                        decoding="async"
                      />
                    )
                  })}
                  <div className="h-8" />
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}


// ── Card component (no tilt, no rounded corners, no shadows) ──────────────
// Darkening on hover is handled by the shader (uHover uniform).
// Text overlay here has NO background — it floats on top of the
// shader-darkened image, so the deformation stays consistent.

function Card({ item, idx, onEnter, onMove, onLeave, onOpenDetail, hideImage, setHoveredIdx }) {
  const { t, lang } = useLanguage()
  const slug = item?.slug
  const isGallery = !item.url // Gallery project if no external URL

  // Always use dynamic data from API if available
  // Fall back to static translations only if API data is empty
  const dynamicTitle = item.title || ''
  const dynamicDesc = (lang === 'es' ? item.description_es : item.description_en) || ''

  // Use dynamic data first, then fallback to static translations for known slugs
  let overlayTitle = dynamicTitle
  let overlayDesc = dynamicDesc

  // Only use static fallback if dynamic data is empty (for backwards compatibility)
  if (!overlayDesc) {
    const staticKey = `work.items.${slug}`
    const staticDesc = t(`${staticKey}.desc`)
    if (staticDesc && staticDesc !== `${staticKey}.desc`) {
      overlayDesc = staticDesc
    }
  }

  // Truncate description for hover card (~120 visible characters)
  const hoverExcerpt = overlayDesc ? truncateRichText(overlayDesc, 120) : ''

  const handleClick = () => {
    if (typeof onOpenDetail !== 'function') return
    if (isGallery && slug) {
      onOpenDetail(slug)
    }
  }

  const handleEnter = (e) => {
    setHoveredIdx(idx)
    onEnter(e, item)
  }
  const handleLeave = () => {
    setHoveredIdx(-1)
    onLeave()
  }

  return (
    <div
      className="group mx-auto w-full max-w-[min(90vw,860px)] aspect-[5/3] overflow-hidden relative cursor-pointer"
      onMouseEnter={handleEnter}
      onMouseMove={(e) => { onMove(e) }}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      {/* Image: hidden when shader overlay is active to avoid double rendering */}
      <img
        src={item.image}
        alt={item.title}
        className={`w-full h-full object-cover block transition-opacity duration-200 ${hideImage ? 'opacity-0' : 'opacity-100'}`}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      {/* External link icon is now rendered inside the WebGL shader (DragShaderOverlay) */}
      {/* Hover text overlay — NO background (shader handles darkening) */}
      {overlayTitle && (
        <div
          className="pointer-events-none absolute inset-0 z-[2] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out flex items-center justify-center text-center px-6"
          aria-hidden
        >
          <div>
            <h3 className="text-white heading-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">{overlayTitle}</h3>
            {hoverExcerpt && (
              <div
                className="mt-2 text-white/90 copy-base drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
                style={{ maxWidth: '52ch', marginLeft: 'auto', marginRight: 'auto' }}
              >
                {parseRichText(hoverExcerpt)}
              </div>
            )}
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
