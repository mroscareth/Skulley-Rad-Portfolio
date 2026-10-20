/**
 * Project editor - Create/Edit
 * Uses TipTap WYSIWYG for descriptions (EN/ES)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  ArrowLeftIcon,
  PhotoIcon,
  LinkIcon,
  CloudArrowUpIcon,
  CheckIcon,
  SparklesIcon,
  InformationCircleIcon,
  LanguageIcon,
  RectangleStackIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid'
import FileUploader from './FileUploader'
import OptimizationToast from './OptimizationToast'
import TipTapToolbar from './TipTapToolbar'

const BEHANCE_BADGES = [
  { code: 'be', label: 'Best of Behance', img: 'behanceFeatured.png' },
  { code: 'il', label: 'Illustration', img: 'illustration.png' },
  { code: 'pd', label: 'Product Design', img: 'productDesign.png' },
  { code: 'gr', label: 'Graphic Design', img: 'graphicDesign.png' },
  { code: '3d', label: '3D Art', img: '3D.png' },
  { code: 'ps', label: 'Photoshop', img: 'photoshop.png' },
]

/* ────────────────────── TipTap Editor Styles ────────────────────── */
// Code marks are user content, so they keep the mono stack; the UI around
// them doesn't.
const TIPTAP_STYLES = `
  .project-tiptap-content {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.85);
    min-height: 140px;
    outline: none;
    padding: 0.875rem 1rem;
  }
  .project-tiptap-content p {
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #fff;
    margin-top: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .project-tiptap-content h4 {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-top: 0.5rem;
    margin-bottom: 0.3rem;
  }
  .project-tiptap-content strong {
    color: #fff;
  }
  .project-tiptap-content em {
    font-style: italic;
  }
  .project-tiptap-content s {
    text-decoration: line-through;
    opacity: 0.6;
  }
  .project-tiptap-content ul,
  .project-tiptap-content ol {
    padding-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content ul {
    list-style-type: disc;
  }
  .project-tiptap-content ol {
    list-style-type: decimal;
  }
  .project-tiptap-content li::marker {
    color: rgba(255, 255, 255, 0.45);
  }
  .project-tiptap-content li {
    margin-bottom: 0.15rem;
  }
  .project-tiptap-content blockquote {
    border-left: 2px solid rgba(255, 255, 255, 0.2);
    padding-left: 1rem;
    margin: 0.5rem 0;
    color: rgba(255, 255, 255, 0.65);
    font-style: italic;
  }
  .project-tiptap-content pre {
    background: var(--a-bg);
    border: 2px solid var(--a-border);
    border-radius: var(--a-radius-sm);
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    overflow-x: auto;
    font-size: 0.8125rem;
  }
  .project-tiptap-content code {
    font-family: var(--font-mono);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.85);
    padding: 0.15rem 0.35rem;
    border-radius: 0.375rem;
    font-size: 0.85em;
  }
  .project-tiptap-content pre code {
    background: none;
    padding: 0;
  }
  .project-tiptap-content hr {
    border: none;
    border-top: 2px solid var(--a-border);
    margin: 1rem 0;
  }
  .project-tiptap-content a,
  .project-tiptap-content .tiptap-link {
    color: #fff;
    text-decoration: underline;
    text-decoration-color: var(--a-accent);
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .project-tiptap-content img {
    max-width: 100%;
    height: auto;
    border-radius: var(--a-radius-sm);
    margin: 0.75rem 0;
    border: 2px solid var(--a-border);
  }
  .project-tiptap-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.28);
    float: left;
    height: 0;
    pointer-events: none;
  }
`

