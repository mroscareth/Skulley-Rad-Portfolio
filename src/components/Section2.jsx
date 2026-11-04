import React, { Suspense } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { sanitizeHtmlNewTab } from '../lib/parseRichText.jsx'
import { slugToSection } from '../lib/sectionRouting.js'

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

  return (
    <div className="pointer-events-auto relative">
      {/* Floating 3D housebirds — decorative background layer */}
      <Suspense fallback={null}>
        <FloatingHousebirds scrollVelocityRef={scrollVelocityRef} />
      </Suspense>

      {/* Text content — parent container already applies paddingTop for marquee clearance */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pt-4 pb-10 text-black">
        <article className="about-copy space-y-7 copy-xl text-center" onClick={onClickEnlace}>
          {paragraphs.map(({ key, content }) => {
            // Content may contain inline HTML from TipTap (e.g. <strong>, <a>) —
            // pasa por DOMPurify antes del render para evitar XSS almacenado.
            const hasHtml = /<[a-z][\s\S]*?>/i.test(content)
            return hasHtml
              ? <p key={key} dangerouslySetInnerHTML={{ __html: sanitizeHtmlNewTab(content) }} />
              : <p key={key}>{content}</p>
          })}
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}