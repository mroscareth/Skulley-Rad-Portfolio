import React from 'react'
import Lenis from 'lenis'
import { ArrowTopRightOnSquareIcon, LinkIcon, CheckIcon, ShareIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import DragShaderOverlay from './DragShaderOverlay.jsx'
import parseRichText from '../lib/parseRichText.jsx'
import WorkCard, { transformApiProject } from './work/WorkCard.jsx'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'

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
        const projDesc = (lang === 'es'
          ? (detailProject?.description_es || currentItem.description_es)
          : (detailProject?.description_en || currentItem.description_en)) || ''
        const projUrl = detailProject?.external_url || currentItem.url || ''
        // Per-project link button
        const projLinkUrl = detailProject?.link_url || currentItem.link_url || ''
        const projLinkText = (lang === 'es'
          ? (detailProject?.link_text_es || currentItem.link_text_es)
          : (detailProject?.link_text_en || currentItem.link_text_en)) || ''
        const behanceBadges = [
          ...(detailProject?.behance_badges || []),
          ...(currentItem.behance_badges || []),
        ].filter((v, i, a) => a.indexOf(v) === i) // deduplicate

        // Map badge codes to image filenames
        const BADGE_MAP = {
          be: 'behanceFeatured.png',
          il: 'illustration.png',
          pd: 'productDesign.png',
          gr: 'graphicDesign.png',
          '3d': '3D.png',
          ps: 'photoshop.png',
        }

        const badgeImgs = behanceBadges.filter((code) => BADGE_MAP[code])

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
            {/* Ficha arriba y galería abajo, a todo el ancho. Antes el texto
                vivía en una columna del 25% (259 px a 1100 px de ancho, ~29
                letras por renglón) y el título chocaba con los botones fijos.
                El padding de arriba deja libres el botón de regresar y el
                carrito; el de abajo, la música y el menú. */}
            <article
              className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10 pt-20 md:pt-28 pb-32"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-16">
                <div className="min-w-0">
                  {projTitle && (
                    <h2 id="project-detail-title" className="text-[clamp(2.25rem,6vw,3.75rem)] font-bold text-white leading-[1.05] tracking-tight">
                      {projTitle}
                    </h2>
                  )}
                  {projDesc && (
                    <div className="mt-6 max-w-[62ch] text-white/75 text-[1.0625rem] sm:text-lg leading-[1.7] [&_p+p]:mt-4 [&_p:empty]:hidden [&_strong]:text-white [&_strong]:font-semibold [&_a]:text-section-work [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1">
                      {parseRichText(projDesc)}
                    </div>
                  )}
                </div>

                {/* Acciones en un solo renglón y a la misma altura: compartir
                    como íconos y la principal de color al final (DESIGN.md
                    §4.6). En escritorio, a la derecha del título; en móvil,
                    debajo del texto, alineadas a la derecha. */}
                {detailSlug && (
                  <ProjectActions
                    slug={detailSlug}
                    title={projTitle}
                    primaryUrl={projUrl || projLinkUrl}
                    primaryText={projUrl ? (lang === 'es' ? 'Visitar sitio' : 'Visit site') : (projLinkText || t('work.visitWebsite') || 'Visit website')}
                    secondaryUrl={projUrl && projLinkUrl ? projLinkUrl : ''}
                    secondaryText={projLinkText || t('work.visitWebsite') || 'Visit website'}
                  />
                )}
              </header>

              {/* Galería: cada pieza a todo el ancho, una por renglón. Las
                  insignias de Behance salen al ras del borde de arriba de la primera
                  pieza, a la derecha. */}
              <div className="relative mt-10 sm:mt-14 space-y-6 sm:space-y-8">
                {badgeImgs.length > 0 && (
                  <div className="absolute top-0 right-4 sm:right-[30px] z-10 flex flex-row-reverse gap-[10px]" style={{ animation: 'fadeIn 0.6s ease 0.4s both' }}>
                    {[...badgeImgs].reverse().map((code) => (
                      <img
                        key={code}
                        src={`${import.meta.env.BASE_URL}${BADGE_MAP[code]}`}
                        alt={`Behance ${code}`}
                        className="w-8 sm:w-9 lg:w-10 h-auto pointer-events-none"
                      />
                    ))}
                  </div>
                )}
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
                    <div key={`${media.path}-${i}`} className="relative w-full rounded-xl overflow-hidden bg-black">
                      <video
                        src={mediaUrl}
                        className="w-full h-auto max-h-[85vh] mx-auto"
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
                          <a href={mediaUrl} className="text-section-work ml-2 underline" target="_blank" rel="noopener noreferrer">
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
                      className="w-full h-auto block rounded-xl"
                      loading="lazy"
                      decoding="async"
                    />
                  )
                })}
              </div>
            </article>
          </div>
        )
      })()}
    </div>
  )
}


// ── Acciones del proyecto: compartir + link del proyecto ───────────────
// Mismo alto para todas (44 px): compartir como íconos (borde 2px, plano,
// el hover invierte a blanco, patrón de OrderStatusModal) y el link del
// proyecto como pill de color al final. Nunca a todo lo ancho.
const SHARE_BTN = 'w-11 h-11 grid place-items-center rounded-full border-2 border-white/25 text-white/85 hover:bg-white hover:text-black hover:border-white active:scale-95 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-work'
const LINK_BTN = 'shop-btn min-h-11 px-6 text-xs gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-work'

