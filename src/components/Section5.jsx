/**
 * Section5 — Blog
 * Lenguaje editorial + toon (DESIGN.md §14/§15): título display, cards planas
 * con borde de 2px, hover = solo elevación, cero glow. Acento: naranja del
 * blog (#ff6b00).
 * Features: search, tag filter chips, featured post hero, 2-col grid, post view
 * with TTS reader and share buttons.
 */

import React, { useState, useEffect, useCallback, useMemo, useId } from 'react'
import { MagnifyingGlassIcon, LinkIcon, CheckIcon } from '@heroicons/react/24/solid'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import BlogTTS from './BlogTTS.jsx'
import { sanitizeHtml } from '../lib/parseRichText.jsx'
import BlogCard, { tr, coverSrc, postHref, openPost, CoverPlaceholder, PostMeta } from './blog/BlogCard.jsx'

const API = '/api/blog.php'

// Lo que Tailwind no alcanza: (1) el acento naranja sobre las clases SHOP v2,
// que traen el magenta de la Store fijo, y (2) la tipografía del cuerpo del
// post, que llega como HTML del CMS y no se puede marcar con utilities.
const BLOG_CSS = `
.blog-root .shop-card:focus-visible { outline-color: #ff6b00; }
.blog-root .shop-chip[aria-pressed='true'] {
  color: #0a0510;
  background: #ff6b00;
  border-color: #ff6b00;
}
.blog-root .shop-chip:focus-visible {
  outline: 2px solid #ff6b00;
  outline-offset: 2px;
}

.blog-article {
  max-width: 68ch;
  font-family: var(--font-body);
  font-size: clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem);
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
}
.blog-html-content > :first-child { margin-top: 0; }
.blog-html-content h1,
.blog-html-content h2,
.blog-html-content h3,
.blog-html-content h4 {
  font-family: var(--font-body);
  font-weight: 700;
  line-height: 1.25;
  color: #fff;
}
.blog-html-content h1,
.blog-html-content h2 { font-size: 1.6em; margin: 2em 0 0.6em; }
.blog-html-content h3 { font-size: 1.3em; margin: 1.75em 0 0.5em; }
.blog-html-content h4 { font-size: 1.1em; margin: 1.5em 0 0.4em; }
.blog-html-content p {
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  margin: 0 0 1.1em;
}
.blog-html-content strong { color: #fff; font-weight: 700; }
.blog-html-content em { font-style: italic; }
.blog-html-content ul,
.blog-html-content ol { padding-left: 1.5em; margin: 0 0 1.1em; }
.blog-html-content ul { list-style-type: disc; }
.blog-html-content ol { list-style-type: decimal; }
.blog-html-content li { margin-bottom: 0.35em; }
.blog-html-content li > p { margin-bottom: 0.35em; }
.blog-html-content li::marker { color: #ff6b00; }
.blog-html-content blockquote {
  border-left: 2px solid #ff6b00;
  padding-left: 1.1em;
  margin: 1.5em 0;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}
.blog-html-content a {
  color: #ff6b00;
  text-decoration: underline;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.2em;
}
.blog-html-content a:hover { color: #ff8a33; }
.blog-html-content a:focus-visible {
  outline: 2px solid #ff6b00;
  outline-offset: 2px;
  border-radius: 2px;
}
.blog-html-content hr {
  border: 0;
  border-top: 2px solid rgba(255, 255, 255, 0.1);
  margin: 2.5em 0;
}
.blog-html-content img {
  max-width: 100%;
  height: auto;
  border-radius: 0.75rem;
  margin: 1.5em 0;
}

/* Código literal: el único lugar del blog con fuente monoespaciada.
   El padding-top deja una franja para el botón de copiar, así no tapa
   la primera línea. */
.blog-html-content pre {
  position: relative;
  background: #150a1d;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.75rem;
  padding: 3rem 1.25rem 1rem;
  margin: 1.5em 0;
  overflow-x: auto;
}
.blog-html-content code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  color: #ffd0a8;
  background: rgba(255, 107, 0, 0.12);
  padding: 0.15em 0.4em;
  border-radius: 0.375rem;
}
.blog-html-content pre code {
  display: block;
  color: rgba(255, 255, 255, 0.88);
  background: none;
  padding: 0;
  line-height: 1.6;
}
.blog-copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  min-height: 2.25rem;
  padding: 0 0.9rem;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.75);
  background: #0d0714;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
}
/* Área táctil de 44px sin agrandar el botón visible. */
.blog-copy-btn::before {
  content: '';
  position: absolute;
  inset: -0.25rem;
}
.blog-copy-btn:hover { color: #fff; border-color: rgba(255, 255, 255, 0.5); }
.blog-copy-btn:focus-visible { outline: 2px solid #ff6b00; outline-offset: 2px; }
.blog-copy-btn.copied { color: #22c55e; border-color: #22c55e; }
`

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url) {
    if (!url) return null
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
    return m ? m[1] : null
}

