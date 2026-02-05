/**
 * About content editor
 * - Single textarea for English
 * - Automatic translation to Spanish
 * - Editable translation preview
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
        <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 text-white" />
        </button>
        <h1 
          className="text-2xl text-white"
          style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
        >
          Editar About
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-emerald-400 text-sm">Cambios guardados correctamente</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* English (source) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label 
                className="flex items-center gap-2 text-white"
                style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
              >
                <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                  EN
                </span>
                Contenido en Inglés
              </label>
            </div>

            <textarea
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              rows={12}
              className="
                w-full px-4 py-3 rounded-xl
                bg-white/5 border border-white/10
                text-white placeholder-white/30
                focus:outline-none focus:border-cyan-400/50
                transition-colors resize-none
                font-sans text-base leading-relaxed
              "
              placeholder="Escribe tu biografía aquí...

Usa doble salto de línea para crear párrafos nuevos.

Como este tercer párrafo."
            />

            <p className="text-white/40 text-xs">
              Separa los párrafos con doble Enter (línea en blanco)
            </p>

            {/* English preview */}
            {englishParagraphs.length > 0 && (
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <p className="text-blue-400 text-xs font-medium mb-3">
                  Vista previa ({englishParagraphs.length} párrafo{englishParagraphs.length !== 1 ? 's' : ''})
                </p>
                <div className="space-y-3 text-white/70 text-sm">
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
              <label 
                className="flex items-center gap-2 text-white"
                style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
              >
                <span className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400">
                  ES
                </span>
                Traducción al Español
              </label>

              <button
                type="button"
                onClick={handleTranslate}
                disabled={translating || !englishText.trim()}
                className="
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  bg-gradient-to-r from-purple-500 to-pink-500
                  text-white text-sm font-medium
                  hover:opacity-90 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all
                "
              >
                {translating ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Traduciendo...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-4 h-4" />
                    Traducir automático
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
              className="
                w-full px-4 py-3 rounded-xl
                bg-white/5 border border-white/10
                text-white placeholder-white/30
                focus:outline-none focus:border-orange-400/50
                transition-colors resize-none
                font-sans text-base leading-relaxed
              "
              placeholder="Haz clic en 'Traducir automático' o escribe la traducción manualmente..."
            />

            <p className="text-white/40 text-xs">
              {spanishEdited ? (
                <span className="text-orange-400">Editado manualmente</span>
              ) : (
                'Puedes editar la traducción antes de guardar'
              )}
            </p>

            {/* Spanish preview */}
            {spanishParagraphs.length > 0 && (
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-orange-400 text-xs font-medium mb-3">
                  Vista previa ({spanishParagraphs.length} párrafo{spanishParagraphs.length !== 1 ? 's' : ''})
                </p>
                <div className="space-y-3 text-white/70 text-sm">
                  {spanishParagraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pt-8 mt-8 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-xl text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !englishText.trim()}
            className="
              inline-flex items-center gap-2 px-6 py-3 rounded-xl
              bg-gradient-to-r from-cyan-500 to-purple-500
              text-white font-semibold
              hover:opacity-90 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CheckIcon className="w-5 h-5" />
                <span>Guardar cambios</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
