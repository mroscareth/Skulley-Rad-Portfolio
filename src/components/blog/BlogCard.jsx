import React from 'react'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { baseUrl } from '../../lib/sectionRouting.js'

// La card de una entrada de Memorias y sus piezas, aparte de Section5 para que
// la home de teléfono la use sin cargar la sección entera (el lector TTS).
// Section5 importa de aquí lo mismo para su listado, el destacado y el post.

// ─── Resolve translated field helper ───
export function tr(post, field, lang) {
    if (lang === 'es') {
        const esVal = post[`${field}_es`]
        if (esVal) return esVal
    }
    return post[field]
}

export function coverSrc(post) {
    if (!post.cover_image) return null
    return post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`
}

// MySQL entrega "YYYY-MM-DD HH:MM:SS"; Safari no parsea el espacio.
export function formatDate(value, lang, month = 'short') {
    if (!value) return ''
    const d = new Date(String(value).replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month, day: 'numeric' })
}

export const postHref = (post) => `${baseUrl}blog/${post.slug}`

// Las cards son links reales (/blog/slug): se pueden abrir en otra pestaña y
// los crawlers los siguen. El click normal se queda en la SPA.
export function openPost(e, post, onSelect) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onSelect(post)
}

export function CoverPlaceholder({ lang }) {
    return (
        <div className="absolute inset-0 grid place-items-center text-white/15" aria-hidden="true">
            <span className="display-title display-title--md">{lang === 'es' ? 'Memorias' : 'Memories'}</span>
        </div>
    )
}

// Fecha + tags van DEBAJO del título: arriba serían un eyebrow (DESIGN.md §0.7).
export function PostMeta({ post, lang, month = 'short', maxTags, className = '' }) {
    const date = formatDate(post.created_at, lang, month)
    const allTags = post.tags || []
    const tags = maxTags ? allTags.slice(0, maxTags) : allTags
    if (!date && tags.length === 0) return null

    return (
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}>
            {date && (
                <time dateTime={post.created_at} className="text-sm text-white/55">
                    {date}
                </time>
            )}
            {tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5" aria-label={lang === 'es' ? 'Etiquetas' : 'Tags'}>
                    {tags.map((tag) => (
                        <li key={tag} className="shop-kicker px-2.5 py-1 rounded-full border-2 border-white/10 text-white/65">
                            {tag}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

// ─── Blog Card ───
export default function BlogCard({ post, onSelect }) {
    const { lang } = useLanguage()
    const cover = coverSrc(post)
    const title = tr(post, 'title', lang)
    const excerpt = tr(post, 'excerpt', lang)

    return (
        <a
            href={postHref(post)}
            onClick={(e) => openPost(e, post, onSelect)}
            className="shop-card flex flex-col w-full h-full overflow-hidden text-left"
        >
            {/* Portada editorial: `cover` está bien acá (no es producto, §14.7).
                alt vacío porque el título ya nombra el link. */}
            <div className="relative aspect-video overflow-hidden bg-[#150a1d]">
                {cover ? (
                    <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <CoverPlaceholder lang={lang} />
                )}
            </div>

            {/* Título reservado a dos líneas para que todas las cards midan igual. */}
            <div className="flex flex-col flex-1 p-4 sm:p-5">
                <h3 className="font-bold text-white text-lg sm:text-xl leading-tight line-clamp-2 min-h-[2.5em]">
                    {title}
                </h3>
                {excerpt && (
                    <p className="mt-2 text-base text-white/65 leading-relaxed line-clamp-2">
                        {excerpt}
                    </p>
                )}
                <PostMeta post={post} lang={lang} maxTags={3} className="mt-auto pt-4" />
            </div>
        </a>
    )
}
