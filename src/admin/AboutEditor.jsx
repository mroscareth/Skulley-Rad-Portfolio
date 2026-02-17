/**
 * About content editor
 * - TipTap WYSIWYG for English
 * - Automatic translation to Spanish
 * - TipTap WYSIWYG for editable translation
 * Terminal CRT theme
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  ArrowLeftIcon,
  CheckIcon,
  LanguageIcon,
  ArrowPathIcon,
  SparklesIcon,
  LinkIcon,
} from '@heroicons/react/24/solid'

/* ────────────────────── TipTap Toolbar Button ────────────────────── */
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
        background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
        border: `1px solid ${active ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.08)'}`,
        color: active ? '#60a5fa' : 'rgba(96, 165, 250, 0.6)',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/* ────────────────────── TipTap Formatting Toolbar ────────────────────── */
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
        borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
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

      <span className="w-px h-4 mx-1" style={{ background: 'rgba(59,130,246,0.15)' }} />

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

      <span className="w-px h-4 mx-1" style={{ background: 'rgba(59,130,246,0.15)' }} />

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

      <span className="w-px h-4 mx-1" style={{ background: 'rgba(59,130,246,0.15)' }} />

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

      <span className="w-px h-4 mx-1" style={{ background: 'rgba(59,130,246,0.15)' }} />

      <ToolbarBtn
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        ─
      </ToolbarBtn>
    </div>
  )
}

/* ────────────────────── TipTap Editor Styles ────────────────────── */
const TIPTAP_STYLES = `
  .about-tiptap-content {
    font-family: "Cascadia Code", "Fira Code", monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #e2e8f0;
    min-height: 200px;
    outline: none;
    padding: 0.75rem 1rem;
  }
  .about-tiptap-content p {
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-top: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .about-tiptap-content strong {
    color: #f1f5f9;
  }
  .about-tiptap-content em {
    font-style: italic;
  }
  .about-tiptap-content ul,
  .about-tiptap-content ol {
    padding-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content ul {
    list-style-type: disc;
  }
  .about-tiptap-content ul li::marker {
    color: #60a5fa;
  }
  .about-tiptap-content ol {
    list-style-type: decimal;
  }
  .about-tiptap-content ol li::marker {
    color: #60a5fa;
  }
  .about-tiptap-content li {
    margin-bottom: 0.15rem;
  }
  .about-tiptap-content blockquote {
    border-left: 3px solid rgba(59, 130, 246, 0.4);
    padding-left: 1rem;
    margin: 0.5rem 0;
    color: rgba(226, 232, 240, 0.7);
    font-style: italic;
  }
  .about-tiptap-content pre {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 0.375rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    overflow-x: auto;
    font-size: 0.8rem;
  }
  .about-tiptap-content pre code {
    color: #93c5fd;
    background: none;
    padding: 0;
  }
  .about-tiptap-content code {
    background: rgba(59, 130, 246, 0.1);
    color: #93c5fd;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  .about-tiptap-content hr {
    border: none;
    border-top: 1px solid rgba(59, 130, 246, 0.2);
    margin: 1rem 0;
  }
  .about-tiptap-content a,
  .about-tiptap-content .tiptap-link {
    color: #60a5fa;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .about-tiptap-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(59, 130, 246, 0.3);
    float: left;
    height: 0;
    pointer-events: none;
  }
`

/* ────────────────────── Helper: paragraphs object → HTML ────────────────────── */
function paragraphsToHtml(paragraphsObj) {
  if (!paragraphsObj) return ''
  const result = []
  for (let i = 1; i <= 20; i++) {
    const key = `p${i}`
    if (paragraphsObj[key]) {
      result.push(`<p>${paragraphsObj[key]}</p>`)
    }
  }
  return result.join('')
}

/* ────────────────────── Helper: HTML → paragraphs object ────────────────────── */
function htmlToParagraphs(html) {
  if (!html) return {}
  const div = document.createElement('div')
  div.innerHTML = html
  // Get all block elements (p, li etc.) as separate paragraphs
  const paragraphs = []
  const children = div.querySelectorAll('p')
  if (children.length > 0) {
    children.forEach(p => {
      const text = p.innerHTML.trim()
      if (text && text !== '<br>') paragraphs.push(text)
    })
  } else {
    // Fallback: just use the full text content
    const text = div.textContent.trim()
    if (text) paragraphs.push(text)
  }

  const result = {}
  paragraphs.forEach((p, i) => {
    result[`p${i + 1}`] = p
  })
  return result
}