// Render inline markdown-like formatting in text
function renderInlineText(text) {
    if (!text) return null
    // Bold: **text**
    let parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i}>{p.slice(2, -2)}</strong>
        }
        // Italic: *text*
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
            return <em key={i}>{p.slice(1, -1)}</em>
        }
        return p
    })
}

// ─── Featured Hero Card ───
function FeaturedHero({ post, onSelect }) {
    const { lang } = useLanguage()
    const cover = coverSrc(post)
    const title = tr(post, 'title', lang)
    const subtitle = tr(post, 'subtitle', lang)
    const excerpt = tr(post, 'excerpt', lang)

    return (
        <a
            href={postHref(post)}
            onClick={(e) => openPost(e, post, onSelect)}
            className="shop-card flex flex-col md:flex-row w-full overflow-hidden text-left mb-6 sm:mb-8"
        >
            <div className="relative md:w-1/2 aspect-video md:aspect-auto md:min-h-[320px] overflow-hidden bg-[#150a1d]">
                {cover ? (
                    <img
                        src={cover}
                        alt=""
                        loading="eager"
                        decoding="async"
                        draggable={false}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <CoverPlaceholder lang={lang} />
                )}
                {/* Badge de estado sobre la foto (permitido, §0.7) — no rótulo del título. */}
                <span className="shop-kicker absolute top-3 left-3 z-[1] px-2.5 py-1 rounded-full bg-section-blog text-[#0a0510]">
                    {lang === 'es' ? 'Destacado' : 'Featured'}
                </span>
            </div>

            <div className="md:w-1/2 flex flex-col justify-center gap-4 p-5 sm:p-8">
                <h2 className="display-title display-title--md text-white">{title}</h2>
                {subtitle && (
                    <p className="text-lg sm:text-xl text-white/80 leading-snug">{subtitle}</p>
                )}
                {excerpt && (
                    <p className="text-base text-white/65 leading-relaxed line-clamp-3">{excerpt}</p>
                )}
                <PostMeta post={post} lang={lang} />
            </div>
        </a>
    )
}

