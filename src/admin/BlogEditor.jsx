/**
 * Blog Post Editor — TipTap Rich Text
 * WYSIWYG editor with formatting toolbar
 * Replaces block-based editor with natural text editing experience
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
    ArrowLeftIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    ArrowPathIcon,
    PlusIcon,
    TrashIcon,
    StarIcon,
    PhotoIcon,
    FilmIcon,
    CheckIcon,
    ChevronDownIcon,
    DocumentTextIcon,
    LanguageIcon,
    PencilSquareIcon,
    SparklesIcon,
} from '@heroicons/react/24/solid'
import OptimizationToast from './OptimizationToast'
import TipTapToolbar from './TipTapToolbar'

const API = '/api/blog.php'
const UPLOAD_API = '/api/upload.php'
const TRANSLATE_API = '/api/translate.php'

// Labels that wrap a visually hidden file input: keep a visible focus ring
// for keyboard users.
const FILE_LABEL_FOCUS = 'relative cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-section-quests'

/* ────────────────────── Convert legacy blocks → HTML ────────────────────── */
function blocksToHtml(blocks) {
    if (!blocks || blocks.length === 0) return ''
    return blocks.map((b) => {
        switch (b.type) {
            case 'heading': {
                const lvl = b.level || 2
                return `<h${lvl}>${b.text || ''}</h${lvl}>`
            }
            case 'paragraph':
                return `<p>${(b.text || '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')}</p>`
            case 'bullets':
                return `<ul>${(b.items || []).map((item) => `<li>${item}</li>`).join('')}</ul>`
            default:
                return ''
        }
    }).filter(Boolean).join('\n')
}

/* ────────────────────── Media Block (Image or Video) ────────────────────── */
function MediaBlock({ block, index, onUpdate, onRemove, onMoveUp, onMoveDown, onOptimized }) {
    const [uploading, setUploading] = useState(false)

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('context', 'blog')
            fd.append('project_id', 'blog')
            fd.append('is_cover', '0')
            const res = await fetch(UPLOAD_API, { method: 'POST', credentials: 'include', body: fd })
            const json = await res.json()
            if (json.ok && json.file?.path) {
                onUpdate({ ...block, src: json.file.path })
                // Show optimization feedback
                if (json.optimization) {
                    onOptimized?.(json.optimization)
                }
            }
        } catch { /* silent */ }
        finally { setUploading(false) }
    }

    const isImage = block.type === 'image'
    const TypeIcon = isImage ? PhotoIcon : FilmIcon

    return (
        <div className="a-inset p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <TypeIcon className="w-4 h-4 text-white/50 shrink-0" aria-hidden />
                    <span className="text-sm font-semibold text-white/80">
                        {isImage ? 'Image' : 'YouTube video'}
                    </span>
                    <span className="a-meta">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={onMoveUp} className="a-icon-btn a-icon-btn--sm" aria-label="Move up" title="Move up">
                        <ArrowUpIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={onMoveDown} className="a-icon-btn a-icon-btn--sm" aria-label="Move down" title="Move down">
                        <ArrowDownIcon className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={onRemove} className="a-icon-btn a-icon-btn--sm a-icon-btn--danger" aria-label="Remove" title="Remove">
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {isImage && (
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <input
                            className="a-input flex-1 min-w-0"
                            value={block.src || ''}
                            onChange={(e) => onUpdate({ ...block, src: e.target.value })}
                            placeholder="Image path or URL"
                            aria-label="Image path or URL"
                        />
                        <label className={`a-btn a-btn--secondary a-btn--sm shrink-0 ${FILE_LABEL_FOCUS}`}>
                            {uploading ? 'Uploading…' : 'Upload'}
                            <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                        </label>
                    </div>
                    {block.src && (
                        <img
                            src={block.src.startsWith('http') ? block.src : `/${block.src}`}
                            alt=""
                            className="max-h-32 rounded-lg border-2 border-white/10"
                        />
                    )}
                    <input
                        className="a-input"
                        value={block.alt || ''}
                        onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
                        placeholder="Alt text"
                        aria-label="Alt text"
                    />
                    <input
                        className="a-input"
                        value={block.caption || ''}
                        onChange={(e) => onUpdate({ ...block, caption: e.target.value })}
                        placeholder="Caption (optional)"
                        aria-label="Caption"
                    />
                </div>
            )}

            {block.type === 'video' && (
                <div className="space-y-2.5">
                    <input
                        className="a-input"
                        value={block.url || ''}
                        onChange={(e) => onUpdate({ ...block, url: e.target.value })}
                        placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                        aria-label="YouTube URL"
                    />
                    <input
                        className="a-input"
                        value={block.caption || ''}
                        onChange={(e) => onUpdate({ ...block, caption: e.target.value })}
                        placeholder="Caption (optional)"
                        aria-label="Caption"
                    />
                </div>
            )}
        </div>
    )
}

