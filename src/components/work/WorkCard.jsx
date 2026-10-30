import React from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import parseRichText, { truncateRichText } from '../../lib/parseRichText.jsx'

// La tarjeta de un proyecto de Work, aparte de Section1 para que la home de
// teléfono la use sin cargar la sección entera (Lenis, el shader de arrastre).

/**
 * Transform an API project into the format expected by the component
 */
export function transformApiProject(project) {
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
    behance_badges: Array.isArray(project.behance_badges) ? project.behance_badges : [],
  }
}

// ── Card component (no tilt, no rounded corners, no shadows) ──────────────
// Darkening on hover is handled by the shader (uHover uniform).
// Text overlay here has NO background — it floats on top of the
// shader-darkened image, so the deformation stays consistent.

export default function WorkCard({ item, idx, onEnter, onMove, onLeave, onOpenDetail, hideImage, setHoveredIdx }) {
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
      className="group mx-auto w-full max-w-[min(90vw,860px)] aspect-[5/3] overflow-hidden rounded-xl relative cursor-pointer"
      role="button"
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
