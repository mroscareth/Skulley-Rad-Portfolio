/**
 * About content editor
 * - TipTap WYSIWYG for English
 * - Automatic translation to Spanish
 * - TipTap WYSIWYG for editable translation
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  CheckIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid'
import TipTapToolbar from './TipTapToolbar'



/* ────────────────────── TipTap Editor Styles ────────────────────── */
const TIPTAP_STYLES = `
  .about-tiptap-content {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.85);
    min-height: 200px;
    outline: none;
    padding: 1rem 1.125rem;
  }
  .about-tiptap-content p {
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content h2,
  .about-tiptap-content h3,
  .about-tiptap-content h4 {
    font-weight: 700;
    line-height: 1.3;
    color: #fff;
  }
  .about-tiptap-content h2 {
    font-size: 1.25rem;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content h3 {
    font-size: 1.1rem;
    margin-top: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .about-tiptap-content h4 {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.85);
    margin-top: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .about-tiptap-content > :first-child {
    margin-top: 0;
  }
  .about-tiptap-content strong {
    font-weight: 700;
    color: #fff;
  }
  .about-tiptap-content em {
    font-style: italic;
  }
  .about-tiptap-content s {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .about-tiptap-content ul,
  .about-tiptap-content ol {
    padding-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  .about-tiptap-content ul {
    list-style-type: disc;
  }
  .about-tiptap-content ol {
    list-style-type: decimal;
  }
  .about-tiptap-content li::marker {
    color: rgba(255, 255, 255, 0.45);
  }
  .about-tiptap-content li {
    margin-bottom: 0.15rem;
  }
  .about-tiptap-content blockquote {
    border-left: 2px solid rgba(255, 255, 255, 0.2);
    padding-left: 1rem;
    margin: 0.5rem 0;
    color: rgba(255, 255, 255, 0.65);
    font-style: italic;
  }
  .about-tiptap-content pre {
    background: var(--a-surface);
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    overflow-x: auto;
  }
  .about-tiptap-content code {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    padding: 0.1rem 0.35rem;
    border-radius: 0.375rem;
  }
  .about-tiptap-content pre code {
    background: none;
    color: rgba(255, 255, 255, 0.85);
    padding: 0;
  }
  .about-tiptap-content hr {
    border: none;
    border-top: 2px solid rgba(255, 255, 255, 0.1);
    margin: 1rem 0;
  }
  .about-tiptap-content a,
  .about-tiptap-content .tiptap-link {
    color: var(--a-accent);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .about-tiptap-content img {
    max-width: 100%;
    height: auto;
    border-radius: 0.75rem;
    margin: 0.75rem 0;
    border: 2px solid rgba(255, 255, 255, 0.1);
  }
  .about-tiptap-content img.ProseMirror-selectednode {
    outline: 2px solid var(--a-accent);
    outline-offset: 2px;
  }
  .about-tiptap-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.28);
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
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Image.configure({ inline: false, allowBase64: false }),
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
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Use Auto-translate or type the Spanish version here...' }),
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
        setError('Could not load the content')
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
      setError('Write something in English first')
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
        setError(data.error || 'Translation failed')
      }
    } catch (err) {
      setError('Could not reach the translator')
    } finally {
      setTranslating(false)
    }
  }, [editorEn, editorEs])

  // Save changes
  const handleSubmit = async (e) => {
    e.preventDefault()

    const enText = editorEn?.getText() || ''
    if (!enText.trim()) {
      setError('English content is required')
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
        setError(data.error || 'Save failed')
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="a-spinner" role="status" aria-label="Loading about content" />
      </div>
    )
  }

  return (
    <div className="w-full a-fade-in">
      <style>{TIPTAP_STYLES}</style>

      <header className="mb-6 sm:mb-8">
        <h1 className="a-title">About</h1>
        <p className="a-subtitle">Your bio in English and Spanish. Each paragraph is saved as its own block.</p>
      </header>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3 mb-6" role="alert">
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {success && (
        <div className="a-alert a-alert--success px-4 py-3 mb-6" role="status">
          <CheckIcon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>Changes saved</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
          {/* English (source) */}
          <section className="a-card p-5 sm:p-6 min-w-0">
            <div className="mb-4">
              <h2 className="a-section-title">English</h2>
              <p className="a-help mt-0.5">Source text. Required to save.</p>
            </div>
            <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
              <TipTapToolbar editor={editorEn} context="about" />
              <EditorContent editor={editorEn} />
            </div>
          </section>

          {/* Spanish (translation) */}
          <section className="a-card p-5 sm:p-6 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="a-section-title">Spanish</h2>
                <p className="a-help mt-0.5">Auto-translate from English, then edit it freely.</p>
              </div>
              <button
                type="button"
                onClick={handleTranslate}
                disabled={translating || !hasEnContent}
                className="a-btn a-btn--secondary a-btn--sm"
              >
                {translating ? (
                  <>
                    <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    Translating…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-3.5 h-3.5" aria-hidden />
                    Auto-translate
                  </>
                )}
              </button>
            </div>
            <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
              <TipTapToolbar editor={editorEs} context="about" />
              <EditorContent editor={editorEs} />
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-6 mt-6 border-t-2 border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="a-btn a-btn--ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !hasEnContent}
            className="a-btn a-btn--primary a-btn--lg"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" aria-hidden />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
