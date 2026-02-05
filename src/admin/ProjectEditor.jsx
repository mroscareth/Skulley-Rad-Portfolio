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
} from '@heroicons/react/24/solid'
import FileUploader from './FileUploader'

export default function ProjectEditor({ projectId, onBack, onSaved }) {
  const isEditing = !!projectId

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCover, setUploadingCover] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    slug: '',
    project_type: 'gallery',
    external_url: '',
    description_en: '',
    description_es: '',
    cover_image: '',
    is_active: true,
  })
  const [files, setFiles] = useState([])

  // Fetch project if editing
  useEffect(() => {
    if (!isEditing) return

    const fetchProject = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/projects.php?id=${projectId}`, {
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
  }, [projectId, isEditing])

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
      const url = isEditing ? `/api/projects.php?id=${projectId}` : '/api/projects.php'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

    if (!projectId) {
      setError('Guarda el proyecto primero para subir la portada')
      return
    }

    setUploadingCover(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId)
    formData.append('is_cover', '1')

    try {
      const res = await fetch('/api/upload.php', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()

      if (data.ok && data.path) {
        setForm((prev) => ({ ...prev, cover_image: data.path }))
      } else {
        setError(data.error || 'Error al subir portada')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setUploadingCover(false)
    }
  }

  const handleFileUploaded = (file) => {
    setFiles((prev) => [...prev, file])
  }

  const handleFileRemoved = (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
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
              <label className="block text-sm text-white/60 mb-2">
                Descripción (Español)
              </label>
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
              {isEditing ? (
                <label className="
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg
                  bg-white/10 hover:bg-white/20 transition-colors
                  cursor-pointer
                ">
                  {uploadingCover ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CloudArrowUpIcon className="w-5 h-5 text-white" />
                  )}
                  <span className="text-white text-sm">
                    {uploadingCover ? 'Subiendo...' : 'Subir portada'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                    disabled={uploadingCover}
                  />
                </label>
              ) : (
                <p className="text-white/50 text-sm">
                  Guarda el proyecto primero para subir la portada
                </p>
              )}

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
        {form.project_type === 'gallery' && isEditing && (
          <section className="space-y-4">
            <h2 
              className="text-lg text-white/80"
              style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
            >
              Archivos de la galería
            </h2>

            <FileUploader
              projectId={projectId}
              files={files}
              onFileUploaded={handleFileUploaded}
              onFileRemoved={handleFileRemoved}
              onFilesReordered={handleFilesReordered}
            />
          </section>
        )}

        {form.project_type === 'gallery' && !isEditing && (
          <section className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
            <PhotoIcon className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">
              Guarda el proyecto para poder agregar imágenes y videos
            </p>
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