/* ════════════════════════════════════════════════════════════════
   BlogEditor — Main Component
   ════════════════════════════════════════════════════════════════ */
export default function BlogEditor({ postId = null, onBack, onSaved }) {
    const [loading, setLoading] = useState(!!postId)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    // Post fields
    const [title, setTitle] = useState('')
    const [subtitle, setSubtitle] = useState('')
    const [slug, setSlug] = useState('')
    const [coverImage, setCoverImage] = useState('')
    const [tags, setTags] = useState('')
    const [excerpt, setExcerpt] = useState('')
    const [published, setPublished] = useState(false)
    const [featured, setFeatured] = useState(false)
    const [createdAt, setCreatedAt] = useState(null)
    const [uploadingCover, setUploadingCover] = useState(false)
    const [optimizationData, setOptimizationData] = useState(null)

    // All existing tags (fetched from API for suggestions)
    const [allTags, setAllTags] = useState([])

    // Spanish translation fields
    const [titleEs, setTitleEs] = useState('')
    const [subtitleEs, setSubtitleEs] = useState('')
    const [excerptEs, setExcerptEs] = useState('')
    const [contentHtmlEs, setContentHtmlEs] = useState('')
    const [showTranslation, setShowTranslation] = useState(false)
    const [translating, setTranslating] = useState(false)

    // Media blocks (images + videos only — text is in TipTap HTML)
    const [mediaBlocks, setMediaBlocks] = useState([])

    // TipTap editor (main English content)
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3, 4] },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'tiptap-link' },
            }),
            Image.configure({ inline: false, allowBase64: false }),
            Placeholder.configure({
                placeholder: 'Start writing your post. Paste text and format it with the toolbar.',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'tiptap-editor-content',
            },
        },
    })

    // TipTap editor (Spanish translation)
    const editorEs = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3, 4] },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'tiptap-link' },
            }),
            Image.configure({ inline: false, allowBase64: false }),
            Placeholder.configure({
                placeholder: 'Escribe el contenido traducido aquí...',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'tiptap-editor-content',
            },
        },
    })

    // Load existing post
    useEffect(() => {
        if (!postId || !editor || !editorEs) return
        let canceled = false
            ; (async () => {
                try {
                    const res = await fetch(`${API}?admin=1`, { credentials: 'include' })
                    const json = await res.json()
                    if (!json.ok) throw new Error(json.error || 'Could not load the post')
                    // Capture all existing tags for suggestions
                    if (json.allTags) setAllTags(json.allTags)
                    // El id llega como string cuando se abre /admin/blog/edit/:id directo.
                    const post = json.posts?.find((p) => String(p.id) === String(postId))
                    if (!post) throw new Error('Post not found')
                    if (canceled) return
                    setTitle(post.title || '')
                    setSubtitle(post.subtitle || '')
                    setSlug(post.slug || '')
                    setCoverImage((post.cover_image || '').replace(/^\/+/, ''))
                    setTags((post.tags || []).join(', '))
                    setExcerpt(post.excerpt || '')
                    setPublished(!!post.published)
                    setFeatured(!!post.featured)
                    setCreatedAt(post.created_at || null)

                    // Spanish translations
                    setTitleEs(post.title_es || '')
                    setSubtitleEs(post.subtitle_es || '')
                    setExcerptEs(post.excerpt_es || '')
                    setContentHtmlEs(post.content_html_es || '')
                    if (post.content_html_es) editorEs.commands.setContent(post.content_html_es)
                    if (post.title_es || post.content_html_es) setShowTranslation(true)

                    // Load content — prefer content_html, fallback to legacy blocks
                    if (post.content_html) {
                        editor.commands.setContent(post.content_html)
                    } else if (post.content_blocks?.length > 0) {
                        // Convert legacy blocks to HTML
                        const textBlocks = post.content_blocks.filter(
                            (b) => b.type === 'heading' || b.type === 'paragraph' || b.type === 'bullets'
                        )
                        const media = post.content_blocks.filter(
                            (b) => b.type === 'image' || b.type === 'video'
                        )
                        editor.commands.setContent(blocksToHtml(textBlocks))
                        setMediaBlocks(media)
                    }
                } catch (e) {
                    if (!canceled) setError(e.message)
                } finally {
                    if (!canceled) setLoading(false)
                }
            })()
        return () => { canceled = true }
    }, [postId, editor])

    // Fetch existing tags for new posts (no postId)
    useEffect(() => {
        if (postId) return
            ; (async () => {
                try {
                    const res = await fetch(`${API}?limit=1`, { credentials: 'include' })
                    const json = await res.json()
                    if (json.ok && json.allTags) setAllTags(json.allTags)
                } catch { /* silent */ }
            })()
    }, [postId])

    // Auto-generate slug from title
    useEffect(() => {
        if (postId) return
        const s = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
        setSlug(s || '')
    }, [title, postId])

    // Cover upload
    const handleCoverUpload = useCallback(async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingCover(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('context', 'blog')
            fd.append('project_id', 'blog')
            fd.append('is_cover', '0')
            const res = await fetch(UPLOAD_API, { method: 'POST', credentials: 'include', body: fd })
            const json = await res.json()
            if (json.ok && json.file?.path) {
                // Normalise path — strip any leading slashes to avoid double-slash URLs
                setCoverImage(json.file.path.replace(/^\/+/, ''))
                // Show optimization feedback
                if (json.optimization) {
                    setOptimizationData(json.optimization)
                }
            } else {
                setError('Cover upload failed')
            }
        } catch {
            setError('Cover upload failed')
        } finally {
            setUploadingCover(false)
            // Reset input so re-uploading the same file triggers onChange
            if (e.target) e.target.value = ''
        }
    }, [])

    // Media block operations
    const addMedia = (type) => {
        if (type === 'image') {
            setMediaBlocks((prev) => [...prev, { type: 'image', src: '', alt: '', caption: '' }])
        } else {
            setMediaBlocks((prev) => [...prev, { type: 'video', url: '', caption: '' }])
        }
    }
    const removeMedia = (i) => setMediaBlocks((prev) => prev.filter((_, idx) => idx !== i))
    const updateMedia = (i, block) => setMediaBlocks((prev) => prev.map((b, idx) => idx === i ? block : b))
    const moveMedia = (i, dir) => {
        setMediaBlocks((prev) => {
            const copy = [...prev]
            const j = i + dir
            if (j < 0 || j >= copy.length) return prev
                ;[copy[i], copy[j]] = [copy[j], copy[i]]
            return copy
        })
    }

    // Save
    const save = async () => {
        if (!title.trim()) { setError('Title is required'); return }
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean)
            const contentHtml = editor?.getHTML() || ''

            const body = {
                title: title.trim(),
                subtitle: subtitle.trim() || null,
                slug: slug.trim() || undefined,
                cover_image: coverImage || null,
                tags: tagsArr,
                content_html: contentHtml,
                // Still save media blocks separately for frontend rendering
                content_blocks: mediaBlocks.filter((b) => b.type === 'image' || b.type === 'video'),
                excerpt: excerpt.trim() || null,
                title_es: titleEs.trim() || null,
                subtitle_es: subtitleEs.trim() || null,
                content_html_es: (editorEs?.getHTML() || '').trim() || null,
                excerpt_es: excerptEs.trim() || null,
                published,
                featured,
            }
            if (postId) body.id = postId

            const res = await fetch(API, {
                method: postId ? 'PUT' : 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const json = await res.json()
            if (!json.ok) throw new Error(json.error || 'Save failed')
            setSuccess(postId ? 'Post updated' : 'Post created')
            setTimeout(() => onSaved?.(), 600)
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="a-spinner" role="status" aria-label="Loading post" />
            </div>
        )
    }

    const currentTags = tags.split(',').map((t) => t.trim()).filter(Boolean)

    return (
        <div className="w-full a-fade-in">
            {/* Post body typography inside the TipTap editors */}
            <style>{`
                .tiptap-editor-content {
                    font-family: var(--font-body);
                    font-size: 0.9375rem;
                    line-height: 1.7;
                    color: rgba(255, 255, 255, 0.85);
                    min-height: 300px;
                    outline: none;
                    padding: 1rem 1.125rem;
                }
                .tiptap-editor-content p {
                    margin-bottom: 0.75rem;
                }
                .tiptap-editor-content h2,
                .tiptap-editor-content h3,
                .tiptap-editor-content h4 {
                    font-weight: 700;
                    line-height: 1.3;
                    color: #fff;
                }
                .tiptap-editor-content h2 {
                    font-size: 1.375rem;
                    margin-top: 1.5rem;
                    margin-bottom: 0.5rem;
                }
                .tiptap-editor-content h3 {
                    font-size: 1.125rem;
                    margin-top: 1.25rem;
                    margin-bottom: 0.5rem;
                }
                .tiptap-editor-content h4 {
                    font-size: 1rem;
                    color: rgba(255, 255, 255, 0.85);
                    margin-top: 1rem;
                    margin-bottom: 0.25rem;
                }
                .tiptap-editor-content > :first-child {
                    margin-top: 0;
                }
                .tiptap-editor-content strong {
                    font-weight: 700;
                    color: #fff;
                }
                .tiptap-editor-content em {
                    font-style: italic;
                }
                .tiptap-editor-content ul,
                .tiptap-editor-content ol {
                    padding-left: 1.5rem;
                    margin-bottom: 0.75rem;
                }
                .tiptap-editor-content ul {
                    list-style-type: disc;
                }
                .tiptap-editor-content ol {
                    list-style-type: decimal;
                }
                .tiptap-editor-content li::marker {
                    color: rgba(255, 255, 255, 0.45);
                }
                .tiptap-editor-content li {
                    margin-bottom: 0.25rem;
                }
                .tiptap-editor-content blockquote {
                    border-left: 2px solid rgba(255, 255, 255, 0.2);
                    padding-left: 1rem;
                    color: rgba(255, 255, 255, 0.65);
                    font-style: italic;
                    margin: 0.75rem 0;
                }
                .tiptap-editor-content a,
                .tiptap-editor-content .tiptap-link {
                    color: var(--a-accent);
                    text-decoration: underline;
                    text-underline-offset: 3px;
                    cursor: pointer;
                }
                .tiptap-editor-content hr {
                    border: none;
                    border-top: 2px solid rgba(255, 255, 255, 0.1);
                    margin: 1.5rem 0;
                }
                .tiptap-editor-content pre {
                    background: var(--a-surface);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-radius: 0.75rem;
                    padding: 0.875rem 1rem;
                    margin: 0.75rem 0;
                    overflow-x: auto;
                }
                .tiptap-editor-content code {
                    font-family: var(--font-mono);
                    font-size: 0.8125rem;
                    background: rgba(255, 255, 255, 0.08);
                    color: #fff;
                    padding: 0.1rem 0.35rem;
                    border-radius: 0.375rem;
                }
                .tiptap-editor-content pre code {
                    background: none;
                    color: rgba(255, 255, 255, 0.85);
                    padding: 0;
                    line-height: 1.6;
                }
                .tiptap-editor-content s {
                    text-decoration: line-through;
                    opacity: 0.6;
                }
                .tiptap-editor-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 0.75rem;
                    margin: 0.75rem 0;
                    border: 2px solid rgba(255, 255, 255, 0.1);
                }
                .tiptap-editor-content img.ProseMirror-selectednode {
                    outline: 2px solid var(--a-accent);
                    outline-offset: 2px;
                }
                .tiptap-editor-content p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    color: rgba(255, 255, 255, 0.28);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>

            <header className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
                <button
                    type="button"
                    onClick={onBack}
                    className="a-icon-btn"
                    aria-label="Back to posts"
                    title="Back to posts"
                >
                    <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                    <h1 className="a-title">{postId ? 'Edit post' : 'New post'}</h1>
                    <p className="a-subtitle">
                        {createdAt
                            ? `Created ${new Date(createdAt).toLocaleDateString()}`
                            : 'Write it in English. The Spanish version is optional.'}
                    </p>
                </div>
            </header>

            <div className="max-w-4xl space-y-6">
                {error && (
                    <div className="a-alert a-alert--danger px-4 py-3" role="alert">
                        <span className="min-w-0 break-words">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="a-alert a-alert--success px-4 py-3" role="status">
                        <CheckIcon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                        <span>{success}</span>
                    </div>
                )}

                {/* ─── Details ─── */}
                <section className="a-section">
                    <h2 className="a-section-title flex items-center gap-2 mb-5">
                        <DocumentTextIcon className="w-5 h-5 text-white/50" aria-hidden />
                        Details
                    </h2>
                    <div className="space-y-5">
                        <div>
                            <label htmlFor="post-title" className="a-label">Title</label>
                            <input
                                id="post-title"
                                className="a-input"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Post title"
                            />
                        </div>

                        <div>
                            <label htmlFor="post-subtitle" className="a-label">Subtitle</label>
                            <input
                                id="post-subtitle"
                                className="a-input"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                placeholder="Optional subtitle"
                            />
                        </div>

                        <div>
                            <label htmlFor="post-slug" className="a-label">Slug</label>
                            <div className="flex items-center gap-2">
                                <span className="a-code text-white/45 shrink-0">/blog/</span>
                                <input
                                    id="post-slug"
                                    className="a-input flex-1 min-w-0"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="auto-generated-slug"
                                    aria-describedby="post-slug-help"
                                />
                            </div>
                            <p id="post-slug-help" className="a-help mt-1.5">
                                The post URL. New posts generate it from the title.
                            </p>
                        </div>

                        <div>
                            <label htmlFor="post-excerpt" className="a-label">Excerpt</label>
                            <textarea
                                id="post-excerpt"
                                className="a-input"
                                rows={2}
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                placeholder="Brief preview for the blog card…"
                                aria-describedby="post-excerpt-help"
                            />
                            <p id="post-excerpt-help" className="a-help mt-1.5">Preview text for the blog card.</p>
                        </div>
                    </div>
                </section>

                {/* ─── Cover and tags ─── */}
                <section className="a-section">
                    <h2 className="a-section-title flex items-center gap-2 mb-5">
                        <PhotoIcon className="w-5 h-5 text-white/50" aria-hidden />
                        Cover and tags
                    </h2>
                    <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                        <div>
                            <div className="a-label">Cover image</div>
                            {coverImage ? (
                                <div className="space-y-3">
                                    <div className="a-inset overflow-hidden aspect-video">
                                        <img src={`/${coverImage.replace(/^\/+/, '')}`} alt="Cover" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {/* Allow re-uploading a new cover without deleting first */}
                                        <label className={`a-btn a-btn--secondary a-btn--sm ${FILE_LABEL_FOCUS}`}>
                                            <PhotoIcon className="w-3.5 h-3.5" aria-hidden />
                                            {uploadingCover ? 'Uploading…' : 'Replace'}
                                            <input type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} disabled={uploadingCover} />
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setCoverImage('')}
                                            className="a-btn a-btn--danger a-btn--sm"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <label
                                    className={`a-inset border-dashed aspect-video flex flex-col items-center justify-center gap-2 text-sm font-semibold text-white/55 hover:text-white hover:border-white/30 transition-colors ${FILE_LABEL_FOCUS}`}
                                >
                                    <PhotoIcon className="w-6 h-6" aria-hidden />
                                    <span>{uploadingCover ? 'Uploading…' : 'Upload cover'}</span>
                                    <input type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} disabled={uploadingCover} />
                                </label>
                            )}
                        </div>

                        <div className="min-w-0">
                            <label htmlFor="post-tags" className="a-label">Tags</label>
                            <input
                                id="post-tags"
                                className="a-input"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                placeholder="design, blockchain, 3d"
                                aria-describedby="post-tags-help"
                            />
                            <p id="post-tags-help" className="a-help mt-1.5">Separate tags with commas.</p>
                            {tags && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {currentTags.map((t, i) => (
                                        <span key={i} className="a-badge">{t}</span>
                                    ))}
                                </div>
                            )}
                            {/* Tag suggestions from existing posts */}
                            {allTags.length > 0 && (
                                <div className="mt-4">
                                    <p className="a-help mb-2">Existing tags — click to add</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {allTags.map((t) => {
                                            const isActive = currentTags.map((x) => x.toLowerCase()).includes(t.toLowerCase())
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isActive) return
                                                        setTags((prev) => prev ? `${prev.replace(/,\s*$/, '')}, ${t}` : t)
                                                    }}
                                                    className={`a-chip ${isActive ? 'is-active cursor-default' : ''}`}
                                                >
                                                    {isActive
                                                        ? <CheckIcon className="w-3 h-3" aria-hidden />
                                                        : <PlusIcon className="w-3 h-3" aria-hidden />}
                                                    {t}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* ─── Rich Text Editor ─── */}
                <section className="a-section">
                    <h2 className="a-section-title flex items-center gap-2 mb-4">
                        <PencilSquareIcon className="w-5 h-5 text-white/50" aria-hidden />
                        Content
                    </h2>
                    <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
                        <TipTapToolbar editor={editor} context="blog" contextId={postId} />
                        <EditorContent editor={editor} />
                    </div>
                    <p className="a-help mt-2">
                        Paste text, then format it with the toolbar: bold, italic, headings, lists, links and quotes.
                    </p>
                </section>

                {/* ─── Spanish Translation (collapsible) ─── */}
                <section className="a-section">
                    <button
                        type="button"
                        onClick={() => setShowTranslation((v) => !v)}
                        aria-expanded={showTranslation}
                        aria-controls="post-translation"
                        className="w-full flex items-center gap-3 text-left rounded-[var(--a-radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-quests"
                    >
                        <LanguageIcon className="w-5 h-5 text-white/50 shrink-0" aria-hidden />
                        <span className="flex-1 min-w-0">
                            <span className="a-section-title block">Spanish version</span>
                            <span className="a-help block mt-0.5">Optional. Title, subtitle, excerpt and content in Spanish.</span>
                        </span>
                        <ChevronDownIcon
                            className={`w-5 h-5 text-white/50 shrink-0 transition-transform ${showTranslation ? 'rotate-180' : ''}`}
                            aria-hidden
                        />
                    </button>
                    {showTranslation && (
                        <div id="post-translation" className="mt-5 space-y-5">
                            {/* Auto-translate button */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <p className="a-help flex-1">
                                    Translates the title, subtitle, excerpt and content from English to Spanish.
                                </p>
                                <button
                                    type="button"
                                    disabled={translating || (!title.trim() && !editor?.getHTML())}
                                    onClick={async () => {
                                        setTranslating(true)
                                        setError(null)
                                        try {
                                            const texts = {}
                                            if (title.trim()) texts.title = title.trim()
                                            if (subtitle.trim()) texts.subtitle = subtitle.trim()
                                            if (excerpt.trim()) texts.excerpt = excerpt.trim()
                                            const html = editor?.getHTML() || ''
                                            if (html && html !== '<p></p>') texts.content_html = html
                                            if (Object.keys(texts).length === 0) return
                                            const res = await fetch(TRANSLATE_API, {
                                                method: 'POST',
                                                credentials: 'include',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ texts, from: 'en', to: 'es' }),
                                            })
                                            const json = await res.json()
                                            if (!json.ok) throw new Error(json.error || 'Translation failed')
                                            const t = json.translations || {}
                                            if (t.title) setTitleEs(t.title)
                                            if (t.subtitle) setSubtitleEs(t.subtitle)
                                            if (t.excerpt) setExcerptEs(t.excerpt)
                                            if (t.content_html) {
                                                setContentHtmlEs(t.content_html)
                                                if (editorEs) editorEs.commands.setContent(t.content_html)
                                            }
                                            setSuccess('Translation complete')
                                            setTimeout(() => setSuccess(null), 2000)
                                        } catch (e) {
                                            setError('Translation error: ' + e.message)
                                        } finally {
                                            setTranslating(false)
                                        }
                                    }}
                                    className="a-btn a-btn--secondary a-btn--sm shrink-0 self-start sm:self-auto"
                                >
                                    {translating ? (
                                        <><ArrowPathIcon className="w-3.5 h-3.5 animate-spin" aria-hidden />Translating…</>
                                    ) : (
                                        <><SparklesIcon className="w-3.5 h-3.5" aria-hidden />Auto-translate</>
                                    )}
                                </button>
                            </div>

                            <div>
                                <label htmlFor="post-title-es" className="a-label">Title</label>
                                <input
                                    id="post-title-es"
                                    className="a-input"
                                    value={titleEs}
                                    onChange={(e) => setTitleEs(e.target.value)}
                                    placeholder="Título en español"
                                />
                            </div>
                            <div>
                                <label htmlFor="post-subtitle-es" className="a-label">Subtitle</label>
                                <input
                                    id="post-subtitle-es"
                                    className="a-input"
                                    value={subtitleEs}
                                    onChange={(e) => setSubtitleEs(e.target.value)}
                                    placeholder="Subtítulo en español"
                                />
                            </div>
                            <div>
                                <label htmlFor="post-excerpt-es" className="a-label">Excerpt</label>
                                <textarea
                                    id="post-excerpt-es"
                                    className="a-input"
                                    rows={2}
                                    value={excerptEs}
                                    onChange={(e) => setExcerptEs(e.target.value)}
                                    placeholder="Texto de vista previa en español..."
                                />
                            </div>
                            <div>
                                <div className="a-label">Content</div>
                                <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
                                    <TipTapToolbar editor={editorEs} context="blog" contextId={postId} />
                                    <EditorContent editor={editorEs} />
                                </div>
                                <p className="a-help mt-2">Same formatting tools as the English content.</p>
                            </div>
                        </div>
                    )}
                </section>

                {/* ─── Media Blocks ─── */}
                <section className="a-section">
                    <h2 className="a-section-title flex items-center gap-2">
                        <FilmIcon className="w-5 h-5 text-white/50" aria-hidden />
                        Media embeds
                    </h2>
                    <p className="a-help mt-1 mb-4">Images and YouTube videos embedded in the post.</p>

                    {mediaBlocks.length === 0 && (
                        <div className="a-empty py-8 text-sm">No media yet. Add an image or a video below.</div>
                    )}

                    {mediaBlocks.length > 0 && (
                        <div className="space-y-3">
                            {mediaBlocks.map((block, i) => (
                                <MediaBlock
                                    key={i}
                                    block={block}
                                    index={i}
                                    onUpdate={(b) => updateMedia(i, b)}
                                    onRemove={() => removeMedia(i)}
                                    onMoveUp={() => moveMedia(i, -1)}
                                    onMoveDown={() => moveMedia(i, 1)}
                                    onOptimized={(data) => setOptimizationData(data)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-4">
                        <button
                            type="button"
                            onClick={() => addMedia('image')}
                            className="a-btn a-btn--secondary a-btn--sm"
                        >
                            <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                            Image
                        </button>
                        <button
                            type="button"
                            onClick={() => addMedia('video')}
                            className="a-btn a-btn--secondary a-btn--sm"
                        >
                            <PlusIcon className="w-3.5 h-3.5" aria-hidden />
                            YouTube video
                        </button>
                    </div>
                </section>
            </div>

            {/* ─── Sticky Save Bar ─── */}
            {/* Negative margins cancel the shell's page padding so the bar spans the full content width. */}
            <div className="sticky bottom-0 z-20 mt-8 -mx-4 sm:-mx-6 lg:-mx-10 -mb-4 sm:-mb-6 lg:-mb-10 px-4 sm:px-6 lg:px-10 py-3 bg-[var(--a-surface)] border-t-2 border-white/10">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    {error || success ? (
                        <p className="w-full sm:w-auto sm:flex-1 min-w-0 text-sm font-semibold truncate">
                            {error && <span className="text-red-300">{error}</span>}
                            {success && <span className="text-green-300">{success}</span>}
                        </p>
                    ) : (
                        <div className="hidden sm:block sm:flex-1" aria-hidden="true" />
                    )}
                    <div className="flex items-center gap-5">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-white/75">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={published}
                                aria-label="Published"
                                onClick={() => setPublished((v) => !v)}
                                className="a-switch focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-quests"
                            />
                            <span>Published</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-white/75">
                            <button
                                type="button"
                                role="switch"
                                aria-checked={featured}
                                aria-label="Featured"
                                onClick={() => setFeatured((v) => !v)}
                                className="a-switch focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-quests"
                            />
                            <StarIcon className={`w-4 h-4 ${featured ? 'text-yellow-400' : 'text-white/30'}`} aria-hidden />
                            <span>Featured</span>
                        </label>
                    </div>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="a-btn a-btn--primary ml-auto"
                    >
                        {saving ? 'Saving…' : postId ? 'Update post' : 'Create post'}
                    </button>
                </div>
            </div>

            {/* Image optimization feedback toast */}
            <OptimizationToast
                data={optimizationData}
                onDismiss={() => setOptimizationData(null)}
            />
        </div>
    )
}