/* ────────────────────── Helper: HTML → plain text (for translation API) ────────────────────── */
function htmlToText(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

export default function ProjectEditor({ projectId: initialProjectId, onBack, onSaved }) {
  // Track the current project ID (can be created during editing)
  const [currentProjectId, setCurrentProjectId] = useState(initialProjectId)
  const isEditing = !!currentProjectId

  const [loading, setLoading] = useState(!!initialProjectId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [optimizationData, setOptimizationData] = useState(null)
  const [creatingDraft, setCreatingDraft] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    slug: '',
    project_type: 'gallery',
    external_url: '',
    cover_image: '',
    // El borrador que se crea al subir archivos nace oculto (ver abajo); al
    // guardar se publica salvo que se apague "Visible on site".
    is_active: true,
    behance_badges: [],
    link_url: '',
    link_text_en: '',
    link_text_es: '',
  })
  const [files, setFiles] = useState([])
  const [translating, setTranslating] = useState(false)
  const [hasEnContent, setHasEnContent] = useState(false)

  // TipTap editor (English description)
  const editorEn = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Project description in English…' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'project-tiptap-content', 'aria-label': 'English description' } },
    onUpdate: ({ editor }) => {
      setHasEnContent(!!editor.getText().trim())
    },
  })

  // TipTap editor (Spanish description)
  const editorEs = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: 'Descripción del proyecto en español…' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'project-tiptap-content', 'aria-label': 'Spanish description' } },
  })

  // Translate description from English to Spanish using the API
  const handleTranslateDescription = async () => {
    const htmlContent = editorEn?.getHTML() || ''
    const textContent = htmlToText(htmlContent)
    if (!textContent.trim()) {
      setError('Write the English description first.')
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
          texts: { description: htmlContent },
          from: 'en',
          to: 'es',
        }),
      })

      const data = await res.json()

      if (data.ok && data.translations?.description) {
        // Set translated HTML in the Spanish editor
        editorEs?.commands.setContent(data.translations.description)
      } else {
        setError(data.error || 'Translation failed.')
      }
    } catch (err) {
      setError("Couldn't reach the translation service.")
    } finally {
      setTranslating(false)
    }
  }

  // Create project as draft to enable file uploads
  const ensureProjectExists = async () => {
    if (currentProjectId) return currentProjectId

    // Need at least a title to create
    const title = form.title.trim() || 'Nuevo proyecto'

    setCreatingDraft(true)
    setError(null)

    try {
      const res = await fetch('/api/projects.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          title,
          description_en: editorEn?.getHTML() || '',
          description_es: editorEs?.getHTML() || '',
          is_active: false, // Create as draft
        }),
      })

      // Check if response is ok before parsing JSON
      if (!res.ok) {
        const text = await res.text()
        console.error('Create draft failed:', res.status, text)
        setError(`Server error (${res.status}).`)
        return null
      }

      const data = await res.json()
      console.log('Create draft response:', data)

      if (data.ok && data.project?.id) {
        setCurrentProjectId(data.project.id)
        // Update form with any server-generated values (like slug)
        if (data.project.slug) {
          setForm(prev => ({ ...prev, slug: data.project.slug, title }))
        }
        return data.project.id
      } else {
        setError(data.error || "Couldn't create the draft.")
        return null
      }
    } catch (err) {
      console.error('Create draft error:', err)
      setError('Connection error: ' + err.message)
      return null
    } finally {
      setCreatingDraft(false)
    }
  }

  // Fetch project if editing
  useEffect(() => {
    if (!initialProjectId || !editorEn || !editorEs) return

    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/projects.php?id=${initialProjectId}`, {
          credentials: 'include',
        })
        const data = await res.json()

        if (data.ok && data.project) {
          const p = data.project
          setForm({
            title: p.title || '',
            slug: p.slug || '',
            project_type: p.project_type || 'gallery',
            external_url: p.external_url || '',
            cover_image: p.cover_image || '',
            is_active: p.is_active ?? true,
            behance_badges: Array.isArray(p.behance_badges) ? p.behance_badges : [],
            link_url: p.link_url || '',
            link_text_en: p.link_text_en || '',
            link_text_es: p.link_text_es || '',
          })
          // Set TipTap content (HTML)
          if (p.description_en) {
            editorEn.commands.setContent(p.description_en)
            setHasEnContent(true)
          }
          if (p.description_es) editorEs.commands.setContent(p.description_es)
          // Normalize files: ensure they have 'path' in addition to 'file_path'
          const normalizedFiles = (p.files || []).map(f => ({
            ...f,
            path: f.path || f.file_path, // Use path if it exists, otherwise file_path
          }))
          setFiles(normalizedFiles)
        } else {
          setError('Project not found.')
        }
      } catch (err) {
        setError('Connection error.')
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [initialProjectId, editorEn, editorEs])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.title.trim()) {
      setError('Title is required.')
      return
    }

    if (form.project_type === 'link' && !form.external_url.trim()) {
      setError('External link projects need a URL.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const url = currentProjectId ? `/api/projects.php?id=${currentProjectId}` : '/api/projects.php'
      const method = currentProjectId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          description_en: editorEn?.getHTML() || '',
          description_es: editorEs?.getHTML() || '',
          is_active: !!form.is_active,
        }),
      })

      const data = await res.json()

      if (data.ok) {
        onSaved?.()
      } else {
        setError(data.error || "Couldn't save the project.")
      }
    } catch (err) {
      setError('Connection error.')
    } finally {
      setSaving(false)
    }
  }

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Create project as draft if it doesn't exist yet
    const projectIdToUse = await ensureProjectExists()
    if (!projectIdToUse) return

    setUploadingCover(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectIdToUse)
    formData.append('is_cover', '1')

    try {
      const res = await fetch('/api/upload.php', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      // Check if response is ok before parsing JSON
      if (!res.ok) {
        const text = await res.text()
        console.error('Upload failed:', res.status, text)
        setError(`Server error (${res.status}).`)
        return
      }

      const data = await res.json()
      console.log('Upload response:', data)

      if (data.ok && data.path) {
        setForm((prev) => ({ ...prev, cover_image: data.path }))
        // Show optimization feedback
        if (data.optimization) {
          setOptimizationData(data.optimization)
        }
      } else {
        setError(data.error || "Couldn't upload the cover.")
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Connection error: ' + err.message)
    } finally {
      setUploadingCover(false)
    }
  }

  const handleFileUploaded = (file, optimization) => {
    setFiles((prev) => [...prev, file])
    // Show optimization feedback if available
    if (optimization) {
      setOptimizationData(optimization)
    }
  }

  const handleFileRemoved = (fileId) => {
    // Ensure consistent type comparison (both as numbers)
    const removedId = Number(fileId)
    setFiles((prev) => prev.filter((f) => Number(f.id) !== removedId))
  }

  const handleFilesReordered = (newFiles) => {
    setFiles(newFiles)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="a-spinner" role="status" aria-label="Loading project" />
      </div>
    )
  }

  const busyCover = uploadingCover || creatingDraft
  const galleryImages = files.filter(f => f.file_type === 'image')

  return (
    <div className="w-full">
      <style>{TIPTAP_STYLES}</style>

      <header className="flex items-start gap-3 sm:gap-4 mb-8">
        <button
          type="button"
          onClick={onBack}
          className="a-icon-btn"
          aria-label="Back to projects"
          title="Back to projects"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="min-w-0 pt-1">
          <h1 className="a-title">{isEditing ? 'Edit project' : 'New project'}</h1>
          <p className="a-subtitle truncate">
            {isEditing
              ? (form.title || 'Untitled project')
              : 'Uploading a cover or gallery files creates a hidden draft right away.'}
          </p>
        </div>
      </header>

      {error && (
        <div className="a-alert a-alert--danger px-4 py-3 mb-6" role="alert">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="a-card p-5 sm:p-6 space-y-5">
          <SectionTitle icon={InformationCircleIcon}>Basic information</SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="project-title" className="a-label">
                Title <span className="text-red-300" aria-hidden>*</span>
              </label>
              <input
                id="project-title"
                type="text"
                aria-required="true"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="a-input"
                placeholder="Project name"
              />
            </div>

            <div>
              <label htmlFor="project-slug" className="a-label">Slug</label>
              <input
                id="project-slug"
                type="text"
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                className="a-input"
                placeholder="project-slug"
                aria-describedby="project-slug-help"
              />
              <p id="project-slug-help" className="a-help mt-1.5">
                Used in the URL. Leave it empty to generate it automatically.
              </p>
            </div>
          </div>

          <div>
            <span id="project-type-label" className="a-label">Project type</span>
            <div role="group" aria-labelledby="project-type-label" className="flex flex-wrap gap-2">
              <TypeButton
                icon={PhotoIcon}
                label="Gallery"
                active={form.project_type === 'gallery'}
                onClick={() => handleChange('project_type', 'gallery')}
              />
              <TypeButton
                icon={LinkIcon}
                label="External link"
                active={form.project_type === 'link'}
                onClick={() => handleChange('project_type', 'link')}
              />
            </div>
          </div>

          {form.project_type === 'link' && (
            <div>
              <label htmlFor="project-external-url" className="a-label">
                External URL <span className="text-red-300" aria-hidden>*</span>
              </label>
              <input
                id="project-external-url"
                type="url"
                aria-required="true"
                value={form.external_url}
                onChange={(e) => handleChange('external_url', e.target.value)}
                className="a-input"
                placeholder="https://example.com"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              id="project-visible"
              type="button"
              role="switch"
              aria-checked={form.is_active}
              onClick={() => handleChange('is_active', !form.is_active)}
              className="a-switch"
            />
            <label htmlFor="project-visible" className="text-sm font-semibold text-white/70 cursor-pointer">
              Visible on site
            </label>
          </div>

          <div>
            <span id="behance-badges-label" className="a-label">Behance gallery badges</span>
            <div role="group" aria-labelledby="behance-badges-label" className="flex flex-wrap gap-2">
              {BEHANCE_BADGES.map((badge) => {
                const isActive = (form.behance_badges || []).includes(badge.code)
                return (
                  <button
                    key={badge.code}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      const current = form.behance_badges || []
                      const next = isActive
                        ? current.filter(b => b !== badge.code)
                        : [...current, badge.code]
                      handleChange('behance_badges', next)
                    }}
                    className="a-chip"
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}${badge.img}`}
                      alt=""
                      className="w-4 h-auto"
                    />
                    {badge.label}
                  </button>
                )
              })}
            </div>
            <p className="a-help mt-1.5">Mark the Behance galleries that featured this project.</p>
          </div>
        </section>

        <section className="a-card p-5 sm:p-6 space-y-5">
          <SectionTitle icon={LanguageIcon}>Descriptions</SectionTitle>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-h-8">
                <span className="a-label mb-0 flex items-center gap-2">
                  <span className="a-badge">EN</span>
                  English
                </span>
              </div>
              <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
                <TipTapToolbar editor={editorEn} context="project" contextId={currentProjectId} />
                <EditorContent editor={editorEn} />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 min-h-8">
                <span className="a-label mb-0 flex items-center gap-2">
                  <span className="a-badge">ES</span>
                  Spanish
                </span>
                <button
                  type="button"
                  onClick={handleTranslateDescription}
                  disabled={translating || !hasEnContent}
                  className="a-btn a-btn--ghost a-btn--sm"
                  title="Translate the English description into Spanish"
                >
                  {translating ? (
                    <>
                      <span className="a-spinner a-spinner--sm" aria-hidden />
                      Translating…
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3.5 h-3.5" aria-hidden />
                      Translate from English
                    </>
                  )}
                </button>
              </div>
              <div className="a-inset overflow-hidden transition-colors focus-within:border-section-quests">
                <TipTapToolbar editor={editorEs} context="project" contextId={currentProjectId} />
                <EditorContent editor={editorEs} />
              </div>
            </div>
          </div>
        </section>

        {form.project_type === 'gallery' && (
          <section className="a-card p-5 sm:p-6 space-y-5">
            <div>
              <SectionTitle icon={LinkIcon}>Link button</SectionTitle>
              <p className="a-help mt-1">
                Optional. Shows a button after the description in the project detail.
              </p>
            </div>

            <div>
              <label htmlFor="project-link-url" className="a-label">Link URL</label>
              <input
                id="project-link-url"
                type="url"
                value={form.link_url}
                onChange={(e) => handleChange('link_url', e.target.value)}
                className="a-input"
                placeholder="https://example.com"
              />
            </div>

            {form.link_url.trim() && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="project-link-text-en" className="a-label">Button text (English)</label>
                  <input
                    id="project-link-text-en"
                    type="text"
                    value={form.link_text_en}
                    onChange={(e) => handleChange('link_text_en', e.target.value)}
                    className="a-input"
                    placeholder="Visit website"
                  />
                </div>
                <div>
                  <label htmlFor="project-link-text-es" className="a-label">Button text (Spanish)</label>
                  <input
                    id="project-link-text-es"
                    type="text"
                    value={form.link_text_es}
                    onChange={(e) => handleChange('link_text_es', e.target.value)}
                    className="a-input"
                    placeholder="Visitar sitio web"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <section className="a-card p-5 sm:p-6 space-y-5">
          <SectionTitle icon={PhotoIcon}>Cover image</SectionTitle>

          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            <div className="a-inset w-full sm:w-56 aspect-video flex-shrink-0 overflow-hidden grid place-items-center">
              {form.cover_image ? (
                <img
                  src={form.cover_image.startsWith('http') ? form.cover_image : `/${form.cover_image}`}
                  alt="Cover preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <PhotoIcon className="w-10 h-10 text-white/15" aria-hidden />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-4">
              <label
                aria-disabled={busyCover || undefined}
                className={`
                  a-btn a-btn--secondary relative
                  has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--a-accent)]
                  ${busyCover ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                {busyCover ? (
                  <span className="a-spinner a-spinner--sm" aria-hidden />
                ) : (
                  <CloudArrowUpIcon className="w-4 h-4" aria-hidden />
                )}
                {creatingDraft ? 'Creating draft…' : uploadingCover ? 'Uploading…' : 'Upload cover'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="sr-only"
                  disabled={busyCover}
                />
              </label>

              <div>
                <label htmlFor="project-cover-url" className="a-label">Image path or URL</label>
                <input
                  id="project-cover-url"
                  type="text"
                  value={form.cover_image}
                  onChange={(e) => handleChange('cover_image', e.target.value)}
                  className="a-input"
                  placeholder="https://…"
                />
              </div>
            </div>
          </div>

          {galleryImages.length > 0 && (
            <div>
              <span id="cover-from-gallery-label" className="a-label">Or pick one from the gallery</span>
              <div
                role="group"
                aria-labelledby="cover-from-gallery-label"
                className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2"
              >
                {galleryImages.map((file, i) => {
                  const filePath = file.path || file.file_path
                  const isSelected = form.cover_image === filePath
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleChange('cover_image', filePath)}
                      aria-pressed={isSelected}
                      aria-label={`Use gallery image ${i + 1} as cover`}
                      className={`
                        a-inset relative aspect-square overflow-hidden transition-colors
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--a-accent)]
                        ${isSelected ? 'border-section-quests' : 'hover:border-white/30'}
                      `}
                    >
                      <img
                        src={`/${filePath}`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full grid place-items-center bg-section-quests text-[var(--a-on-accent)]">
                          <CheckIcon className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        {form.project_type === 'gallery' && (
          <section className="a-card p-5 sm:p-6 space-y-5">
            <SectionTitle icon={RectangleStackIcon}>Gallery files</SectionTitle>

            <FileUploader
              projectId={currentProjectId}
              files={files}
              onFileUploaded={handleFileUploaded}
              onFileRemoved={handleFileRemoved}
              onFilesReordered={handleFilesReordered}
              onEnsureProject={ensureProjectExists}
            />
          </section>
        )}

        <div className="flex items-center justify-end gap-3 pt-6 border-t-2 border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="a-btn a-btn--ghost a-btn--lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="a-btn a-btn--primary a-btn--lg"
          >
            {saving ? (
              <>
                <span className="a-spinner a-spinner--sm border-black/25 border-t-[var(--a-on-accent)]" aria-hidden />
                Saving…
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" aria-hidden />
                {isEditing ? 'Save changes' : 'Create project'}
              </>
            )}
          </button>
        </div>
      </form>

      <OptimizationToast
        data={optimizationData}
        onDismiss={() => setOptimizationData(null)}
      />
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <h2 className="a-section-title flex items-center gap-2">
      <Icon className="w-5 h-5 flex-shrink-0 text-white/50" aria-hidden />
      {children}
    </h2>
  )
}

function TypeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="a-chip px-4 py-2 text-[0.8125rem]"
    >
      <Icon className="w-4 h-4" aria-hidden />
      {label}
    </button>
  )
}
