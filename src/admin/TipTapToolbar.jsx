/**
 * Shared TipTap Toolbar — unified formatting toolbar for all editors
 * Supports: H2, H3, H4, Bold, Italic, Strikethrough, Inline code,
 *           Bullet List, Ordered List, Blockquote, Link, Code Block,
 *           Horizontal Rule, and inline Image embedding.
 *
 * Styling follows the CMS system (DESIGN.md §15): neutral buttons, active
 * formatting in the accent. The old `accent` prop is no longer read.
 */

import React, { useRef } from 'react'
import { useEditorState } from '@tiptap/react'
import {
    BoldIcon,
    ItalicIcon,
    StrikethroughIcon,
    CodeBracketIcon,
    CodeBracketSquareIcon,
    ListBulletIcon,
    NumberedListIcon,
    LinkIcon,
    MinusIcon,
    PhotoIcon,
    GlobeAltIcon,
} from '@heroicons/react/24/solid'

const UPLOAD_API = '/api/upload.php'

/* ────────────────────── Toolbar Button ────────────────────── */
// `toggle` = the button reflects a formatting state (aria-pressed). The image
// button highlights when an image is selected, but it isn't a toggle.
function ToolbarBtn({ active, onClick, title, children, disabled, toggle = true }) {
    const pressed = toggle && typeof active === 'boolean' ? active : undefined

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-label={title}
            aria-pressed={pressed}
            className={`inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-full shrink-0 text-[0.8125rem] font-bold leading-none transition-colors disabled:opacity-30 disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-section-quests ${active
                ? 'bg-[var(--a-accent-soft)] text-section-quests'
                : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                }`}
        >
            {children}
        </button>
    )
}

/* ────────────────────── Separator ────────────────────── */
function Sep() {
    return <span aria-hidden="true" className="w-0.5 h-5 mx-1 rounded-full bg-white/10 shrink-0" />
}

/* ────────────────────── Main Toolbar ────────────────────── */
export default function TipTapToolbar({ editor, context = 'blog', contextId = null }) {
    const fileInputRef = useRef(null)

    // TipTap 3 no longer re-renders the host component on every transaction,
    // so the toolbar subscribes to the states it highlights.
    const active = useEditorState({
        editor,
        selector: ({ editor: e }) => (e ? {
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            h4: e.isActive('heading', { level: 4 }),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            strike: e.isActive('strike'),
            code: e.isActive('code'),
            bulletList: e.isActive('bulletList'),
            orderedList: e.isActive('orderedList'),
            blockquote: e.isActive('blockquote'),
            link: e.isActive('link'),
            codeBlock: e.isActive('codeBlock'),
            image: e.isActive('image'),
        } : null),
    })

    if (!editor || !active) return null

    // ── Link handler ──
    const setLink = () => {
        const prev = editor.getAttributes('link').href
        const url = window.prompt('Link URL', prev || 'https://')
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
            alert('Unsupported image type. Use JPG, PNG, WebP or GIF.')
            return
        }

        // Validate size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image too large (max 10 MB).')
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
                alert(data.error || 'Image upload failed')
            }
        } catch (err) {
            console.error('Image upload failed:', err)
            alert('Connection error while uploading the image')
        }
    }

    // ── Image from URL handler ──
    const insertImageUrl = () => {
        const url = window.prompt('Image URL', 'https://')
        if (!url) return
        editor.chain().focus().setImage({ src: url }).run()
    }

    return (
        <div
            role="toolbar"
            aria-label="Formatting"
            className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-[var(--a-surface)] border-b-2 border-white/10"
        >
            {/* ── Headings ── */}
            <ToolbarBtn
                active={active.h2}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
            >
                H2
            </ToolbarBtn>
            <ToolbarBtn
                active={active.h3}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
            >
                H3
            </ToolbarBtn>
            <ToolbarBtn
                active={active.h4}
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                title="Heading 4"
            >
                H4
            </ToolbarBtn>

            <Sep />

            {/* ── Inline formatting ── */}
            <ToolbarBtn
                active={active.bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold (Ctrl+B)"
            >
                <BoldIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                active={active.italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic (Ctrl+I)"
            >
                <ItalicIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                active={active.strike}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
            >
                <StrikethroughIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                active={active.code}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Inline code"
            >
                <CodeBracketIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>

            <Sep />

            {/* ── Lists ── */}
            <ToolbarBtn
                active={active.bulletList}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bulleted list"
            >
                <ListBulletIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                active={active.orderedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Numbered list"
            >
                <NumberedListIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>

            <Sep />

            {/* ── Block elements ── */}
            <ToolbarBtn
                active={active.blockquote}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Quote"
            >
                <span aria-hidden="true" className="text-lg leading-none translate-y-[0.15em]">&ldquo;</span>
            </ToolbarBtn>
            <ToolbarBtn
                active={active.link}
                onClick={setLink}
                title="Link"
            >
                <LinkIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                active={active.codeBlock}
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                title="Code block"
            >
                <CodeBracketSquareIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Divider"
            >
                <MinusIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>

            <Sep />

            {/* ── Image ── */}
            <ToolbarBtn
                active={active.image}
                toggle={false}
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
            >
                <PhotoIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>
            <ToolbarBtn
                onClick={insertImageUrl}
                title="Image from URL"
            >
                <GlobeAltIcon className="w-4 h-4" aria-hidden />
            </ToolbarBtn>

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
