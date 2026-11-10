import React, { Suspense } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { sanitizeHtmlNewTab } from '../lib/parseRichText.jsx'
import { slugToSection } from '../lib/sectionRouting.js'
import { sectionColors } from '../lib/appHelpers.js'
import { runifyElement, splitRunes, whenRuneFontsReady } from '../lib/runeReveal.js'
import { irisIdle } from '../lib/irisTransition.js'

// Un enlace del About a una sección del sitio (/contact, /work…) cambia de
// sección como el menú: el evento navigate-section lo escuchan App (escritorio)
// y MobileApp (teléfono). Sin esto el navegador recargaba toda la página.
// Rutas con más camino (/work/arttoys) o con teclas de pestaña nueva siguen
// siendo un enlace normal.
function onClickEnlace(e) {
  const a = e.target.closest?.('a[href]')
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const href = a.getAttribute('href') || ''
  if (!/^\/(?!\/)/.test(href)) return
  const section = slugToSection[href.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '')]
  if (!section) return
  e.preventDefault()
  window.dispatchEvent(new CustomEvent('navigate-section', { detail: { section } }))
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// El About llega escrito en runas de SKULLEYGLYPH, como el preloader (pedido
// de Oscar, 2026-11-10): cada párrafo espera en runas hasta que se ve, ya sin
// la transición de entrada encima, y entonces letra por letra cada runa sube
// y se desvanece, y su letra aparece en su lugar (runeReveal). Los párrafos se
// pintan siempre con innerHTML: así React no pelea con las palabras que se
// envuelven aquí, y si cambia el texto lo vuelve a poner entero.
const RUNE_HOLD_MS = 450
const screenClear = () => irisIdle() && !document.querySelector('[data-section-preloader]')
function useRunicParagraphs(ref, key) {
  React.useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const ps = [...root.querySelectorAll(':scope > p')]
    const durs = new Map(ps.map((p) => { p.classList.add('rt-hold'); return [p, runifyElement(p)] }))
    let alive = true
    const timers = new Set()
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn() }, ms); timers.add(id) }
    whenRuneFontsReady().then(() => requestAnimationFrame(() => { if (alive) splitRunes(root) }))
    // En orden de lectura: cada párrafo arranca cuando el anterior va a la mitad.
    let nextAt = 0
    const reveal = (p) => {
      if (!screenClear()) return later(() => reveal(p), 200)
      const now = performance.now()
      const start = Math.max(now + RUNE_HOLD_MS, nextAt)
      nextAt = start + (durs.get(p) || 0) * 0.5
      later(() => p.classList.remove('rt-hold'), start - now)
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); reveal(e.target) }
    }, { threshold: 0.2 })
    ps.forEach((p) => io.observe(p))
    return () => { alive = false; io.disconnect(); timers.forEach(clearTimeout) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Lazy-load the 3D floating housebirds so they don't block the initial section render
const FloatingHousebirds = React.lazy(() => import('./FloatingHousebirds.jsx'))

// About section: scrolleable content with floating 3D housebirds background
export default function Section2({ scrollVelocityRef }) {
  const { t, lang } = useLanguage()
  const [dynamicContent, setDynamicContent] = React.useState(null)

  // Fetch dynamic content from API (with fallback to static translations)
  React.useEffect(() => {
    let cancelled = false
    async function fetchAbout() {
      try {
        const res = await fetch('/api/about.php')
        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        if (data.ok && data.about && !cancelled) {
          setDynamicContent(data.about)
        }
      } catch {
        // Silence errors — use static fallback
      }
    }
    fetchAbout()
    return () => { cancelled = true }
  }, [])

  // Helper: get paragraph text (dynamic or fallback)
  const getParagraph = (key) => {
    // First try dynamic content
    if (dynamicContent && dynamicContent[lang] && dynamicContent[lang][key]) {
      return dynamicContent[lang][key]
    }
    // Fallback to static translations
    const val = t(`about.${key}`)
    return (val && val !== `about.${key}`) ? val : null
  }

  // Generate paragraph list (p1-p10)
  const paragraphs = []
  for (let i = 1; i <= 10; i++) {
    const content = getParagraph(`p${i}`)
    if (content) {
      paragraphs.push({ key: `p${i}`, content })
    }
  }
  const contentKey = paragraphs.map((p) => p.content).join('\u0000')
  // El mismo objeto mientras no cambie el texto: React 19 vuelve a escribir el
  // innerHTML cada vez que recibe un objeto nuevo y se llevaba las runas.
  // Content may contain inline HTML from TipTap (e.g. <strong>, <a>) —
  // pasa por DOMPurify antes del render para evitar XSS almacenado.
  const items = React.useMemo(() => paragraphs.map(({ key, content }) => ({
    key,
    html: { __html: /<[a-z][\s\S]*?>/i.test(content) ? sanitizeHtmlNewTab(content) : escapeHtml(content) },
  })), [contentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const articleRef = React.useRef(null)
  useRunicParagraphs(articleRef, contentKey)

  return (
    <div className="pointer-events-auto relative" style={{ '--about-bg': sectionColors.section2 }}>
      {/* Floating 3D housebirds — decorative background layer */}
      <Suspense fallback={null}>
        <FloatingHousebirds scrollVelocityRef={scrollVelocityRef} />
      </Suspense>

      {/* Text content — parent container already applies paddingTop for marquee clearance */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pt-4 pb-10 text-black">
        <article ref={articleRef} className="about-copy rt-calm space-y-7 copy-xl text-center" onClick={onClickEnlace}>
          {items.map(({ key, html }) => <p key={key} dangerouslySetInnerHTML={html} />)}
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}