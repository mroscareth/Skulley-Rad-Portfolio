/**
 * Section5 â€” Blog Listing Page
 * Terminal CRT dark theme with purple accents
 * Features: search bar, tag filter pills, featured post hero, 2-col grid, bullet lists
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import BlogTTS from './BlogTTS.jsx'

const API = '/api/blog.php'

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
            return <strong key={i} style={{ color: '#ffb366' }}>{p.slice(2, -2)}</strong>
        }
        // Italic: *text*
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
            return <em key={i}>{p.slice(1, -1)}</em>
        }
        return p
    })
}

/* â”€â”€â”€ CRT Overlay â€” used on images and backgrounds â”€â”€â”€ */
function CrtOverlay({ opacity = 0.06 }) {
    return (
        <div
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
                background: `repeating-linear-gradient(0deg, rgba(0,0,0,${opacity}) 0px, rgba(0,0,0,${opacity}) 1px, transparent 1px, transparent 3px)`,
            }}
        />
    )
}

// â”€â”€â”€ Blog Post Card â”€â”€â”€
// ─── Resolve translated field helper ───
function tr(post, field, lang) {
    if (lang === 'es') {
        const esVal = post[`${field}_es`]
        if (esVal) return esVal
    }
    return post[field]
}

// ─── Blog Card ───
function BlogCard({ post, onSelect }) {
    const { lang } = useLanguage()
    const coverUrl = post.cover_image
        ? (post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`)
        : null

    return (
        <button
            onClick={() => onSelect(post)}
            className="group text-left w-full rounded-lg overflow-hidden transition-all duration-300"
            style={{
                background: 'rgba(0, 5, 15, 0.85)',
                border: '1px solid rgba(255, 107, 0, 0.2)',
            }}
        >
            {/* Cover image */}
            <div className="aspect-video relative overflow-hidden" style={{ background: 'rgba(255, 107, 0, 0.05)' }}>
                {coverUrl ? (
                    <img
                        src={coverUrl}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full grid place-items-center">
                        <span style={{ color: 'rgba(255, 107, 0, 0.2)', fontSize: '2rem' }}>⬡</span>
                    </div>
                )}
                <CrtOverlay opacity={0.08} />
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Tags */}
                {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {post.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider"
                                style={{
                                    background: 'rgba(255, 107, 0, 0.15)',
                                    border: '1px solid rgba(255, 107, 0, 0.3)',
                                    color: '#ffb366',
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <h3
                    className="text-sm mb-1 line-clamp-2 transition-colors duration-200"
                    style={{
                        fontFamily: '"Cascadia Code", "Fira Code", monospace',
                        color: '#e2e8f0',
                    }}
                >
                    {tr(post, 'title', lang)}
                </h3>
                {tr(post, 'excerpt', lang) && (
                    <p className="text-xs line-clamp-2 mb-2" style={{ color: 'rgba(255, 179, 102, 0.7)' }}>
                        {tr(post, 'excerpt', lang)}
                    </p>
                )}
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255, 179, 102, 0.5)' }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                </span>
            </div>

            {/* Hover glow */}
            <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"
                style={{
                    boxShadow: 'inset 0 0 30px rgba(255, 107, 0, 0.08), 0 0 20px rgba(255, 107, 0, 0.12)',
                    border: '1px solid rgba(255, 107, 0, 0.35)',
                }}
            />
        </button>
    )
}

// â”€â”€â”€ Featured Hero Card â”€â”€â”€
function FeaturedHero({ post, onSelect }) {
    const { lang } = useLanguage()
    const coverUrl = post.cover_image
        ? (post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`)
        : null

    return (
        <button
            onClick={() => onSelect(post)}
            className="group relative w-full rounded-xl overflow-hidden text-left mb-8 transition-all duration-300"
            style={{
                background: 'rgba(0, 5, 15, 0.85)',
                border: '1px solid rgba(255, 107, 0, 0.25)',
                minHeight: '280px',
            }}
        >
            <div className="flex flex-col md:flex-row h-full">
                {/* Cover */}
                <div className="md:w-1/2 aspect-video md:aspect-auto relative overflow-hidden">
                    {coverUrl ? (
                        <img src={coverUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                        <div className="w-full h-full grid place-items-center" style={{ background: 'rgba(255, 107, 0, 0.05)' }}>
                            <span style={{ color: 'rgba(255, 107, 0, 0.15)', fontSize: '4rem' }}>⬡</span>
                        </div>
                    )}
                    <CrtOverlay opacity={0.06} />
                </div>
                {/* Info */}
                <div className="md:w-1/2 p-6 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-3">
                        <span
                            className="px-2 py-0.5 rounded text-[10px] uppercase tracking-widest font-bold"
                            style={{ background: 'rgba(255, 107, 0, 0.25)', border: '1px solid rgba(255, 107, 0, 0.5)', color: '#ffb366' }}
                        >
                            ★ featured
                        </span>
                        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255, 179, 102, 0.6)' }}>
                            {post.created_at ? new Date(post.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''}
                        </span>
                    </div>
                    <h2 className="text-lg md:text-xl mb-2" style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace', color: '#f1f5f9' }}>
                        {tr(post, 'title', lang)}
                    </h2>
                    {tr(post, 'subtitle', lang) && (
                        <p className="text-sm mb-3" style={{ color: 'rgba(255, 179, 102, 0.8)' }}>{tr(post, 'subtitle', lang)}</p>
                    )}
                    {tr(post, 'excerpt', lang) && (
                        <p className="text-xs line-clamp-3 mb-4" style={{ color: 'rgba(255, 179, 102, 0.6)', fontFamily: '"Cascadia Code", monospace' }}>
                            {tr(post, 'excerpt', lang)}
                        </p>
                    )}
                    {post.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {post.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider" style={{ background: 'rgba(255, 107, 0, 0.15)', border: '1px solid rgba(255, 107, 0, 0.3)', color: '#ffb366' }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Hover glow */}
            <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                style={{ boxShadow: 'inset 0 0 40px rgba(255, 107, 0, 0.1), 0 0 30px rgba(255, 107, 0, 0.15)' }}
            />
        </button>
    )
}

// â”€â”€â”€// ─── Share Buttons ───
function ShareButtons({ url, title }) {
    const { lang } = useLanguage()
    const [copied, setCopied] = React.useState(false)
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

    const btnStyle = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'rgba(255, 107, 0, 0.08)',
        border: '1px solid rgba(255, 107, 0, 0.25)',
        color: '#ffb366',
        fontFamily: '"Cascadia Code", monospace',
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
    }

    return (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 107, 0, 0.15)' }}>
            <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'rgba(255, 179, 102, 0.5)', fontFamily: '"Cascadia Code", monospace' }}>
                &gt; {lang === 'es' ? 'compartir_post' : 'share_post'}
            </p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {shareLinks.map((s) => (
                    <a
                        key={s.name}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${lang === 'es' ? 'Compartir en' : 'Share on'} ${s.name}`}
                        style={btnStyle}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 107, 0, 0.2)'; e.currentTarget.style.borderColor = 'rgba(255, 107, 0, 0.5)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 107, 0, 0.08)'; e.currentTarget.style.borderColor = 'rgba(255, 107, 0, 0.25)' }}
                    >
                        {s.icon}
                    </a>
                ))}
                <button
                    onClick={handleCopy}
                    title={lang === 'es' ? 'Copiar enlace' : 'Copy link'}
                    style={{ ...btnStyle, width: 'auto', paddingLeft: '10px', paddingRight: '10px', fontSize: '10px', gap: '4px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 107, 0, 0.2)'; e.currentTarget.style.borderColor = 'rgba(255, 107, 0, 0.5)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 107, 0, 0.08)'; e.currentTarget.style.borderColor = 'rgba(255, 107, 0, 0.25)' }}
                >
                    {copied ? '✓' : '🔗'}
                    <span style={{ fontFamily: '"Cascadia Code", monospace' }}>{copied ? (lang === 'es' ? 'copiado!' : 'copied!') : (lang === 'es' ? 'copiar' : 'copy')}</span>
                </button>
            </div>
        </div>
    )
}

// â”€â”€â”€ Single Blog Post View â”€â”€â”€
function BlogPostView({ post, onBack, shareUrl }) {
    const { lang } = useLanguage()
    const coverUrl = post.cover_image
        ? (post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`)
        : null

    // Resolve translated content
    const postTitle = tr(post, 'title', lang)
    const postSubtitle = tr(post, 'subtitle', lang)
    const rawContentHtml = tr(post, 'content_html', lang)
    const postExcerpt = tr(post, 'excerpt', lang)

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

    // Add copy buttons to code blocks after render
    useEffect(() => {
        const container = document.querySelector('.blog-html-content')
        if (!container) return
        const codeBlocks = container.querySelectorAll('pre')
        codeBlocks.forEach((pre) => {
            if (pre.querySelector('.blog-copy-btn')) return // already added
            const btn = document.createElement('button')
            btn.className = 'blog-copy-btn'
            btn.textContent = 'copy'
            btn.addEventListener('click', () => {
                const code = pre.querySelector('code')?.textContent || pre.textContent
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = 'copied!'
                    btn.classList.add('copied')
                    setTimeout(() => {
                        btn.textContent = 'copy'
                        btn.classList.remove('copied')
                    }, 1500)
                })
            })
            pre.style.position = 'relative'
            pre.appendChild(btn)
        })
    }, [post.content_html])

    return (
        <div className="max-w-3xl mx-auto animate-fadeIn">
            {/* Back button */}
            <button
                onClick={onBack}
                className="flex items-center gap-2 mb-6 px-4 py-2 rounded-lg text-xs uppercase tracking-wider transition-all"
                style={{
                    color: '#ffb366',
                    fontFamily: '"Cascadia Code", monospace',
                    background: 'rgba(255, 107, 0, 0.1)',
                    border: '1px solid rgba(255, 107, 0, 0.25)',
                }}
            >
                <span>←</span> back_to_blog
            </button>

            {/* Cover image */}
            {coverUrl && (
                <div className="relative rounded-xl overflow-hidden mb-6 aspect-video">
                    <img src={coverUrl} alt={post.title} className="w-full h-full object-cover" />
                    <CrtOverlay opacity={0.06} />
                </div>
            )}

            {/* Title + meta */}
            <div className="mb-6">
                {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider" style={{ background: 'rgba(255, 107, 0, 0.15)', border: '1px solid rgba(255, 107, 0, 0.3)', color: '#ffb366' }}>
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <h1 className="text-xl md:text-2xl mb-2" style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace', color: '#f1f5f9' }}>
                    {postTitle}
                </h1>
                {postSubtitle && (
                    <p className="text-sm mb-2" style={{ color: 'rgba(255, 179, 102, 0.8)', fontFamily: '"Cascadia Code", monospace' }}>
                        {postSubtitle}
                    </p>
                )}
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255, 179, 102, 0.5)' }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                </span>
            </div>

            {/* Text-to-Speech player */}
            <BlogTTS htmlContent={postContentHtml} lang={lang} />

            {/* Content â€” prefer content_html, fallback to legacy blocks */}
            <div style={{ fontFamily: '"Cascadia Code", "Fira Code", monospace' }}>
                {/* Scoped styles for HTML content */}
                <style>{`
                    .blog-html-content h2 {
                        font-size: 1.125rem;
                        color: #ffb366;
                        margin-top: 1.5rem;
                        margin-bottom: 0.5rem;
                        text-shadow: 0 0 8px rgba(255,107,0,0.2);
                    }
                    .blog-html-content h3 {
                        font-size: 1rem;
                        color: #ffb366;
                        margin-top: 1.25rem;
                        margin-bottom: 0.5rem;
                    }
                    .blog-html-content h4 {
                        font-size: 0.875rem;
                        color: #ffb366;
                        margin-top: 1rem;
                        margin-bottom: 0.25rem;
                    }
                    .blog-html-content p {
                        font-size: 0.875rem;
                        line-height: 1.75;
                        color: rgba(226, 232, 240, 0.85);
                        margin-bottom: 0.75rem;
                    }
                    .blog-html-content strong {
                        color: #f1f5f9;
                    }
                    .blog-html-content em {
                        font-style: italic;
                    }
                    .blog-html-content ul, .blog-html-content ol {
                        padding-left: 1.5rem;
                        margin-bottom: 0.75rem;
                        color: rgba(226, 232, 240, 0.85);
                        font-size: 0.875rem;
                        line-height: 1.75;
                    }
                    .blog-html-content ul { list-style-type: disc; }
                    .blog-html-content ol { list-style-type: decimal; }
                    .blog-html-content ul li::marker,
                    .blog-html-content ol li::marker { color: #ffb366; }
                    .blog-html-content li { margin-bottom: 0.25rem; }
                    .blog-html-content blockquote {
                        border-left: 3px solid rgba(255,107,0,0.4);
                        padding-left: 1rem;
                        color: rgba(226,232,240,0.7);
                        font-style: italic;
                        margin: 0.75rem 0;
                    }
                    .blog-html-content a {
                        color: #ff8c33;
                        text-decoration: underline;
                        text-underline-offset: 3px;
                    }
                    .blog-html-content hr {
                        border: none;
                        border-top: 1px solid rgba(255,107,0,0.2);
                        margin: 1.5rem 0;
                    }
                    .blog-html-content pre {
                        background: rgba(0, 5, 15, 0.85);
                        border: 1px solid rgba(255,107,0,0.25);
                        border-radius: 0.5rem;
                        padding: 1rem;
                        margin: 0.75rem 0;
                        overflow-x: auto;
                        position: relative;
                    }
                    .blog-html-content pre code {
                        font-family: "Cascadia Code", "Fira Code", monospace;
                        font-size: 0.8rem;
                        color: #a5f3fc;
                        background: none;
                        padding: 0;
                        line-height: 1.6;
                    }
                    .blog-html-content code {
                        font-family: "Cascadia Code", "Fira Code", monospace;
                        font-size: 0.8rem;
                        background: rgba(255,107,0,0.15);
                        color: #a5f3fc;
                        padding: 0.15rem 0.4rem;
                        border-radius: 0.25rem;
                    }
                    .blog-copy-btn {
                        position: absolute;
                        top: 0.5rem;
                        right: 0.5rem;
                        font-family: "Cascadia Code", monospace;
                        font-size: 0.65rem;
                        padding: 0.25rem 0.6rem;
                        border-radius: 0.25rem;
                        background: rgba(255,107,0,0.15);
                        border: 1px solid rgba(255,107,0,0.3);
                        color: rgba(255,179,102,0.7);
                        cursor: pointer;
                        transition: all 0.2s;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    .blog-copy-btn:hover {
                        background: rgba(255,107,0,0.3);
                        color: #ffb366;
                    }
                    .blog-copy-btn.copied {
                        background: rgba(34,197,94,0.2);
                        border-color: rgba(34,197,94,0.4);
                        color: #4ade80;
                    }
                `}</style>

                {/* HTML content from TipTap */}
                {postContentHtml && (
                    <div
                        className="blog-html-content"
                        dangerouslySetInnerHTML={{ __html: postContentHtml }}
                    />
                )}

                {/* Legacy block rendering (text blocks) â€” only if no content_html */}
                {!postContentHtml && (post.content_blocks || []).filter(
                    (b) => b.type === 'heading' || b.type === 'paragraph' || b.type === 'bullets'
                ).map((block, i) => {
                    switch (block.type) {
                        case 'heading':
                            const Tag = `h${block.level || 2}`
                            return (
                                <Tag key={i} className="mt-6" style={{
                                    color: '#ffb366',
                                    fontSize: block.level === 2 ? '1.125rem' : block.level === 3 ? '1rem' : '0.875rem',
                                    textShadow: '0 0 8px rgba(255, 107, 0, 0.2)',
                                }}>
                                    {renderInlineText(block.text)}
                                </Tag>
                            )
                        case 'paragraph':
                            return (
                                <p key={i} className="text-sm leading-relaxed" style={{ color: 'rgba(226, 232, 240, 0.85)' }}>
                                    {renderInlineText(block.text)}
                                </p>
                            )
                        case 'bullets':
                            return (
                                <ul key={i} className="space-y-1.5 pl-1" style={{ color: 'rgba(226, 232, 240, 0.85)' }}>
                                    {(block.items || []).map((item, j) => (
                                        <li key={j} className="flex items-start gap-2 text-sm leading-relaxed">
                                            <span className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: '#ffb366' }} />
                                            <span>{renderInlineText(item)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )
                        default:
                            return null
                    }
                })}

                {/* Media blocks (always rendered â€” both old and new posts) */}
                <div className="space-y-5 mt-5">
                    {(post.content_blocks || []).filter(
                        (b) => b.type === 'image' || b.type === 'video'
                    ).map((block, i) => {
                        if (block.type === 'image') {
                            return (
                                <figure key={`media-${i}`} className="rounded-lg overflow-hidden">
                                    <img
                                        src={block.src?.startsWith('http') ? block.src : `/${block.src}`}
                                        alt={block.alt || ''}
                                        className="w-full rounded-lg"
                                        loading="lazy"
                                    />
                                    {block.caption && (
                                        <figcaption className="text-[10px] mt-2 text-center" style={{ color: 'rgba(255, 179, 102, 0.5)' }}>
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
                                        <div className="relative rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                                            <iframe
                                                src={`https://www.youtube.com/embed/${ytId}`}
                                                title={block.caption || 'Video'}
                                                className="absolute inset-0 w-full h-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                style={{ border: 'none' }}
                                            />
                                        </div>
                                    ) : (
                                        <a href={block.url} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: '#ff8c33' }}>
                                            ▶ {block.url}
                                        </a>
                                    )}
                                    {block.caption && (
                                        <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(255, 179, 102, 0.5)' }}>
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
        </div>
    )
}

// â”€â”€â”€ Main Section5 Component â”€â”€â”€
export default function Section5({ initialPostSlug, onPostSlugChange }) {
    const { t } = useLanguage()
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
            }
        } catch { /* silent */ }
    }, [onPostSlugChange])

    // Separate featured from regular posts
    const featuredPost = useMemo(() => posts.find((p) => p.featured), [posts])
    const regularPosts = useMemo(() => posts.filter((p) => !p.featured), [posts])

    // Wrapper with dark CRT background — bg set by sectionBgOverrides in App.jsx
    const containerStyle = {
        position: 'relative',
        minHeight: '100%',
        paddingBottom: '6rem',
    }

    // Single post view
    if (selectedPost) {
        return (
            <div className="pointer-events-auto" style={containerStyle}>
                {/* CRT scanline overlay */}
                <div
                    className="fixed inset-0 pointer-events-none z-[2]"
                    style={{
                        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)',
                    }}
                />
                <BlogPostView
                    post={selectedPost}
                    onBack={() => { setSelectedPost(null); if (onPostSlugChange) onPostSlugChange(null) }}
                    shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/blog/${selectedPost.slug}` : ''}
                />
            </div>
        )
    }

    return (
        <div className="pointer-events-auto" style={containerStyle}>
            {/* CRT scanline overlay */}
            <div
                className="fixed inset-0 pointer-events-none z-[2]"
                style={{
                    background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)',
                }}
            />

            {/* Header */}
            <div className="text-center mb-8">
                <h1
                    className="text-2xl md:text-3xl mb-2 tracking-tight"
                    style={{
                        fontFamily: '"Cascadia Code", "Fira Code", monospace',
                        color: '#f1f5f9',
                        textShadow: '0 0 20px rgba(255, 107, 0, 0.3)',
                    }}
                >
                    {'>'} BLOG_
                </h1>
                <p className="text-xs" style={{ color: 'rgba(255, 179, 102, 0.6)', fontFamily: '"Cascadia Code", monospace' }}>
          // thoughts, projects, and digital experiments
                </p>
            </div>

            {/* Search bar */}
            <div className="relative max-w-xl mx-auto mb-6">
                <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: 'rgba(255, 179, 102, 0.5)', fontFamily: '"Cascadia Code", monospace' }}
                >
                    &gt;_
                </span>
                <input
                    type="text"
                    placeholder="search_posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{
                        fontFamily: '"Cascadia Code", "Fira Code", monospace',
                        background: 'rgba(0, 5, 15, 0.8)',
                        border: '1px solid rgba(255, 107, 0, 0.25)',
                        color: '#e2d4f0',
                        caretColor: '#ff8c33',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(255, 107, 0, 0.5)'; e.target.style.boxShadow = '0 0 15px rgba(255, 107, 0, 0.15)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 107, 0, 0.25)'; e.target.style.boxShadow = 'none' }}
                />
            </div>

            {/* Tag filter pills */}
            {allTags.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                    <button
                        onClick={() => setActiveTag(null)}
                        className="px-3 py-1 rounded-full text-[11px] uppercase tracking-wider transition-all"
                        style={{
                            background: !activeTag ? 'rgba(255, 107, 0, 0.25)' : 'rgba(255, 107, 0, 0.06)',
                            border: `1px solid ${!activeTag ? 'rgba(255, 107, 0, 0.5)' : 'rgba(255, 107, 0, 0.2)'}`,
                            color: !activeTag ? '#e2d4f0' : 'rgba(255, 179, 102, 0.7)',
                        }}
                    >
                        all
                    </button>
                    {allTags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                            className="px-3 py-1 rounded-full text-[11px] uppercase tracking-wider transition-all"
                            style={{
                                background: activeTag === tag ? 'rgba(255, 107, 0, 0.25)' : 'rgba(255, 107, 0, 0.06)',
                                border: `1px solid ${activeTag === tag ? 'rgba(255, 107, 0, 0.5)' : 'rgba(255, 107, 0, 0.2)'}`,
                                color: activeTag === tag ? '#e2d4f0' : 'rgba(255, 179, 102, 0.7)',
                            }}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-16">
                    <div
                        className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
                        style={{ borderColor: 'rgba(255, 107, 0, 0.5)', borderTopColor: 'transparent' }}
                    />
                    <p className="text-xs" style={{ color: 'rgba(255, 179, 102, 0.5)', fontFamily: '"Cascadia Code", monospace' }}>
                        &gt; loading_posts...
                    </p>
                </div>
            )}

            {/* No results */}
            {!loading && posts.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-xs" style={{ color: 'rgba(255, 179, 102, 0.5)', fontFamily: '"Cascadia Code", monospace' }}>
                        &gt; no posts found{searchQuery ? ` for "${searchQuery}"` : ''}
                    </p>
                </div>
            )}

            {/* Featured post hero */}
            {!loading && featuredPost && (
                <FeaturedHero post={featuredPost} onSelect={handleSelectPost} />
            )}

            {/* Post grid */}
            {!loading && regularPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {regularPosts.map((post) => (
                        <BlogCard key={post.id} post={post} onSelect={handleSelectPost} />
                    ))}
                </div>
            )}
        </div>
    )
}
