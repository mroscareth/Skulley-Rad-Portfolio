/**
 * Blog Post Editor — TipTap Rich Text
 * Terminal CRT theme — WYSIWYG editor with formatting toolbar
 * Replaces block-based editor with natural text editing experience
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
    ArrowLeftIcon,
    PlusIcon,
    TrashIcon,
    StarIcon,
    PhotoIcon,
    LinkIcon,
} from '@heroicons/react/24/solid'

const API = '/api/blog.php'
const UPLOAD_API = '/api/upload.php'
const TRANSLATE_API = '/api/translate.php'

/* ────────────────────── Toolbar Button ────────────────────── */
function ToolbarBtn({ active, onClick, title, children, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="px-2 py-1 rounded text-xs transition-all shrink-0"
            style={{
                fontFamily: '"Cascadia Code", monospace',
                background: active ? 'rgba(155, 48, 255, 0.25)' : 'transparent',
                border: `1px solid ${active ? 'rgba(155, 48, 255, 0.5)' : 'rgba(155, 48, 255, 0.08)'}`,
                color: active ? '#c084fc' : 'rgba(192, 132, 252, 0.6)',
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            {children}
        </button>
    )
}

/* ────────────────────── Formatting Toolbar ────────────────────── */
function EditorToolbar({ editor }) {
    if (!editor) return null

    const setLink = () => {
        const prev = editor.getAttributes('link').href
        const url = window.prompt('URL:', prev || 'https://')
        if (url === null) return
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
    }

    return (
        <div
            className="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-t-lg"
            style={{
                background: 'rgba(0, 5, 15, 0.9)',
                borderBottom: '1px solid rgba(155, 48, 255, 0.15)',
            }}
        >
            <ToolbarBtn
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
            >
                H2
            </ToolbarBtn>
            <ToolbarBtn
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
            >
                H3
            </ToolbarBtn>

            <span className="w-px h-4 mx-1" style={{ background: 'rgba(155,48,255,0.15)' }} />

            <ToolbarBtn
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
            >
                <strong>B</strong>
            </ToolbarBtn>
            <ToolbarBtn
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
            >
                <em>I</em>
            </ToolbarBtn>

            <span className="w-px h-4 mx-1" style={{ background: 'rgba(155,48,255,0.15)' }} />

            <ToolbarBtn
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
            >
                •&thinsp;list
            </ToolbarBtn>
            <ToolbarBtn
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered List"
            >
                1.&thinsp;list
            </ToolbarBtn>

            <span className="w-px h-4 mx-1" style={{ background: 'rgba(155,48,255,0.15)' }} />

            <ToolbarBtn
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Blockquote"
            >
                &ldquo;&rdquo;
            </ToolbarBtn>
            <ToolbarBtn
                active={editor.isActive('link')}
                onClick={setLink}
                title="Insert Link"
            >
                <LinkIcon className="w-3.5 h-3.5 inline" />
            </ToolbarBtn>
            <ToolbarBtn
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code Block"
            >
                {'</>'}
            </ToolbarBtn>

            <span className="w-px h-4 mx-1" style={{ background: 'rgba(155,48,255,0.15)' }} />

            <ToolbarBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
            >
                ─
            </ToolbarBtn>
        </div>
    )
}

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
function MediaBlock({ block, index, onUpdate, onRemove, onMoveUp, onMoveDown }) {
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
            }
        } catch { /* silent */ }
        finally { setUploading(false) }
    }

    return (
        <div
            className="rounded-lg p-3 mb-3 relative group"
            style={{
                background: 'rgba(0, 5, 15, 0.6)',
                border: '1px solid rgba(155, 48, 255, 0.12)',
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest admin-terminal-font"
                    style={{ color: 'rgba(192, 132, 252, 0.5)' }}
                >
                    [{index + 1}] {block.type === 'image' ? '🖼 image' : '▶ youtube'}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={onMoveUp} className="p-1 hover:bg-purple-500/10 rounded text-xs" style={{ color: '#c084fc' }}>↑</button>
                    <button onClick={onMoveDown} className="p-1 hover:bg-purple-500/10 rounded text-xs" style={{ color: '#c084fc' }}>↓</button>
                    <button onClick={onRemove} className="p-1 hover:bg-red-500/10 rounded">
                        <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                    </button>
                </div>
            </div>

            {block.type === 'image' && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <input
                            className="admin-input flex-1 px-3 py-2 rounded text-sm"
                            value={block.src || ''}
                            onChange={(e) => onUpdate({ ...block, src: e.target.value })}
                            placeholder="Image path or URL"
                        />
                        <label className="admin-btn-secondary px-3 py-2 rounded text-xs cursor-pointer shrink-0">
                            {uploading ? '...' : 'upload'}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                    </div>
                    {block.src && (
                        <img src={block.src.startsWith('http') ? block.src : `/${block.src}`} alt="" className="max-h-32 rounded" />
                    )}
                    <input
                        className="admin-input w-full px-3 py-1.5 rounded text-xs"
                        value={block.alt || ''}
                        onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
                        placeholder="Alt text"
                    />
                    <input
                        className="admin-input w-full px-3 py-1.5 rounded text-xs"
                        value={block.caption || ''}
                        onChange={(e) => onUpdate({ ...block, caption: e.target.value })}
                        placeholder="Caption (optional)"
                    />
                </div>
            )}

            {block.type === 'video' && (
                <div className="space-y-2">
                    <input
                        className="admin-input w-full px-3 py-2 rounded text-sm"
                        value={block.url || ''}
                        onChange={(e) => onUpdate({ ...block, url: e.target.value })}
                        placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
                    />
                    <input
                        className="admin-input w-full px-3 py-1.5 rounded text-xs"
                        value={block.caption || ''}
                        onChange={(e) => onUpdate({ ...block, caption: e.target.value })}
                        placeholder="Caption (optional)"
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
            Placeholder.configure({
                placeholder: 'Start writing your post... paste text, format with the toolbar above.',
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
                    if (!json.ok) throw new Error(json.error || 'fetch_error')
                    // Capture all existing tags for suggestions
                    if (json.allTags) setAllTags(json.allTags)
                    const post = json.posts?.find((p) => p.id === postId)
                    if (!post) throw new Error('not_found')
                    if (canceled) return
                    setTitle(post.title || '')
                    setSubtitle(post.subtitle || '')
                    setSlug(post.slug || '')
                    setCoverImage(post.cover_image || '')
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
                setCoverImage(json.file.path)
            } else {
                setError('upload_failed')
            }
        } catch {
            setError('upload_failed')
        } finally {
            setUploadingCover(false)
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
        if (!title.trim()) { setError('title_required'); return }
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
            if (!json.ok) throw new Error(json.error || 'save_failed')
            setSuccess(postId ? 'post_updated' : 'post_created')
            setTimeout(() => onSaved?.(), 600)
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; loading_post...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-6 admin-fade-in">
            {/* TipTap editor styles */}
            <style>{`
                .tiptap-editor-content {
                    font-family: "Cascadia Code", "Fira Code", monospace;
                    font-size: 0.875rem;
                    line-height: 1.7;
                    color: #e2e8f0;
                    min-height: 300px;
                    outline: none;
                    padding: 1rem;
                }
                .tiptap-editor-content p {
                    margin-bottom: 0.75rem;
                }
                .tiptap-editor-content h2 {
                    font-size: 1.25rem;
                    color: #c084fc;
                    margin-top: 1.5rem;
                    margin-bottom: 0.5rem;
                    text-shadow: 0 0 8px rgba(155,48,255,0.2);
                }
                .tiptap-editor-content h3 {
                    font-size: 1.05rem;
                    color: #c084fc;
                    margin-top: 1.25rem;
                    margin-bottom: 0.5rem;
                }
                .tiptap-editor-content h4 {
                    font-size: 0.95rem;
                    color: #c084fc;
                    margin-top: 1rem;
                    margin-bottom: 0.25rem;
                }
                .tiptap-editor-content strong {
                    color: #f1f5f9;
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
                .tiptap-editor-content ul li::marker {
                    color: #c084fc;
                }
                .tiptap-editor-content ol {
                    list-style-type: decimal;
                }
                .tiptap-editor-content ol li::marker {
                    color: #c084fc;
                }
                .tiptap-editor-content li {
                    margin-bottom: 0.25rem;
                }
                .tiptap-editor-content blockquote {
                    border-left: 3px solid rgba(155,48,255,0.4);
                    padding-left: 1rem;
                    color: rgba(226,232,240,0.7);
                    font-style: italic;
                    margin: 0.75rem 0;
                }
                .tiptap-editor-content a,
                .tiptap-editor-content .tiptap-link {
                    color: #a855f7;
                    text-decoration: underline;
                    text-underline-offset: 3px;
                    cursor: pointer;
                }
                .tiptap-editor-content hr {
                    border: none;
                    border-top: 1px solid rgba(155,48,255,0.2);
                    margin: 1.5rem 0;
                }
                .tiptap-editor-content pre {
                    background: rgba(0, 5, 15, 0.8);
                    border: 1px solid rgba(155,48,255,0.2);
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin: 0.75rem 0;
                    overflow-x: auto;
                }
                .tiptap-editor-content pre code {
                    font-family: "Cascadia Code", "Fira Code", monospace;
                    font-size: 0.8rem;
                    color: #a5f3fc;
                    background: none;
                    padding: 0;
                    line-height: 1.6;
                }
                .tiptap-editor-content code {
                    font-family: "Cascadia Code", "Fira Code", monospace;
                    font-size: 0.8rem;
                    background: rgba(155,48,255,0.15);
                    color: #a5f3fc;
                    padding: 0.15rem 0.4rem;
                    border-radius: 0.25rem;
                }
                .tiptap-editor-content p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    color: rgba(192,132,252,0.3);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
            `}</style>

            {/* Top bar */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="admin-btn-secondary flex items-center gap-2 px-3 py-1.5 rounded text-xs"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5" />
                    <span>back</span>
                </button>
                {createdAt && (
                    <span className="text-blue-500/40 text-xs admin-terminal-font">
                        created: {new Date(createdAt).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Errors / Success */}
            {error && (
                <div className="admin-error rounded px-3 py-2 text-xs mb-4">
                    &gt; error: {error}
                </div>
            )}
            {success && (
                <div className="admin-success rounded px-3 py-2 text-xs mb-4">
                    &gt; {success}
                </div>
            )}

            {/* Title */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">title</label>
                <input
                    className="admin-input w-full px-3 py-2 rounded text-sm"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title"
                />
            </div>

            {/* Subtitle */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">subtitle</label>
                <input
                    className="admin-input w-full px-3 py-2 rounded text-sm"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Optional subtitle"
                />
            </div>

            {/* Slug */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">slug (URL path)</label>
                <div className="flex items-center gap-2">
                    <span className="text-blue-500/30 text-xs admin-terminal-font">/blog/</span>
                    <input
                        className="admin-input flex-1 px-3 py-2 rounded text-sm"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="auto-generated-slug"
                    />
                </div>
            </div>

            {/* Cover Image */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">cover_image</label>
                <div className="flex items-center gap-3">
                    {coverImage ? (
                        <div className="relative w-32 h-20 rounded overflow-hidden admin-card">
                            <img src={`/${coverImage}`} alt="Cover" className="w-full h-full object-cover" />
                            <button
                                onClick={() => setCoverImage('')}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500/80 rounded-full grid place-items-center hover:bg-red-400"
                            >
                                <TrashIcon className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    ) : (
                        <label className="admin-btn-secondary flex items-center gap-2 px-3 py-2 rounded text-xs cursor-pointer">
                            <PhotoIcon className="w-4 h-4" />
                            <span>{uploadingCover ? 'uploading...' : 'upload_cover'}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                        </label>
                    )}
                </div>
            </div>

            {/* Tags */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">tags (comma separated)</label>
                <input
                    className="admin-input w-full px-3 py-2 rounded text-sm"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="design, blockchain, 3d"
                />
                {tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {tags.split(',').map((t) => t.trim()).filter(Boolean).map((t, i) => (
                            <span
                                key={i}
                                className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider"
                                style={{
                                    background: 'rgba(155, 48, 255, 0.15)',
                                    border: '1px solid rgba(155, 48, 255, 0.3)',
                                    color: '#c084fc',
                                }}
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}
                {/* Tag suggestions from existing posts */}
                {allTags.length > 0 && (
                    <div className="mt-2">
                        <span className="admin-comment text-[10px]">existing tags — click to add:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {allTags.map((t) => {
                                const currentTags = tags.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)
                                const isActive = currentTags.includes(t.toLowerCase())
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            if (isActive) return
                                            setTags((prev) => prev ? `${prev.replace(/,\s*$/, '')}, ${t}` : t)
                                        }}
                                        className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-all"
                                        style={{
                                            background: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.08)',
                                            border: `1px solid ${isActive ? 'rgba(34,197,94,0.3)' : 'rgba(59,130,246,0.2)'}`,
                                            color: isActive ? '#4ade80' : 'rgba(96,165,250,0.7)',
                                            cursor: isActive ? 'default' : 'pointer',
                                            opacity: isActive ? 0.6 : 1,
                                        }}
                                    >
                                        {isActive ? '✓ ' : '+ '}{t}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Excerpt */}
            <div className="mb-4">
                <label className="admin-comment block mb-1">excerpt (preview text)</label>
                <textarea
                    className="admin-input w-full px-3 py-2 rounded text-sm resize-y"
                    rows={2}
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    placeholder="Brief preview for blog card..."
                />
            </div>

            {/* ─── Spanish Translation (collapsible) ─── */}
            <div className="mb-4">
                <button
                    type="button"
                    onClick={() => setShowTranslation((v) => !v)}
                    className="flex items-center gap-2 text-xs admin-terminal-font transition-colors"
                    style={{ color: 'rgba(96,165,250,0.7)' }}
                >
                    <span style={{ fontSize: 10 }}>{showTranslation ? '\u25B2' : '\u25BC'}</span>
                    traducción (es) — spanish translation
                </button>
                {showTranslation && (
                    <div className="mt-3 p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
                        {/* Auto-translate button */}
                        <div className="mb-4 pb-3" style={{ borderBottom: '1px solid rgba(59,130,246,0.08)' }}>
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
                                        if (!json.ok) throw new Error(json.error || 'translation_failed')
                                        const t = json.translations || {}
                                        if (t.title) setTitleEs(t.title)
                                        if (t.subtitle) setSubtitleEs(t.subtitle)
                                        if (t.excerpt) setExcerptEs(t.excerpt)
                                        if (t.content_html) {
                                            setContentHtmlEs(t.content_html)
                                            if (editorEs) editorEs.commands.setContent(t.content_html)
                                        }
                                        setSuccess('translation_complete')
                                        setTimeout(() => setSuccess(null), 2000)
                                    } catch (e) {
                                        setError('translation_error: ' + e.message)
                                    } finally {
                                        setTranslating(false)
                                    }
                                }}
                                className="w-full px-4 py-2.5 rounded text-xs transition-all flex items-center justify-center gap-2"
                                style={{
                                    fontFamily: '"Cascadia Code", monospace',
                                    background: translating ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                                    border: `1px solid ${translating ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)'}`,
                                    color: translating ? '#60a5fa' : '#4ade80',
                                    cursor: translating ? 'wait' : 'pointer',
                                    opacity: (!title.trim() && !editor?.getHTML()) ? 0.4 : 1,
                                }}
                            >
                                {translating ? (
                                    <><span className="animate-pulse">⟳</span> traduciendo...</>
                                ) : (
                                    <><span>⚡</span> auto-translate to spanish</>
                                )}
                            </button>
                            <p className="admin-comment text-[10px] mt-1.5 text-center">
                                translates title, subtitle, excerpt &amp; content from English → Spanish
                            </p>
                        </div>
                        <div className="mb-3">
                            <label className="admin-comment block mb-1">título (es)</label>
                            <input
                                className="admin-input w-full px-3 py-2 rounded text-sm"
                                value={titleEs}
                                onChange={(e) => setTitleEs(e.target.value)}
                                placeholder="Título en español"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="admin-comment block mb-1">subtítulo (es)</label>
                            <input
                                className="admin-input w-full px-3 py-2 rounded text-sm"
                                value={subtitleEs}
                                onChange={(e) => setSubtitleEs(e.target.value)}
                                placeholder="Subtítulo en español"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="admin-comment block mb-1">extracto (es)</label>
                            <textarea
                                className="admin-input w-full px-3 py-2 rounded text-sm resize-y"
                                rows={2}
                                value={excerptEs}
                                onChange={(e) => setExcerptEs(e.target.value)}
                                placeholder="Texto de vista previa en español..."
                            />
                        </div>
                        <div>
                            <label className="admin-comment block mb-1">contenido (es)</label>
                            <div
                                className="rounded-lg overflow-hidden"
                                style={{
                                    background: 'rgba(0, 5, 15, 0.5)',
                                    border: '1px solid rgba(59, 130, 246, 0.15)',
                                }}
                            >
                                <EditorToolbar editor={editorEs} />
                                <EditorContent editor={editorEs} />
                            </div>
                            <p className="admin-comment text-[10px] mt-1">rich text editor — same formatting tools as the main content editor.</p>
                        </div>
                    </div>
                )}
            </div>


            {/* ─── Rich Text Editor ─── */}
            <div className="mb-6">
                <h3 className="admin-section-title text-sm mb-3">content</h3>
                <div
                    className="rounded-lg overflow-hidden"
                    style={{
                        background: 'rgba(0, 5, 15, 0.5)',
                        border: '1px solid rgba(155, 48, 255, 0.15)',
                    }}
                >
                    <EditorToolbar editor={editor} />
                    <EditorContent editor={editor} />
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(192, 132, 252, 0.3)' }}>
                    // Paste text, then format with toolbar. Supports bold, italic, headings, bullets, links, quotes.
                </p>
            </div>

            {/* ─── Media Blocks ─── */}
            <div className="mb-6">
                <h3 className="admin-section-title text-sm mb-3">media_embeds</h3>

                {mediaBlocks.length === 0 && (
                    <p className="text-xs mb-3" style={{ color: 'rgba(192, 132, 252, 0.3)', fontFamily: '"Cascadia Code", monospace' }}>
                        &gt; no media blocks. Add images or videos below.
                    </p>
                )}

                {mediaBlocks.map((block, i) => (
                    <MediaBlock
                        key={i}
                        block={block}
                        index={i}
                        onUpdate={(b) => updateMedia(i, b)}
                        onRemove={() => removeMedia(i)}
                        onMoveUp={() => moveMedia(i, -1)}
                        onMoveDown={() => moveMedia(i, 1)}
                    />
                ))}

                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => addMedia('image')}
                        className="admin-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px]"
                    >
                        <PlusIcon className="w-3 h-3" />
                        🖼 Image
                    </button>
                    <button
                        onClick={() => addMedia('video')}
                        className="admin-btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px]"
                    >
                        <PlusIcon className="w-3 h-3" />
                        ▶ YouTube
                    </button>
                </div>
            </div>

            {/* ─── Sticky Save Bar ─── */}
            <div
                style={{
                    position: 'sticky',
                    bottom: 0,
                    zIndex: 20,
                    background: 'rgba(5, 10, 25, 0.85)',
                    backdropFilter: 'blur(12px)',
                    borderTop: '1px solid rgba(59, 130, 246, 0.15)',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '12px',
                }}
            >
                {error && (
                    <span className="admin-error text-[11px] px-2 py-1 rounded">
                        &gt; {error}
                    </span>
                )}
                {success && (
                    <span className="admin-success text-[11px] px-2 py-1 rounded">
                        &gt; {success}
                    </span>
                )}
                <div style={{ flex: 1 }} />
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                        onClick={() => setPublished((v) => !v)}
                        className={`w-10 h-5 rounded-full relative transition-all ${published ? 'admin-toggle-active' : 'admin-toggle-inactive'}`}
                    >
                        <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: published ? '22px' : '2px' }}
                        />
                    </button>
                    <span className="text-xs text-blue-400 admin-terminal-font">published</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <button
                        onClick={() => setFeatured((v) => !v)}
                        className={`w-10 h-5 rounded-full relative transition-all ${featured ? 'admin-toggle-active' : 'admin-toggle-inactive'}`}
                    >
                        <span
                            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                            style={{ left: featured ? '22px' : '2px' }}
                        />
                    </button>
                    <StarIcon className={`w-4 h-4 ${featured ? 'text-yellow-400' : 'text-blue-600'}`} />
                    <span className="text-xs text-blue-400 admin-terminal-font">featured</span>
                </label>
                <button
                    onClick={save}
                    disabled={saving}
                    className="admin-btn-primary px-5 py-2 rounded text-xs"
                >
                    {saving ? '> saving...' : postId ? '> update_post' : '> create_post'}
                </button>
            </div>
        </div>
    )
}