export default function AboutEditor({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [hasEnContent, setHasEnContent] = useState(false)

  // TipTap editor (English)
  const editorEn = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Placeholder.configure({ placeholder: 'Write your bio here...\n\nEach paragraph is a separate block.' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'about-tiptap-content' } },
    onUpdate: ({ editor }) => {
      setHasEnContent(!!editor.getText().trim())
    },
  })

  // TipTap editor (Spanish)
  const editorEs = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Placeholder.configure({ placeholder: 'Click "auto_translate" or type translation here...' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'about-tiptap-content' } },
  })

  // Fetch current content
  useEffect(() => {
    if (!editorEn || !editorEs) return

    const fetchContent = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/about.php', { credentials: 'include' })
        const data = await res.json()

        if (data.ok && data.about) {
          // Convert paragraphs object to HTML for TipTap
          const enHtml = paragraphsToHtml(data.about.en)
          const esHtml = paragraphsToHtml(data.about.es)

          if (enHtml) {
            editorEn.commands.setContent(enHtml)
            setHasEnContent(true)
          }
          if (esHtml) editorEs.commands.setContent(esHtml)
        }
      } catch (err) {
        setError('Error al cargar contenido')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [editorEn, editorEs])

  // Translate automatically
  const handleTranslate = useCallback(async () => {
    const htmlContent = editorEn?.getHTML() || ''
    const textContent = editorEn?.getText() || ''
    if (!textContent.trim()) {
      setError('Escribe algo en inglés primero')
      return
    }

    setTranslating(true)
    setError(null)

    try {
      // API expects { texts: { key: value }, from, to }
      const res = await fetch('/api/translate.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: { content: htmlContent },
          from: 'en',
          to: 'es',
        }),
      })

      const data = await res.json()

      if (data.ok && data.translations?.content) {
        editorEs?.commands.setContent(data.translations.content)
      } else {
        setError(data.error || 'Error en la traducción')
      }
    } catch (err) {
      setError('Error de conexión con el traductor')
    } finally {
      setTranslating(false)
    }
  }, [editorEn, editorEs])

  // Save changes
  const handleSubmit = async (e) => {
    e.preventDefault()

    const enText = editorEn?.getText() || ''
    if (!enText.trim()) {
      setError('El contenido en inglés es requerido')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const enHtml = editorEn?.getHTML() || ''
      const esHtml = editorEs?.getHTML() || enHtml // Fallback to English if no Spanish

      const content = {
        en: htmlToParagraphs(enHtml),
        es: htmlToParagraphs(esHtml),
      }

      const res = await fetch('/api/about.php', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
      })

      const data = await res.json()

      if (data.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(data.error || 'Error al guardar')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; loading_about_content...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* TipTap editor styles */}
      <style>{TIPTAP_STYLES}</style>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded hover:bg-blue-500/10 transition-colors"
          style={{ border: '1px solid rgba(59, 130, 246, 0.2)' }}
        >
          <ArrowLeftIcon className="w-5 h-5 text-blue-400" />
        </button>
        <h1 className="admin-section-title text-lg">
          edit_about
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 rounded admin-error text-sm">
          <span className="opacity-60">&gt; </span>{error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-6 p-3 rounded admin-success text-sm">
          <span className="opacity-60">&gt; </span>Changes saved successfully
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* English (source) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm admin-terminal-font">
                <span
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                >
                  EN
                </span>
                <span className="text-blue-400">content_english</span>
              </label>
            </div>

            <div
              className="rounded-lg overflow-hidden"
              style={{
                border: '1px solid rgba(59, 130, 246, 0.2)',
                background: 'rgba(0, 10, 30, 0.5)',
              }}
            >
              <EditorToolbar editor={editorEn} />
              <EditorContent editor={editorEn} />
            </div>
          </div>

          {/* Spanish (translation) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm admin-terminal-font">
                <span
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  ES
                </span>
                <span className="text-blue-400">content_spanish</span>
              </label>

              <button
                type="button"
                onClick={handleTranslate}
                disabled={translating || !hasEnContent}
                className="
                  inline-flex items-center gap-2 px-4 py-2 rounded
                  text-sm font-bold uppercase tracking-wider
                  active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all
                "
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                {translating ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    translating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    auto_translate
                  </>
                )}
              </button>
            </div>

            <div
              className="rounded-lg overflow-hidden"
              style={{
                border: '1px solid rgba(59, 130, 246, 0.2)',
                background: 'rgba(0, 10, 30, 0.5)',
              }}
            >
              <EditorToolbar editor={editorEs} />
              <EditorContent editor={editorEs} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div
          className="flex items-center justify-end gap-4 pt-8 mt-8"
          style={{ borderTop: '1px solid rgba(59, 130, 246, 0.15)' }}
        >
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded text-blue-500/50 hover:text-blue-400 transition-colors text-sm admin-terminal-font"
          >
            cancel
          </button>
          <button
            type="submit"
            disabled={saving || !hasEnContent}
            className="
              inline-flex items-center gap-2 px-6 py-3 rounded
              text-sm font-bold uppercase tracking-wider
              active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
            style={{
              backgroundColor: '#3b82f6',
              color: '#000',
              border: '1px solid #60a5fa',
              boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
            }}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>saving...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>&gt; save_changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
