import React from 'react'
import { ArrowTopRightOnSquareIcon, LinkIcon, CheckIcon, ShareIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import parseRichText from '../../lib/parseRichText.jsx'

// Los colores de la ficha. `oscuro`: sobre el overlay de tinta de Work, con el
// azul de la sección de acento. `color`: sobre el azul de la sección (la
// página aparte de la versión rápida, pedido de Oscar); ahí el par se invierte
// como en .msh-btn--sobre-color: texto y relleno en tinta, y el azul en las
// letras del botón principal.
const TONOS = {
  oscuro: {
    titulo: 'text-white',
    texto: 'text-white/75 [&_strong]:text-white [&_a]:text-section-work',
    aviso: 'text-white/80',
    respaldo: 'text-white/60',
    enlace: 'text-section-work',
    icono: 'border-white/25 text-white/85 hover:bg-white hover:text-black hover:border-white focus-visible:outline-section-work',
    copiado: '!border-section-work !text-section-work',
    copiadoHover: 'hover:!text-black',
    menuAbierto: '!bg-white !text-black !border-white',
    secundario: 'shop-btn--ghost focus-visible:outline-section-work',
    principal: 'bg-section-work text-[#0a0510] hover:bg-[#5cd6ff] focus-visible:outline-section-work',
  },
  color: {
    titulo: 'text-[#0a0510]',
    texto: 'text-[#0a0510]/80 [&_strong]:text-[#0a0510] [&_a]:text-[#0a0510]',
    aviso: 'text-[#0a0510]/75',
    respaldo: 'text-[#0a0510]/70',
    enlace: 'text-[#0a0510]',
    icono: 'border-[#0a0510]/30 text-[#0a0510] hover:bg-[#0a0510] hover:text-section-work hover:border-[#0a0510] focus-visible:outline-[#0a0510]',
    copiado: '!border-[#0a0510] !bg-[#0a0510] !text-section-work',
    copiadoHover: '',
    menuAbierto: '!bg-[#0a0510] !text-section-work !border-[#0a0510]',
    secundario: 'border-[#0a0510]/30 text-[#0a0510] hover:border-[#0a0510] focus-visible:outline-[#0a0510]',
    principal: 'bg-[#0a0510] text-section-work hover:bg-[#241a30] focus-visible:outline-[#0a0510]',
  },
}

// La ficha de un proyecto (título, texto, acciones y galería). La pinta el
// detalle de Work (Section1, dentro de su overlay) y la versión rápida de
// escritorio, que abre el proyecto aparte sin pasar por Work (QuickProject).
// Cada uno trae sus datos: Section1 con sus estados, la rápida con
// useProjectDetail.
export function ProjectDetailArticle({
  slug: detailSlug,
  project: detailProject = null,
  item: currentItem = {},
  media: detailMedia = [],
  loading: detailLoading = false,
  error: detailError = '',
  sobreColor = false,
}) {
  const { t, lang } = useLanguage()
  const tono = TONOS[sobreColor ? 'color' : 'oscuro']
  // Resolve project info: prefer API detail data, fall back to items list
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

  // Ficha arriba y galería abajo, a todo el ancho. Antes el texto vivía en
  // una columna del 25% (259 px a 1100 px de ancho, ~29 letras por renglón) y
  // el título chocaba con los botones fijos. El padding de arriba deja libres
  // el botón de regresar y el carrito; el de abajo, la música y el menú.
  return (
    <article
      className="mx-auto w-full max-w-[1200px] px-5 sm:px-8 lg:px-10 pt-20 md:pt-28 pb-32"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-16">
        <div className="min-w-0">
          {projTitle && (
            <h2 id="project-detail-title" className={`text-[clamp(2.25rem,6vw,3.75rem)] font-bold ${tono.titulo} leading-[1.05] tracking-tight`}>
              {projTitle}
            </h2>
          )}
          {projDesc && (
            <div className={`mt-6 max-w-[62ch] ${tono.texto} text-[1.0625rem] sm:text-lg leading-[1.7] [&_p+p]:mt-4 [&_p:empty]:hidden [&_strong]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-1`}>
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
            tono={tono}
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
        {detailLoading && (<div className={`text-center ${tono.aviso} copy-base py-12`}>{t('common.loading')}</div>)}
        {!detailLoading && detailError && (<div className={`text-center ${tono.aviso} copy-base py-12`}>{detailError}</div>)}
        {!detailLoading && !detailError && detailMedia.length === 0 && (
          <div className={`text-center ${tono.aviso} copy-base py-12`}>{t('common.noImages')}</div>
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
                <p className={`${tono.respaldo} p-4`}>
                  Tu navegador no soporta este formato de video.
                  <a href={mediaUrl} className={`${tono.enlace} ml-2 underline`} target="_blank" rel="noopener noreferrer">
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
  )
}

// Los datos de un proyecto por su slug: la lista activa para encontrar su id y
// luego el proyecto con sus archivos (lo mismo que hace Section1 al abrir el
// detalle).
export function useProjectDetail(slug) {
  const [estado, setEstado] = React.useState({ slug: null, project: null, media: [], error: '' })
  React.useEffect(() => {
    if (!slug) return undefined
    let vivo = true
    ;(async () => {
      try {
        const lista = await fetch('/api/projects.php?active=1').then((r) => (r.ok ? r.json() : null))
        const encontrado = lista?.ok && Array.isArray(lista.projects) ? lista.projects.find((p) => p.slug === slug) : null
        if (!encontrado?.id) throw new Error('Project not found')
        const detalle = await fetch(`/api/projects.php?id=${encontrado.id}`).then((r) => (r.ok ? r.json() : null))
        if (!detalle?.ok || !detalle.project) throw new Error('Invalid project data')
        const media = (detalle.project.files || [])
          .filter((f) => f.file_type === 'image' || f.file_type === 'video')
          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
          .map((f) => ({ type: f.file_type, path: f.file_path || f.path }))
          .filter((m) => m.path)
        if (vivo) setEstado({ slug, project: detalle.project, media, error: media.length ? '' : 'No media found' })
      } catch {
        if (vivo) setEstado({ slug, project: null, media: [], error: 'No media found' })
      }
    })()
    return () => { vivo = false }
  }, [slug])
  const listo = estado.slug === slug
  return {
    project: listo ? estado.project : null,
    media: listo ? estado.media : [],
    loading: Boolean(slug) && !listo,
    error: listo ? estado.error : '',
  }
}


// ── Acciones del proyecto: compartir + link del proyecto ───────────────
// Mismo alto para todas (44 px): compartir como íconos (borde 2px, plano,
// el hover invierte a blanco, patrón de OrderStatusModal) y el link del
// proyecto como pill de color al final. Nunca a todo lo ancho.
// Los colores salen del tono de la ficha (TONOS).
const SHARE_BTN = 'w-11 h-11 grid place-items-center rounded-full border-2 active:scale-95 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2'
const LINK_BTN = 'shop-btn min-h-11 px-6 text-xs gap-2 focus-visible:outline-2 focus-visible:outline-offset-2'

function ProjectActions({ slug, title, primaryUrl, primaryText, secondaryUrl, secondaryText, tono = TONOS.oscuro }) {
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
          data-tip={shareLabel}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`${SHARE_BTN} ${tono.icono} ${copied ? tono.copiado : ''} ${menuOpen ? tono.menuAbierto : ''}`}
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
        data-tip={copyLabel}
        className={`${SHARE_BTN} ${tono.icono} max-sm:!hidden ${copied ? `${tono.copiado} ${tono.copiadoHover}` : ''}`}
      >
        {copied ? <CheckIcon className="w-4 h-4" aria-hidden="true" /> : <LinkIcon className="w-4 h-4" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={shareLinkedIn}
        aria-label={es ? 'Compartir en LinkedIn' : 'Share on LinkedIn'}
        data-tip="LinkedIn"
        className={`${SHARE_BTN} ${tono.icono} max-sm:!hidden`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      </button>

      <button
        type="button"
        onClick={shareFacebook}
        aria-label={es ? 'Compartir en Facebook' : 'Share on Facebook'}
        data-tip="Facebook"
        className={`${SHARE_BTN} ${tono.icono} max-sm:!hidden`}
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </button>

      {secondaryUrl && (
        <a href={secondaryUrl} target="_blank" rel="noopener noreferrer" className={`${LINK_BTN} ${tono.secundario}`}>
          <span>{secondaryText}</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
        </a>
      )}
      {primaryUrl && (
        <a href={primaryUrl} target="_blank" rel="noopener noreferrer" className={`${LINK_BTN} ${tono.principal}`}>
          <span>{primaryText}</span>
          <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden="true" />
        </a>
      )}

      <span role="status" aria-live="polite" className="sr-only">{copied ? copiedLabel : ''}</span>
    </div>
  )
}
