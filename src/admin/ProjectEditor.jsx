/**
 * Project editor - Create/Edit
 * Terminal CRT theme
 */

import React, { useState, useEffect, useCallback } from 'react'
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

export default function ProjectEditor({ projectId: initialProjectId, onBack, onSaved }) {
  // Track the current project ID (can be created during editing)
  const [currentProjectId, setCurrentProjectId] = useState(initialProjectId)
  const isEditing = !!currentProjectId

  const [loading, setLoading] = useState(!!initialProjectId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [creatingDraft, setCreatingDraft] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    slug: '',
    project_type: 'gallery',
    external_url: '',
    description_en: '',
    description_es: '',
    cover_image: '',
    is_active: false, // New projects start as inactive (drafts)
  })
  const [files, setFiles] = useState([])
  const [translating, setTranslating] = useState(false)

  // Translate description from English to Spanish
  const handleTranslateDescription = async () => {
    if (!form.description_en.trim()) {
      setError('Escribe la descripción en inglés primero')
      return
    }

    setTranslating(true)
    setError(null)

    try {
      const res = await fetch('/api/translate.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: form.description_en, from: 'en', to: 'es' }),
      })

      const data = await res.json()

      if (data.ok && data.translated) {
        setForm((prev) => ({ ...prev, description_es: data.translated }))
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
    if (!initialProjectId) return

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
            description_en: p.description_en || '',
            description_es: p.description_es || '',
            cover_image: p.cover_image || '',
            is_active: p.is_active ?? true,
          })
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
  }, [initialProjectId])

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

  const handleFileUploaded = (file) => {
    setFiles((prev) => [...prev, file])
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

        {/* Descriptions */}
        <section className="space-y-4">
          <h2 className="text-sm text-blue-500/60 admin-terminal-font">
            <span className="text-blue-600/40">// </span>Descriptions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English */}
            <div>
              <label className="block text-xs text-blue-500/50 mb-2 admin-terminal-font">
                description_en
              </label>
              <textarea
                value={form.description_en}
                onChange={(e) => handleChange('description_en', e.target.value)}
                rows={4}
                className="admin-input w-full px-4 py-3 rounded text-sm resize-none"
                placeholder="> Project description in English..."
              />
            </div>

            {/* Spanish */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-blue-500/50 admin-terminal-font">
                  description_es
                </label>
                <button
                  type="button"
                  onClick={handleTranslateDescription}
                  disabled={translating || !form.description_en.trim()}
                  className="
                    inline-flex items-center gap-1 px-2 py-1 rounded
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
              <textarea
                value={form.description_es}
                onChange={(e) => handleChange('description_es', e.target.value)}
                rows={4}
                className="admin-input w-full px-4 py-3 rounded text-sm resize-none"
                placeholder="> Descripción del proyecto en español..."
              />
            </div>
          </div>
        </section>

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
    </div>
  )
}

function TypeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-3 rounded flex-1 transition-all text-sm"
      style={{
        backgroundColor: active ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 10, 30, 0.4)',
        border: active ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(59, 130, 246, 0.1)',
        color: active ? '#60a5fa' : 'rgba(96, 165, 250, 0.4)',
        fontFamily: '"Cascadia Code", monospace',
      }}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  )
}
