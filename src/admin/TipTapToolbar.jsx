/**
 * Shared TipTap Toolbar — unified formatting toolbar for all editors
 * Supports: H2, H3, H4, Bold, Italic, Strikethrough, Underline,
 *           Bullet List, Ordered List, Blockquote, Link, Code Block,
 *           Horizontal Rule, and inline Image embedding.
 *
 * Accept `accentColor` prop to match each editor's theme (blue/purple).
 */

import React, { useRef } from 'react'
import { LinkIcon, PhotoIcon } from '@heroicons/react/24/solid'

const UPLOAD_API = '/api/upload.php'

/* ────────────────────── Toolbar Button ────────────────────── */
function ToolbarBtn({ active, onClick, title, children, disabled, accent }) {
    const colors = accent === 'purple'
        ? {
            activeBg: 'rgba(155, 48, 255, 0.25)',
            activeBorder: 'rgba(155, 48, 255, 0.5)',
            inactiveBorder: 'rgba(155, 48, 255, 0.08)',
            activeColor: '#c084fc',
            inactiveColor: 'rgba(192, 132, 252, 0.6)',
        }
        : {
            activeBg: 'rgba(59, 130, 246, 0.25)',
            activeBorder: 'rgba(59, 130, 246, 0.5)',
            inactiveBorder: 'rgba(59, 130, 246, 0.08)',
            activeColor: '#60a5fa',
            inactiveColor: 'rgba(96, 165, 250, 0.6)',
        }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="px-2 py-1 rounded text-xs transition-all shrink-0"
            style={{
                fontFamily: '"Cascadia Code", monospace',
                background: active ? colors.activeBg : 'transparent',
                border: `1px solid ${active ? colors.activeBorder : colors.inactiveBorder}`,
                color: active ? colors.activeColor : colors.inactiveColor,
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? 'default' : 'pointer',
            }}
        >
            {children}
        </button>
    )
}

/* ────────────────────── Separator ────────────────────── */
function Sep({ accent }) {
    const bg = accent === 'purple' ? 'rgba(155,48,255,0.15)' : 'rgba(59,130,246,0.15)'
    return <span className="w-px h-4 mx-1" style={{ background: bg }} />
}

/* ────────────────────── Main Toolbar ────────────────────── */
export default function TipTapToolbar({ editor, accent = 'blue', context = 'blog', contextId = null }) {
    const fileInputRef = useRef(null)

    if (!editor) return null

    const borderColor = accent === 'purple' ? 'rgba(155, 48, 255, 0.15)' : 'rgba(59, 130, 246, 0.15)'

    // ── Link handler ──
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

    // ── Image upload handler ──
    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Reset input so the same file can be selected again
        e.target.value = ''

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
            alert('Unsupported image type. Use JPG, PNG, WebP, or GIF.')
            return
        }

        // Validate size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image too large (max 10MB).')
            return
        }

        const formData = new FormData()
        formData.append('file', file)
        formData.append('context', context)
        if (contextId) {
            if (context === 'blog') {
                formData.append('post_id', contextId)
            } else {
                formData.append('project_id', contextId)
            }
        }

        try {
            const res = await fetch(UPLOAD_API, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })

            const data = await res.json()

            if (data.ok && data.file?.path) {
                const src = data.file.path.startsWith('/') ? data.file.path : `/${data.file.path}`
                editor.chain().focus().setImage({ src }).run()
            } else {
                alert(data.error || 'Error uploading image')
            }
        } catch (err) {
            console.error('Image upload failed:', err)
            alert('Connection error uploading image')
        }
    }

    // ── Image from URL handler ──
    const insertImageUrl = () => {
        const url = window.prompt('Image URL:', 'https://')
        if (!url) return
        editor.chain().focus().setImage({ src: url }).run()
    }

    return (
        <div
            className="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-t-lg"
            style={{
                background: 'rgba(0, 5, 15, 0.9)',
                borderBottom: `1px solid ${borderColor}`,
            }}
        >
            {/* ── Headings ── */}
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
            >
                H2
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
            >
                H3
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('heading', { level: 4 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                title="Heading 4"
            >
                H4
            </ToolbarBtn>

            <Sep accent={accent} />

            {/* ── Inline formatting ── */}
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('bold')}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
            >
                <strong>B</strong>
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('italic')}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
            >
                <em>I</em>
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('strike')}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
            >
                <s>S</s>
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('code')}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Inline Code"
            >
                {'`c`'}
            </ToolbarBtn>

            <Sep accent={accent} />

            {/* ── Lists ── */}
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('bulletList')}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
            >
                •&thinsp;list
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('orderedList')}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered List"
            >
                1.&thinsp;list
            </ToolbarBtn>

            <Sep accent={accent} />

            {/* ── Block elements ── */}
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('blockquote')}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Blockquote"
            >
                &ldquo;&rdquo;
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('link')}
                onClick={setLink}
                title="Insert Link"
            >
                <LinkIcon className="w-3.5 h-3.5 inline" />
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('codeBlock')}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code Block"
            >
                {'</>'}
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
            >
                ─
            </ToolbarBtn>

            <Sep accent={accent} />

            {/* ── Image ── */}
            <ToolbarBtn
                accent={accent}
                active={editor.isActive('image')}
                onClick={() => fileInputRef.current?.click()}
                title="Upload Image"
            >
                <PhotoIcon className="w-3.5 h-3.5 inline" />
            </ToolbarBtn>
            <ToolbarBtn
                accent={accent}
                onClick={insertImageUrl}
                title="Image from URL"
            >
                🔗&thinsp;img
            </ToolbarBtn>

            {/* Hidden file input for image uploads */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
            />
        </div>
    )
}
