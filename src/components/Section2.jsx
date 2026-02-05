import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// About section: scrolleable content with a hero anchor where the Portrait will be portalized in hero mode
export default function Section2() {
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
      {/* Text content - offset to avoid overlapping the fixed marquee (14vw ≈ font-size del banner + margen) */}
      <div className="relative z-[10] max-w-[min(960px,92vw)] mx-auto px-4 sm:px-8 pb-10 text-black" style={{ paddingTop: 'clamp(100px, 15vw, 240px)' }}>
        <article className="space-y-7 copy-xl text-center">
          {paragraphs.map(({ key, content }) => (
            <p key={key}>{content}</p>
          ))}
        </article>
        <div className="h-24" />
      </div>
    </div>
  )
}