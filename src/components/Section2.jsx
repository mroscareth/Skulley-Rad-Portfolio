import React from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'

// About section: scrolleable content with a hero anchor where the Portrait will be portalized in hero mode
export default function Section2() {
  const { t, lang } = useLanguage()
  const [dynamicContent, setDynamicContent] = React.useState(null)

  // Fetch contenido dinámico desde la API (con fallback a traducciones estáticas)
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
        // Silenciar errores - usar fallback estático
      }
    }
    fetchAbout()
    return () => { cancelled = true }
  }, [])

  // Helper: obtener texto de párrafo (dinámico o fallback)
  const getParagraph = (key) => {
    // Primero intentar contenido dinámico
    if (dynamicContent && dynamicContent[lang] && dynamicContent[lang][key]) {
      return dynamicContent[lang][key]
    }
    // Fallback a traducciones estáticas
    const val = t(`about.${key}`)
    return (val && val !== `about.${key}`) ? val : null
  }

  // Generar lista de párrafos (p1-p10)
  const paragraphs = []
  for (let i = 1; i <= 10; i++) {
    const content = getParagraph(`p${i}`)
    if (content) {
      paragraphs.push({ key: `p${i}`, content })
    }
  }

  return (
    <div className="pointer-events-auto relative">
      {/* Text content - offset para no solaparse con el marquee fixed (14vw ≈ font-size del banner + margen) */}
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