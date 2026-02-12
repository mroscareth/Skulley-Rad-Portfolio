/**
 * About content editor
 * - Single textarea for English
 * - Automatic translation to Spanish
 * - Editable translation preview
 * Terminal CRT theme
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeftIcon,
  CheckIcon,
  LanguageIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid'

export default function AboutEditor({ onBack }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Content as plain text (paragraphs separated by double line break)
  const [englishText, setEnglishText] = useState('')
  const [spanishText, setSpanishText] = useState('')
  const [spanishEdited, setSpanishEdited] = useState(false)

  // Fetch current content
  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/about.php', { credentials: 'include' })
        const data = await res.json()

        if (data.ok && data.about) {
          // Convert paragraphs to plain text
          const enParagraphs = []
          const esParagraphs = []
          
          for (let i = 1; i <= 10; i++) {
            const key = `p${i}`
            if (data.about.en?.[key]) enParagraphs.push(data.about.en[key])
            if (data.about.es?.[key]) esParagraphs.push(data.about.es[key])
          }

          setEnglishText(enParagraphs.join('\n\n'))
          setSpanishText(esParagraphs.join('\n\n'))
        }
      } catch (err) {
        setError('Error al cargar contenido')
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [])

  // Convert text to paragraphs object
  const textToParagraphs = (text) => {
    const paragraphs = text
      .split(/\n\s*\n/) // Double line break = new paragraph
      .map(p => p.trim())
      .filter(p => p.length > 0)

    const result = {}
    paragraphs.forEach((p, i) => {
      result[`p${i + 1}`] = p
    })
    return result
  }

  // Translate automatically
  const handleTranslate = useCallback(async () => {
    if (!englishText.trim()) {
      setError('Escribe algo en inglés primero')
      return
    }

    setTranslating(true)
    setError(null)

    try {
      const res = await fetch('/api/translate.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: englishText, from: 'en', to: 'es' }),
      })

      const data = await res.json()

      if (data.ok && data.translated) {
        setSpanishText(data.translated)
        setSpanishEdited(false)
      } else {
        setError(data.error || 'Error en la traducción')
      }
    } catch (err) {
      setError('Error de conexión con el traductor')
    } finally {
      setTranslating(false)
    }
  }, [englishText])

  // Save changes
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!englishText.trim()) {
      setError('El contenido en inglés es requerido')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const content = {
        en: textToParagraphs(englishText),
        es: textToParagraphs(spanishText || englishText), // Fallback to English if no Spanish
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
        setSpanishEdited(false)
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

  // Paragraphs preview
  const englishParagraphs = englishText.split(/\n\s*\n/).filter(p => p.trim())
  const spanishParagraphs = spanishText.split(/\n\s*\n/).filter(p => p.trim())

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

            <textarea
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              rows={12}
              className="admin-input w-full px-4 py-3 rounded text-sm resize-none leading-relaxed"
              placeholder="> Write your bio here...

Use double line breaks for new paragraphs.

Like this third paragraph."
            />

            <p className="text-blue-600/30 text-xs admin-terminal-font">
              // Separate paragraphs with double Enter (blank line)
            </p>

            {/* English preview */}
            {englishParagraphs.length > 0 && (
              <div
                className="p-4 rounded"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                }}
              >
                <p className="text-blue-400 text-xs font-medium mb-3 admin-terminal-font">
                  // preview ({englishParagraphs.length} paragraph{englishParagraphs.length !== 1 ? 's' : ''})
                </p>
                <div className="space-y-3 text-blue-200/60 text-sm admin-terminal-font">
                  {englishParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}
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
                disabled={translating || !englishText.trim()}
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

            <textarea
              value={spanishText}
              onChange={(e) => {
                setSpanishText(e.target.value)
                setSpanishEdited(true)
              }}
              rows={12}
              className="admin-input w-full px-4 py-3 rounded text-sm resize-none leading-relaxed"
              placeholder="> Click 'auto_translate' or type translation manually..."
            />

            <p className="text-blue-600/30 text-xs admin-terminal-font">
              {spanishEdited ? (
                <span className="text-yellow-500/60">// manually_edited</span>
              ) : (
                '// You can edit the translation before saving'
              )}
            </p>

            {/* Spanish preview */}
            {spanishParagraphs.length > 0 && (
              <div
                className="p-4 rounded"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.03)',
                  border: '1px solid rgba(239, 68, 68, 0.1)',
                }}
              >
                <p className="text-red-400/60 text-xs font-medium mb-3 admin-terminal-font">
                  // preview ({spanishParagraphs.length} párrafo{spanishParagraphs.length !== 1 ? 's' : ''})
                </p>
                <div className="space-y-3 text-blue-200/60 text-sm admin-terminal-font">
                  {spanishParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}
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
            disabled={saving || !englishText.trim()}
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
