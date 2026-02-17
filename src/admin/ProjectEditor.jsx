/**
 * Project editor - Create/Edit
 * Terminal CRT theme
 * Uses TipTap WYSIWYG for descriptions (EN/ES)
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import {
  ArrowLeftIcon,
  PhotoIcon,
  LinkIcon,
  CloudArrowUpIcon,
  CheckIcon,
  SparklesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid'
import FileUploader from './FileUploader'
import OptimizationToast from './OptimizationToast'

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
  .project-tiptap-content {
    font-family: "Cascadia Code", "Fira Code", monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    color: #e2e8f0;
    min-height: 120px;
    outline: none;
    padding: 0.75rem 1rem;
  }
  .project-tiptap-content p {
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f1f5f9;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-top: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .project-tiptap-content strong {
    color: #f1f5f9;
  }
  .project-tiptap-content em {
    font-style: italic;
  }
  .project-tiptap-content ul,
  .project-tiptap-content ol {
    padding-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  .project-tiptap-content ul {
    list-style-type: disc;
  }
  .project-tiptap-content ul li::marker {
    color: #60a5fa;
  }
  .project-tiptap-content ol {
    list-style-type: decimal;
  }
  .project-tiptap-content ol li::marker {
    color: #60a5fa;
  }
  .project-tiptap-content li {
    margin-bottom: 0.15rem;
  }
  .project-tiptap-content blockquote {
    border-left: 3px solid rgba(59, 130, 246, 0.4);
    padding-left: 1rem;
    margin: 0.5rem 0;
    color: rgba(226, 232, 240, 0.7);
    font-style: italic;
  }
  .project-tiptap-content pre {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(59, 130, 246, 0.15);
    border-radius: 0.375rem;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    overflow-x: auto;
    font-size: 0.8rem;
  }
  .project-tiptap-content pre code {
    color: #93c5fd;
    background: none;
    padding: 0;
  }
  .project-tiptap-content code {
    background: rgba(59, 130, 246, 0.1);
    color: #93c5fd;
    padding: 0.15rem 0.35rem;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  .project-tiptap-content hr {
    border: none;
    border-top: 1px solid rgba(59, 130, 246, 0.2);
    margin: 1rem 0;
  }
  .project-tiptap-content a,
  .project-tiptap-content .tiptap-link {
    color: #60a5fa;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .project-tiptap-content p.is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    color: rgba(59, 130, 246, 0.3);
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
    is_active: false, // New projects start as inactive (drafts)
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
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Placeholder.configure({ placeholder: 'Project description in English...' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'project-tiptap-content' } },
    onUpdate: ({ editor }) => {
      setHasEnContent(!!editor.getText().trim())
    },
  })

  // TipTap editor (Spanish description)
  const editorEs = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
      Placeholder.configure({ placeholder: 'Descripción del proyecto en español...' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'project-tiptap-content' } },
  })

  // Translate description from English to Spanish using the API
  const handleTranslateDescription = async () => {
    const htmlContent = editorEn?.getHTML() || ''
    const textContent = htmlToText(htmlContent)
    if (!textContent.trim()) {
      setError('Escribe la descripción en inglés primero')
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
        setError(data.error || 'Error en la traducción')
      }
    } catch (err) {
      setError('Error de conexión con el traductor')
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
        setError(`Error del servidor: ${res.status}`)
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
        setError(data.error || 'Error al crear borrador')
        return null
      }
    } catch (err) {
      console.error('Create draft error:', err)
      setError('Error de conexión: ' + err.message)
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
          setError('Proyecto no encontrado')
        }
      } catch (err) {
        setError('Error de conexión')
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
      setError('El título es requerido')
      return
    }

    if (form.project_type === 'link' && !form.external_url.trim()) {
      setError('La URL externa es requerida para proyectos tipo Link')
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
          is_active: true, // Activate when saving
        }),
      })

      const data = await res.json()

      if (data.ok) {
        onSaved?.()
      } else {
        setError(data.error || 'Error al guardar')
      }
    } catch (err) {
      setError('Error de conexión')
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
        setError(`Error del servidor: ${res.status}`)
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
        setError(data.error || 'Error al subir portada')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Error de conexión: ' + err.message)
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
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; loading_project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
          {isEditing ? 'edit_project' : 'new_project'}
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 rounded admin-error text-sm">
          <span className="opacity-60">&gt; </span>{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <section className="space-y-4">
          <h2 className="text-sm text-blue-500/60 admin-terminal-font">
            <span className="text-blue-600/40">// </span>Basic information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="admin-input w-full px-4 py-3 rounded text-sm"
                placeholder="> project_name"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                slug (URL)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                className="admin-input w-full px-4 py-3 rounded text-sm"
                placeholder="> project-slug"
              />
              <p className="text-blue-600/30 text-xs mt-1 admin-terminal-font">
                // auto-generated if empty
              </p>
            </div>
          </div>

          {/* Project type */}
          <div>
            <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
              project_type
            </label>
            <div className="flex gap-3">
              <TypeButton
                icon={PhotoIcon}
                label="gallery"
                active={form.project_type === 'gallery'}
                onClick={() => handleChange('project_type', 'gallery')}
              />
              <TypeButton
                icon={LinkIcon}
                label="external_link"
                active={form.project_type === 'link'}
                onClick={() => handleChange('project_type', 'link')}
              />
            </div>
          </div>

          {/* External URL (only for link type) */}
          {form.project_type === 'link' && (
            <div>
              <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                external_url <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={form.external_url}
                onChange={(e) => handleChange('external_url', e.target.value)}
                className="admin-input w-full px-4 py-3 rounded text-sm"
                placeholder="> https://example.com"
              />
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange('is_active', !form.is_active)}
              className={`
                w-12 h-7 rounded-full relative transition-all
                ${form.is_active ? 'admin-toggle-active' : 'admin-toggle-inactive'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-5 h-5 rounded-full shadow transition-transform
                  ${form.is_active ? 'left-6 bg-black' : 'left-1 bg-blue-400'}
                `}
              />
            </button>
            <span className="text-blue-500/50 text-xs admin-terminal-font">
              {form.is_active ? 'status: VISIBLE' : 'status: HIDDEN'}
            </span>
          </div>
        </section>

        {/* Descriptions — TipTap WYSIWYG */}
        <section className="space-y-4">
          <h2 className="text-sm text-blue-500/60 admin-terminal-font">
            <span className="text-blue-600/40">// </span>Descriptions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs text-blue-500/50 admin-terminal-font">
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    EN
                  </span>
                  description_en
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

            {/* Spanish */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs text-blue-500/50 admin-terminal-font">
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    ES
                  </span>
                  description_es
                </label>
                <button
                  type="button"
                  onClick={handleTranslateDescription}
                  disabled={translating || !hasEnContent}
                  className="
                    inline-flex items-center gap-1 px-2 py-0.5 rounded
                    text-xs transition-colors
                    disabled:opacity-40 disabled:cursor-not-allowed
                  "
                  style={{
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}
                  title="Auto translate"
                >
                  {translating ? (
                    <>
                      <ArrowPathIcon className="w-3 h-3 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3 h-3" />
                      <span>translate</span>
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
        </section>

        {/* Project links (only for gallery type) */}
        {form.project_type === 'gallery' && (
          <section className="space-y-4">
            <h2 className="text-sm text-blue-500/60 admin-terminal-font">
              <span className="text-blue-600/40">// </span>Link button (optional)
            </h2>

            <div>
              <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                link_url
              </label>
              <input
                type="url"
                value={form.link_url}
                onChange={(e) => handleChange('link_url', e.target.value)}
                className="admin-input w-full px-4 py-3 rounded text-sm"
                placeholder="> https://example.com"
              />
              <p className="text-blue-600/30 text-xs mt-1 admin-terminal-font">
                // appears as a button after the description in detail view
              </p>
            </div>

            {form.link_url.trim() && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                    button_text_en
                  </label>
                  <input
                    type="text"
                    value={form.link_text_en}
                    onChange={(e) => handleChange('link_text_en', e.target.value)}
                    className="admin-input w-full px-4 py-3 rounded text-sm"
                    placeholder="> Visit website"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                    button_text_es
                  </label>
                  <input
                    type="text"
                    value={form.link_text_es}
                    onChange={(e) => handleChange('link_text_es', e.target.value)}
                    className="admin-input w-full px-4 py-3 rounded text-sm"
                    placeholder="> Visitar sitio web"
                  />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Cover image */}
        <section className="space-y-4">
          <h2 className="text-sm text-blue-500/60 admin-terminal-font">
            <span className="text-blue-600/40">// </span>Cover image
          </h2>

          <div className="flex items-start gap-4">
            {/* Preview */}
            <div
              className="w-48 aspect-video rounded overflow-hidden flex-shrink-0"
              style={{
                backgroundColor: 'rgba(0, 10, 30, 0.6)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
              }}
            >
              {form.cover_image ? (
                <img
                  src={form.cover_image.startsWith('http') ? form.cover_image : `/${form.cover_image}`}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className="w-10 h-10 text-blue-500/15" />
                </div>
              )}
            </div>

            {/* Upload button */}
            <div className="flex-1">
              <label
                className="
                  inline-flex items-center gap-2 px-4 py-2 rounded
                  cursor-pointer transition-colors
                "
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                }}
              >
                {(uploadingCover || creatingDraft) ? (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CloudArrowUpIcon className="w-5 h-5" />
                )}
                <span className="text-sm admin-terminal-font">
                  {creatingDraft ? 'creating_draft...' : uploadingCover ? 'uploading...' : '> upload_cover'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                  disabled={uploadingCover || creatingDraft}
                />
              </label>

              {/* Manual URL input */}
              <div className="mt-3">
                <input
                  type="text"
                  value={form.cover_image}
                  onChange={(e) => handleChange('cover_image', e.target.value)}
                  className="admin-input w-full px-4 py-2 rounded text-xs"
                  placeholder="> paste image URL..."
                />
              </div>
            </div>
          </div>

          {/* Select from existing images */}
          {files.filter(f => f.file_type === 'image').length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-blue-500/40 mb-3 admin-terminal-font">
                // or select from gallery:
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {files
                  .filter(f => f.file_type === 'image')
                  .map((file) => {
                    const filePath = file.path || file.file_path
                    const isSelected = form.cover_image === filePath
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handleChange('cover_image', filePath)}
                        className="relative aspect-square rounded overflow-hidden transition-all"
                        style={{
                          border: isSelected
                            ? '2px solid #3b82f6'
                            : '2px solid transparent',
                          boxShadow: isSelected
                            ? '0 0 12px rgba(59, 130, 246, 0.4)'
                            : 'none',
                        }}
                      >
                        <img
                          src={`/${filePath}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(59, 130, 246, 0.3)' }}>
                            <CheckIcon className="w-6 h-6 text-white drop-shadow-lg" />
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </section>

        {/* Gallery files (only for gallery type) */}
        {form.project_type === 'gallery' && (
          <section className="space-y-4">
            <h2 className="text-sm text-blue-500/60 admin-terminal-font">
              <span className="text-blue-600/40">// </span>Gallery files
            </h2>

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

        {/* Submit */}
        <div
          className="flex items-center justify-end gap-4 pt-4"
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
            disabled={saving}
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
                <span>&gt; {isEditing ? 'save_changes' : 'create_project'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Image optimization feedback toast */}
      <OptimizationToast
        data={optimizationData}
        onDismiss={() => setOptimizationData(null)}
      />
    </div>
  )
}

function TypeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded text-sm transition-all
        ${active
          ? 'text-blue-300'
          : 'text-blue-600 hover:text-blue-400'
        }
      `}
      style={{
        backgroundColor: active ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
        border: `1px solid ${active ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.15)'}`,
      }}
    >
      <Icon className="w-4 h-4" />
      <span className="admin-terminal-font">{label}</span>
    </button>
  )
}
