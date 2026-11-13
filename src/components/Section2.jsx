import React, { Suspense } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { sanitizeHtmlNewTab } from '../lib/parseRichText.jsx'
import { slugToSection } from '../lib/sectionRouting.js'
import { sectionColors } from '../lib/appHelpers.js'
import { runifyElement, revealRunesCanvas, whenRuneFontsReady } from '../lib/runeReveal.js'
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
// y se apaga y su letra aparece (runeReveal). Las runas del párrafo se van en
// un solo canvas (revealRunesCanvas: con una copia por letra se congelaba y
// bajaba de 240 a ~60–100 cuadros por segundo), los párrafos van uno a la vez
// y al terminar cada uno regresa a su HTML de siempre.
// Tampoco arranca antes de que llegue el texto del CMS (`readyRef`): si
// llegaba a medio revelado, el párrafo regresaba a runas y empezaba de nuevo.
const RUNE_HOLD_MS = 450
// Más rápido que el preloader (Oscar, 2026-11-11: "es demasiado lento"): el
// doble de letras por segundo y cada runa se va en menos tiempo.
const RUNE_REVEAL = { perSecond: 240, letterMs: 500 }
const screenClear = () => irisIdle() && !document.querySelector('[data-section-preloader]')
function useRunicParagraphs(ref, key, readyRef) {
  React.useEffect(() => {
    const root = ref.current
    if (!root || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const ps = [...root.querySelectorAll(':scope > p')]
    const originals = new Map(ps.map((p) => [p, p.innerHTML]))
    const durs = new Map(ps.map((p) => { p.classList.add('rt-hold'); return [p, runifyElement(p, RUNE_REVEAL)] }))
    let alive = true
    const timers = new Set()
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn() }, ms); timers.add(id) }
    // Solo si el párrafo todavía trae las runas: cuando llega el texto del CMS,
    // React ya puso el HTML nuevo antes de esta limpieza, y regresar el viejo
    // lo tapaba (en vivo se quedaba el texto de respaldo, sin sus enlaces).
    const restore = (p) => { p.classList.remove('rt-hold', 'rt-reveal', 'rt-reveal-words'); if (p.isConnected && p.querySelector('.rt-word')) p.innerHTML = originals.get(p) }
    const stops = new Set()
    // En orden de lectura, uno a la vez: el siguiente arranca cuando el anterior
    // casi termina, para que nunca haya dos párrafos animándose completos.
    // Las fuentes se esperan una vez, antes de programar: esperarlas a la hora
    // de cada párrafo (document.fonts.ready espera a cualquier fuente de la
    // página) soltaba juntos a todos los que vencían mientras tanto.
    let fontsReady = false
    whenRuneFontsReady().then(() => { fontsReady = true })
    let nextAt = 0
    const reveal = (p) => {
      if (!screenClear() || !readyRef.current || !fontsReady) return later(() => reveal(p), 200)
      const now = performance.now()
      const start = Math.max(now + RUNE_HOLD_MS, nextAt)
      nextAt = start + durs.get(p) * 0.85
      later(() => {
        const stop = revealRunesCanvas(p, { onEnd: () => { stops.delete(stop); restore(p) } })
        stops.add(stop)
      }, start - now)
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); reveal(e.target) }
    }, { threshold: 0.2 })
    ps.forEach((p) => io.observe(p))
    return () => { alive = false; io.disconnect(); timers.forEach(clearTimeout); stops.forEach((stop) => stop()); ps.forEach(restore) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
}

// Lazy-load the 3D floating housebirds so they don't block the initial section render
const FloatingHousebirds = React.lazy(() => import('./FloatingHousebirds.jsx'))

// About section: scrolleable content with floating 3D housebirds background
export default function Section2({ scrollVelocityRef }) {
  const { t, lang } = useLanguage()
  const [dynamicContent, setDynamicContent] = React.useState(null)
  // Las runas esperan al CMS, pero no más de 2 s: un API lento no las deja quietas.
  const contentReadyRef = React.useRef(false)

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
      } finally {
        contentReadyRef.current = true
      }
    }
    fetchAbout()
    const giveUp = setTimeout(() => { contentReadyRef.current = true }, 2000)
    return () => { cancelled = true; clearTimeout(giveUp) }
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
  // Siempre innerHTML y el mismo objeto mientras no cambie el texto: React 19
  // reescribe el innerHTML cada vez que recibe un objeto nuevo y se llevaba
  // las runas a medio revelar.
  // Content may contain inline HTML from TipTap (e.g. <strong>, <a>) —
  // pasa por DOMPurify antes del render para evitar XSS almacenado.
  const items = React.useMemo(() => paragraphs.map(({ key, content }) => ({
    key,
    html: { __html: /<[a-z][\s\S]*?>/i.test(content) ? sanitizeHtmlNewTab(content) : escapeHtml(content) },
  })), [contentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const articleRef = React.useRef(null)
  useRunicParagraphs(articleRef, contentKey, contentReadyRef)

  return (
    <div className="pointer-events-auto relative" style={{ '--about-bg': sectionColors.section2 }}>
      {/* Floating 3D housebirds — decorative background layer */}
      <Suspense fallback={null}>
        <FloatingHousebirds scrollVelocityRef={scrollVelocityRef} />
      </Suspense>

      {/* Text content — parent container already applies paddingTop for marquee clearance */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pt-4 pb-10 text-black">
        {/* El título visible es el marquee; este es el H1 que lee Google. */}
        <h1 className="sr-only">
          {lang === 'es'
            ? 'Sobre Oscar Moctezuma, diseñador gráfico, ilustrador y artista 3D'
            : 'About Oscar Moctezuma, graphic designer, illustrator and 3D artist'}
        </h1>
        <article ref={articleRef} className="about-copy space-y-7 copy-xl text-center" onClick={onClickEnlace}>
          {items.map(({ key, html }) => <p key={key} dangerouslySetInnerHTML={html} />)}
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}