// ─── Loading skeleton ───
function ListSkeleton({ label }) {
    return (
        <div role="status">
            <span className="sr-only">{label}</span>
            <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 motion-safe:animate-pulse">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-[1.25rem] border-2 border-white/10 bg-[#0d0714] overflow-hidden">
                        <div className="aspect-video bg-[#150a1d]" />
                        <div className="p-4 sm:p-5 space-y-3">
                            <div className="h-5 w-3/4 rounded-full bg-white/[0.06]" />
                            <div className="h-4 w-full rounded-full bg-white/[0.06]" />
                            <div className="h-4 w-1/3 rounded-full bg-white/[0.06]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Share Buttons ───
function ShareButtons({ url, title }) {
    const { lang } = useLanguage()
    const isEs = lang === 'es'
    const labelId = useId()
    const [copied, setCopied] = useState(false)
    const encodedUrl = encodeURIComponent(url)
    const encodedTitle = encodeURIComponent(title)

    const handleCopy = () => {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    const shareLinks = [
        { name: 'X', icon: '𝕏', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
        { name: 'LinkedIn', icon: 'in', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
        { name: 'Facebook', icon: 'f', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    ]

    const btnClass = 'inline-flex items-center justify-center min-w-11 h-11 px-3 rounded-full border-2 border-white/15 text-white/80 text-sm font-bold hover:text-white hover:border-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-blog'

    return (
        <div className="mt-12 pt-6 border-t-2 border-white/10 flex flex-wrap items-center gap-3">
            <span id={labelId} className="font-bold text-white/70">
                {isEs ? 'Compartir' : 'Share'}
            </span>
            <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
                {shareLinks.map((s) => (
                    <a
                        key={s.name}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${isEs ? 'Compartir en' : 'Share on'} ${s.name}`}
                        title={`${isEs ? 'Compartir en' : 'Share on'} ${s.name}`}
                        className={btnClass}
                    >
                        <span aria-hidden="true">{s.icon}</span>
                    </a>
                ))}
                <button type="button" onClick={handleCopy} className={`${btnClass} gap-2 px-4`}>
                    {copied
                        ? <CheckIcon className="w-4 h-4" aria-hidden="true" />
                        : <LinkIcon className="w-4 h-4" aria-hidden="true" />}
                    <span aria-live="polite">
                        {copied
                            ? (isEs ? 'Enlace copiado' : 'Link copied')
                            : (isEs ? 'Copiar enlace' : 'Copy link')}
                    </span>
                </button>
            </div>
        </div>
    )
}

// ─── Single Blog Post View ───
function BlogPostView({ post, onBack, shareUrl }) {
    const { lang } = useLanguage()
    const coverUrl = coverSrc(post)

    // Resolve translated content
    const postTitle = tr(post, 'title', lang)
    const postSubtitle = tr(post, 'subtitle', lang)
    const rawContentHtml = tr(post, 'content_html', lang)
    const postExcerpt = tr(post, 'excerpt', lang)

    // ── Dynamic SEO: update document title, meta tags, canonical ──
    useEffect(() => {
        const origTitle = document.title
        const seoTitle = `${postTitle} — Oscar Moctezuma Rodriguez`
        const seoDesc = postExcerpt || postSubtitle || postTitle
        const seoUrl = shareUrl || `${window.location.origin}/blog/${post.slug}`
        const seoImage = coverUrl
            ? (coverUrl.startsWith('http') ? coverUrl : `${window.location.origin}${coverUrl}`)
            : `${window.location.origin}/sharer_MEMORY.png`

        // Update document title
        document.title = seoTitle

        // Helper: set or create a meta tag
        const setMeta = (attr, key, content) => {
            let el = document.querySelector(`meta[${attr}="${key}"]`)
            if (!el) {
                el = document.createElement('meta')
                el.setAttribute(attr, key)
                document.head.appendChild(el)
            }
            el.setAttribute('content', content)
            return el
        }

        // Core SEO
        const metaDesc = setMeta('name', 'description', seoDesc)

        // Canonical
        let canonical = document.querySelector('link[rel="canonical"]')
        const origCanonical = canonical?.getAttribute('href') || ''
        if (canonical) canonical.setAttribute('href', seoUrl)

        // Open Graph
        const ogTitle = setMeta('property', 'og:title', postTitle)
        const ogDesc = setMeta('property', 'og:description', seoDesc)
        const ogUrl = setMeta('property', 'og:url', seoUrl)
        const ogImage = setMeta('property', 'og:image', seoImage)
        const ogType = setMeta('property', 'og:type', 'article')

        // Twitter Card
        const twTitle = setMeta('name', 'twitter:title', postTitle)
        const twDesc = setMeta('name', 'twitter:description', seoDesc)
        const twImage = setMeta('name', 'twitter:image', seoImage)

        return () => {
            // Restore original values on unmount
            document.title = origTitle
            metaDesc.setAttribute('content', 'Creative designer, 3D artist & frontend developer from Mexico. Founder of The Heritage Design — worked with Valve, Koto Studio & more. Explore my interactive 3D portfolio.')
            if (canonical) canonical.setAttribute('href', origCanonical || 'https://mroscar.xyz/')
            ogTitle.setAttribute('content', 'Oscar Moctezuma Rodriguez — Creative Designer & 3D Artist')
            ogDesc.setAttribute('content', 'Creative designer, 3D artist & frontend developer from Mexico. Founder of The Heritage Design — worked with Valve, Koto Studio & global brands. Explore my interactive 3D portfolio.')
            ogUrl.setAttribute('content', 'https://mroscar.xyz/')
            ogImage.setAttribute('content', 'https://mroscar.xyz/sharer_MEMORY.png')
            ogType.setAttribute('content', 'profile')
            twTitle.setAttribute('content', 'Oscar Moctezuma Rodriguez — Creative Designer & 3D Artist')
            twDesc.setAttribute('content', 'Creative designer, 3D artist & frontend developer from Mexico. Founder of The Heritage Design — worked with Valve, Koto & global brands.')
            twImage.setAttribute('content', 'https://mroscar.xyz/sharer_MEMORY.png')
        }
    }, [postTitle, postSubtitle, postExcerpt, coverUrl, shareUrl, post.slug])

    // If translated content is plain text (no HTML tags), convert to proper HTML
    const postContentHtml = useMemo(() => {
        if (!rawContentHtml) return null
        // Check if it contains any HTML tags
        if (/<[a-z][\s\S]*>/i.test(rawContentHtml)) return rawContentHtml
        // Plain text — convert to paragraphs
        return rawContentHtml
            .split(/\n\s*\n/) // double newlines = paragraph breaks
            .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
            .join('\n')
    }, [rawContentHtml])

    // Add copy buttons to code blocks after render. Se recrean al cambiar el
    // HTML o el idioma para que la etiqueta siga al idioma activo.
    useEffect(() => {
        const container = document.querySelector('.blog-html-content')
        if (!container) return
        const label = lang === 'es' ? 'Copiar' : 'Copy'
        const doneLabel = lang === 'es' ? 'Copiado' : 'Copied'
        const codeBlocks = container.querySelectorAll('pre')
        codeBlocks.forEach((pre) => {
            pre.querySelector('.blog-copy-btn')?.remove()
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'blog-copy-btn'
            btn.textContent = label
            btn.addEventListener('click', () => {
                const code = pre.querySelector('code')?.textContent || pre.textContent
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = doneLabel
                    btn.classList.add('copied')
                    setTimeout(() => {
                        btn.textContent = label
                        btn.classList.remove('copied')
                    }, 1500)
                })
            })
            pre.appendChild(btn)
        })
    }, [postContentHtml, lang])

    const legacyBlocks = (post.content_blocks || []).filter(
        (b) => b.type === 'heading' || b.type === 'paragraph' || b.type === 'bullets'
    )

    // La portada arranca debajo de los botones flotantes de arriba (regresar,
    // carrito, cuenta), que se le encimaban. Con la columna de 768px centrada
    // el grupo de la derecha la alcanza hasta ~1060px de ancho; desde xl ya no.
    return (
        <article className="max-w-3xl mx-auto pt-12 md:pt-[4.75rem] xl:pt-0">
            {coverUrl && (
                <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-white/10 bg-[#150a1d] mb-8">
                    <img
                        src={coverUrl}
                        alt={postTitle}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                </div>
            )}

            <header className="mb-8">
                <h1 className="display-title display-title--md text-white">{postTitle}</h1>
                {postSubtitle && (
                    <p className="mt-4 text-lg sm:text-xl text-white/75 leading-relaxed">{postSubtitle}</p>
                )}
                <PostMeta post={post} lang={lang} month="long" className="mt-5" />
            </header>

            {/* Text-to-Speech player */}
            <BlogTTS htmlContent={postContentHtml} lang={lang} />

            {/* Content — prefer content_html, fallback to legacy blocks */}
            <div className="blog-article">
                {/* HTML content from TipTap — sanitize con DOMPurify antes de render */}
                {postContentHtml && (
                    <div
                        className="blog-html-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(postContentHtml) }}
                    />
                )}

                {/* Legacy block rendering (text blocks) — only if no content_html.
                    Usa las mismas reglas tipográficas que el HTML del CMS. */}
                {!postContentHtml && legacyBlocks.length > 0 && (
                    <div className="blog-html-content">
                        {legacyBlocks.map((block, i) => {
                            switch (block.type) {
                                case 'heading': {
                                    const Tag = `h${block.level || 2}`
                                    return <Tag key={i}>{renderInlineText(block.text)}</Tag>
                                }
                                case 'paragraph':
                                    return <p key={i}>{renderInlineText(block.text)}</p>
                                case 'bullets':
                                    return (
                                        <ul key={i}>
                                            {(block.items || []).map((item, j) => (
                                                <li key={j}>{renderInlineText(item)}</li>
                                            ))}
                                        </ul>
                                    )
                                default:
                                    return null
                            }
                        })}
                    </div>
                )}

                {/* Media blocks (always rendered — both old and new posts) */}
                <div className="space-y-6 mt-6">
                    {(post.content_blocks || []).filter(
                        (b) => b.type === 'image' || b.type === 'video'
                    ).map((block, i) => {
                        if (block.type === 'image') {
                            return (
                                <figure key={`media-${i}`}>
                                    <img
                                        src={block.src?.startsWith('http') ? block.src : `/${block.src}`}
                                        alt={block.alt || ''}
                                        className="w-full rounded-xl"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    {block.caption && (
                                        <figcaption className="mt-2 text-center text-sm text-white/50">
                                            {block.caption}
                                        </figcaption>
                                    )}
                                </figure>
                            )
                        }
                        if (block.type === 'video') {
                            const ytId = extractYouTubeId(block.url)
                            return (
                                <div key={`media-${i}`}>
                                    {ytId ? (
                                        <div className="relative rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                                            <iframe
                                                src={`https://www.youtube.com/embed/${ytId}`}
                                                title={block.caption || 'Video'}
                                                className="absolute inset-0 w-full h-full border-0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            />
                                        </div>
                                    ) : (
                                        <a
                                            href={block.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-section-blog underline underline-offset-4 break-all"
                                        >
                                            ▶ {block.url}
                                        </a>
                                    )}
                                    {block.caption && (
                                        <p className="mt-2 text-center text-sm text-white/50">
                                            {block.caption}
                                        </p>
                                    )}
                                </div>
                            )
                        }
                        return null
                    })}
                </div>
            </div>

            {/* Share buttons */}
            {shareUrl && <ShareButtons url={shareUrl} title={tr(post, 'title', 'en') || post.title} />}
        </article>
    )
}

// ─── Main Section5 Component ───
export default function Section5({ initialPostSlug, onPostSlugChange }) {
    const { lang } = useLanguage()
    const [posts, setPosts] = useState([])
    const [allTags, setAllTags] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTag, setActiveTag] = useState(null)
    const [selectedPost, setSelectedPost] = useState(null)
    const initialSlugHandledRef = React.useRef(false)

    // Fetch posts from API
    const fetchPosts = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (searchQuery) params.set('q', searchQuery)
            if (activeTag) params.set('tag', activeTag)
            params.set('limit', '50')
            const res = await fetch(`${API}?${params.toString()}`)
            const json = await res.json()
            if (json.ok) {
                setPosts(json.posts || [])
                setAllTags(json.allTags || [])
            }
        } catch { /* silent */ }
        finally { setLoading(false) }
    }, [searchQuery, activeTag])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    // Deep link: if initialPostSlug is set, auto-fetch that post
    useEffect(() => {
        if (!initialPostSlug || initialSlugHandledRef.current) return
        initialSlugHandledRef.current = true
            ; (async () => {
                try {
                    const res = await fetch(`${API}?slug=${encodeURIComponent(initialPostSlug)}`)
                    const json = await res.json()
                    if (json.ok && json.post) {
                        setSelectedPost(json.post)
                        try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'back' } })) } catch { }
                    }
                } catch { /* silent */ }
            })()
    }, [initialPostSlug])

    // Handle browser back/forward changing the slug
    useEffect(() => {
        if (initialPostSlug && selectedPost && selectedPost.slug !== initialPostSlug) {
            // Slug changed via popstate — fetch the new post
            ; (async () => {
                try {
                    const res = await fetch(`${API}?slug=${encodeURIComponent(initialPostSlug)}`)
                    const json = await res.json()
                    if (json.ok && json.post) {
                        setSelectedPost(json.post)
                    }
                } catch { /* silent */ }
            })()
        } else if (!initialPostSlug && selectedPost) {
            // Back to listing via popstate
            setSelectedPost(null)
        }
    }, [initialPostSlug]) // eslint-disable-line react-hooks/exhaustive-deps

    // Select a post (fetch full content by slug)
    const handleSelectPost = useCallback(async (post) => {
        try {
            const res = await fetch(`${API}?slug=${encodeURIComponent(post.slug)}`)
            const json = await res.json()
            if (json.ok && json.post) {
                setSelectedPost(json.post)
                if (onPostSlugChange) onPostSlugChange(json.post.slug)
                try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'back' } })) } catch { }
            }
        } catch { /* silent */ }
    }, [onPostSlugChange])

    // Separate featured from regular posts
    const featuredPost = useMemo(() => posts.find((p) => p.featured), [posts])
    const regularPosts = useMemo(() => posts.filter((p) => !p.featured), [posts])

    // Background color comes from sectionBgOverrides in appHelpers.js
    const containerStyle = {
        position: 'relative',
        minHeight: '100%',
        paddingBottom: '6rem',
    }

    // Close blog post when portrait back button is clicked
    useEffect(() => {
        const onPortraitBack = () => {
            setSelectedPost(null)
            if (onPostSlugChange) onPostSlugChange(null)
            try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'close' } })) } catch { }
        }
        window.addEventListener('detail-close', onPortraitBack)
        return () => window.removeEventListener('detail-close', onPortraitBack)
    }, [onPostSlugChange])

    const isEs = lang === 'es'
    const copy = {
        heading: isEs ? 'Memorias' : 'Memories',
        search: isEs ? 'Buscar en memorias' : 'Search memories',
        filter: isEs ? 'Filtrar por etiqueta' : 'Filter by tag',
        all: isEs ? 'Todo' : 'All',
        loading: isEs ? 'Cargando memorias…' : 'Loading memories…',
        empty: isEs ? 'Todavía no hay memorias aquí.' : 'No memories here yet.',
        noMatch: (q) => (isEs ? `Ninguna memoria coincide con “${q}”.` : `No memories match “${q}”.`),
    }

    // Single post view
    if (selectedPost) {
        return (
            <div className="blog-root pointer-events-auto" style={containerStyle}>
                <style>{BLOG_CSS}</style>
                <BlogPostView
                    post={selectedPost}
                    onBack={() => {
                        setSelectedPost(null)
                        if (onPostSlugChange) onPostSlugChange(null)
                        try { window.dispatchEvent(new CustomEvent('portrait-exit-mode', { detail: { mode: 'close' } })) } catch { }
                    }}
                    shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/blog/${selectedPost.slug}` : ''}
                />
            </div>
        )
    }

    return (
        <div className="blog-root pointer-events-auto" style={containerStyle}>
            <style>{BLOG_CSS}</style>

            {/* Sin título visible: el marquee de arriba ya nombra la sección. El
                h1 queda solo para lectores de pantalla y el outline del documento. */}
            <h1 className="sr-only">{copy.heading}</h1>

            {/* Search. Arranca debajo de los botones flotantes de arriba (App:
                top-4 + 44px; desde md, top-10 + 48px), que lo tapaban. Desde lg
                cabe centrado entre los dos grupos, en el mismo renglón. */}
            <div className="relative max-w-xl mx-auto mt-12 md:mt-[4.75rem] lg:mt-4 mb-5 sm:mb-6">
                <MagnifyingGlassIcon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45"
                    aria-hidden="true"
                />
                <input
                    type="search"
                    enterKeyHint="search"
                    placeholder={copy.search}
                    aria-label={copy.search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full min-h-12 pl-12 pr-4 rounded-full bg-[#150a1d] border-2 border-white/15 text-base text-white placeholder:text-white/40 caret-section-blog focus-visible:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-blog"
                />
            </div>

            {/* Tag filter chips */}
            {allTags.length > 0 && (
                <div role="group" aria-label={copy.filter} className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-12">
                    <button
                        type="button"
                        aria-pressed={!activeTag}
                        onClick={() => setActiveTag(null)}
                        className="shop-chip min-h-11 px-4 sm:px-5 text-[11px] sm:text-xs"
                    >
                        {copy.all}
                    </button>
                    {allTags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            aria-pressed={activeTag === tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className="shop-chip min-h-11 px-4 sm:px-5 text-[11px] sm:text-xs"
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {loading && <ListSkeleton label={copy.loading} />}

            {/* No results */}
            {!loading && posts.length === 0 && (
                <p role="status" className="py-16 text-center text-base sm:text-lg text-white/60">
                    {searchQuery ? copy.noMatch(searchQuery) : copy.empty}
                </p>
            )}

            {/* Featured post hero */}
            {!loading && featuredPost && (
                <FeaturedHero post={featuredPost} onSelect={handleSelectPost} />
            )}

            {/* Post grid — todas las cards del mismo alto (§14.6) */}
            {!loading && regularPosts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 items-stretch">
                    {regularPosts.map((post) => (
                        <BlogCard key={post.id} post={post} onSelect={handleSelectPost} />
                    ))}
                </div>
            )}
        </div>
    )
}