function ProjectActions({ slug, title, primaryUrl, primaryText, secondaryUrl, secondaryText }) {
  const { t, lang } = useLanguage()
  const es = lang === 'es'
  const [copied, setCopied] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const shareWrapRef = React.useRef(null)
  const shareBtnRef = React.useRef(null)

  const projectUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return ''
    const base = import.meta.env.BASE_URL || '/'
    return `${window.location.origin}${base}work/${slug}`
  }, [slug])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }

  const shareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(projectUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500')
  }

  const shareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(projectUrl)}`
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=500')
  }

  const shareWhatsApp = () => {
    const text = title ? `${title} ${projectUrl}` : projectUrl
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  // En celular los tres íconos no caben junto al botón principal sin
  // empujarlo a otro renglón: ahí va uno solo. Abre el menú de compartir del
  // teléfono; donde el navegador no lo tiene (Brave, varios navegadores
  // dentro de apps), despliega el nuestro con las mismas opciones.
  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || undefined, url: projectUrl })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    setMenuOpen((v) => !v)
  }

  React.useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (shareWrapRef.current && !shareWrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const pick = (fn) => () => {
    fn()
    setMenuOpen(false)
    shareBtnRef.current?.focus()
  }

  const copiedLabel = t('common.copied')
  const copyLabel = copied ? copiedLabel : (es ? 'Copiar enlace' : 'Copy link')
  const shareLabel = copied ? copiedLabel : (es ? 'Compartir' : 'Share')

  return (
    <div className="mt-8 lg:mt-2 flex flex-wrap items-center justify-end gap-2" aria-label={title ? `${title}: ${es ? 'compartir y enlaces' : 'share and links'}` : undefined} role="group">
      <div
        ref={shareWrapRef}
        className="relative sm:hidden"
        onKeyDown={(e) => {
          // Escape cierra el menú, no la ficha entera.
          if (e.key === 'Escape' && menuOpen) {
            e.stopPropagation()
            setMenuOpen(false)
            shareBtnRef.current?.focus()
          }
        }}
      >
        <button
          ref={shareBtnRef}
          type="button"
          onClick={onShare}
          aria-label={shareLabel}
          title={shareLabel}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`${SHARE_BTN} ${copied ? '!border-section-work !text-section-work' : ''} ${menuOpen ? '!bg-white !text-black !border-white' : ''}`}
        >
          {copied ? <CheckIcon className="w-4 h-4" aria-hidden="true" /> : <ShareIcon className="w-4 h-4" aria-hidden="true" />}
        </button>
        {menuOpen && (
          <div role="menu" aria-label={shareLabel} className="absolute left-0 top-full mt-2 z-20 w-56 rounded-2xl border-2 border-white/15 bg-[#0d0714] p-1.5">
            {[
              { label: copyLabel, Icon: LinkIcon, fn: copyLink },
              { label: 'WhatsApp', icon: 'M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 01-4.8-1.32l-.34-.2-3.56.94.95-3.47-.22-.36A9.43 9.43 0 012.6 12c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.98 6.68 2.77A9.38 9.38 0 0121.5 12c0 5.2-4.24 9.5-9.45 9.5zm8.04-17.54A11.3 11.3 0 0012.05.66C5.8.66.7 5.75.7 12c0 2 .52 3.95 1.52 5.67L.6 23.34l5.8-1.52a11.3 11.3 0 005.64 1.44h.01c6.26 0 11.35-5.09 11.35-11.34 0-3.03-1.18-5.88-3.32-8.02z', fn: shareWhatsApp },
              { label: 'LinkedIn', icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z', fn: shareLinkedIn },
              { label: 'Facebook', icon: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', fn: shareFacebook },
            ].map(({ label, Icon, icon, fn }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={pick(fn)}
                className="w-full min-h-11 flex items-center gap-3 px-3 rounded-xl text-left text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-section-work"
              >
                {Icon
                  ? <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  : <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d={icon} /></svg>}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={copyLink}
        aria-label={copyLabel}
        title={copyLabel}
        className={`${SHARE_BTN} max-sm:!hidden ${copied ? '!border-section-work !text-section-work hover:!text-black' : ''}`}
      >
        {copied ? <CheckIcon className="w-4 h-4" aria-hidden="true" /> : <LinkIcon className="w-4 h-4" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={shareLinkedIn}
        aria-label={es ? 'Compartir en LinkedIn' : 'Share on LinkedIn'}
        title="LinkedIn"
        className={`${SHARE_BTN} max-sm:!hidden`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </button>

      <button
        type="button"
        onClick={shareFacebook}
        aria-label={es ? 'Compartir en Facebook' : 'Share on Facebook'}
        title="Facebook"
        className={`${SHARE_BTN} max-sm:!hidden`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </button>

      {secondaryUrl && (
        <a href={secondaryUrl} target="_blank" rel="noopener noreferrer" className={`${LINK_BTN} shop-btn--ghost`}>
          <span>{secondaryText}</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
        </a>
      )}
      {primaryUrl && (
        <a href={primaryUrl} target="_blank" rel="noopener noreferrer" className={`${LINK_BTN} bg-section-work text-[#0a0510] hover:bg-[#5cd6ff]`}>
          <span>{primaryText}</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
        </a>
      )}

      <span role="status" aria-live="polite" className="sr-only">{copied ? copiedLabel : ''}</span>
    </div>
  )
}
