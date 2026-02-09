/**
 * Project editor - Create/Edit
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
        <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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
          {isEditing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        </h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic info */}
        <section className="space-y-4">
          <h2 
            className="text-lg text-white/80"
            style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
          >
            Información básica
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Título *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-white/30
                  focus:outline-none focus:border-cyan-400/50
                  transition-colors
                "
                placeholder="Mi proyecto"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Slug (URL)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-white/30
                  focus:outline-none focus:border-cyan-400/50
                  transition-colors
                "
                placeholder="mi-proyecto"
              />
              <p className="text-white/40 text-xs mt-1">
                Se genera automáticamente si lo dejas vacío
              </p>
            </div>
          </div>

          {/* Project type */}
          <div>
            <label className="block text-sm text-white/60 mb-2">
              Tipo de proyecto
            </label>
            <div className="flex gap-3">
              <TypeButton
                icon={PhotoIcon}
                label="Galería de imágenes"
                active={form.project_type === 'gallery'}
                onClick={() => handleChange('project_type', 'gallery')}
              />
              <TypeButton
                icon={LinkIcon}
                label="Link externo"
                active={form.project_type === 'link'}
                onClick={() => handleChange('project_type', 'link')}
              />
            </div>
          </div>

          {/* External URL (only for link type) */}
          {form.project_type === 'link' && (
            <div>
              <label className="block text-sm text-white/60 mb-2">
                URL externa *
              </label>
              <input
                type="url"
                value={form.external_url}
                onChange={(e) => handleChange('external_url', e.target.value)}
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-white/30
                  focus:outline-none focus:border-cyan-400/50
                  transition-colors
                "
                placeholder="https://ejemplo.com"
              />
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleChange('is_active', !form.is_active)}
              className={`
                w-12 h-7 rounded-full relative transition-colors
                ${form.is_active ? 'bg-cyan-500' : 'bg-white/20'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform
                  ${form.is_active ? 'left-6' : 'left-1'}
                `}
              />
            </button>
            <span className="text-white/70 text-sm">
              {form.is_active ? 'Visible en el sitio' : 'Oculto'}
            </span>
          </div>
        </section>

        {/* Descriptions */}
        <section className="space-y-4">
          <h2 
            className="text-lg text-white/80"
            style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
          >
            Descripciones
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English */}
            <div>
              <label className="block text-sm text-white/60 mb-2">
                Descripción (Inglés)
              </label>
              <textarea
                value={form.description_en}
                onChange={(e) => handleChange('description_en', e.target.value)}
                rows={4}
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-white/30
                  focus:outline-none focus:border-cyan-400/50
                  transition-colors resize-none
                "
                placeholder="Project description in English..."
              />
            </div>

            {/* Spanish */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-white/60">
                  Descripción (Español)
                </label>
                <button
                  type="button"
                  onClick={handleTranslateDescription}
                  disabled={translating || !form.description_en.trim()}
                  className="
                    inline-flex items-center gap-1 px-2 py-1 rounded-md
                    bg-purple-500/20 hover:bg-purple-500/30
                    text-purple-400 text-xs font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors
                  "
                  title="Traducir automáticamente"
                >
                  {translating ? (
                    <>
                      <ArrowPathIcon className="w-3 h-3 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-3 h-3" />
                      <span>Traducir</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={form.description_es}
                onChange={(e) => handleChange('description_es', e.target.value)}
                rows={4}
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-white/5 border border-white/10
                  text-white placeholder-white/30
                  focus:outline-none focus:border-cyan-400/50
                  transition-colors resize-none
                "
                placeholder="Descripción del proyecto en español..."
              />
            </div>
          </div>
        </section>

        {/* Cover image */}
        <section className="space-y-4">
          <h2 
            className="text-lg text-white/80"
            style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
          >
            Imagen de portada
          </h2>

          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="w-48 aspect-video rounded-xl overflow-hidden bg-slate-800 flex-shrink-0">
              {form.cover_image ? (
                <img
                  src={form.cover_image.startsWith('http') ? form.cover_image : `/${form.cover_image}`}
                  alt="Cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PhotoIcon className="w-10 h-10 text-white/20" />
                </div>
              )}
            </div>

            {/* Upload button */}
            <div className="flex-1">
              <label className="
                inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-white/10 hover:bg-white/20 transition-colors
                cursor-pointer
              ">
                {(uploadingCover || creatingDraft) ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CloudArrowUpIcon className="w-5 h-5 text-white" />
                )}
                <span className="text-white text-sm">
                  {creatingDraft ? 'Creando borrador...' : uploadingCover ? 'Subiendo...' : 'Subir portada'}
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
                  className="
                    w-full px-4 py-2 rounded-lg
                    bg-white/5 border border-white/10
                    text-white placeholder-white/30 text-sm
                    focus:outline-none focus:border-cyan-400/50
                    transition-colors
                  "
                  placeholder="O pega una URL de imagen..."
                />
              </div>
            </div>
          </div>

          {/* Select from existing images */}
          {files.filter(f => f.file_type === 'image').length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-white/60 mb-3">
                O selecciona una imagen de la galería:
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
                        className={`
                          relative aspect-square rounded-lg overflow-hidden
                          border-2 transition-all
                          ${isSelected 
                            ? 'border-cyan-400 ring-2 ring-cyan-400/50' 
                            : 'border-transparent hover:border-white/30'
                          }
                        `}
                      >
                        <img
                          src={`/${filePath}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-cyan-500/30 flex items-center justify-center">
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
            <h2 
              className="text-lg text-white/80"
              style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
            >
              Archivos de la galería
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
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-xl text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
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
                <span>{isEditing ? 'Guardar cambios' : 'Crear proyecto'}</span>
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
      className={`
        flex items-center gap-2 px-4 py-3 rounded-xl
        border transition-all flex-1
        ${active
          ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-400'
          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
        }
      `}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
