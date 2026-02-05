/**
 * Componente de upload de archivos con drag & drop
 * Incluye reordenamiento de archivos existentes con drag & drop
 */

import React, { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CloudArrowUpIcon,
  XMarkIcon,
  PhotoIcon,
  VideoCameraIcon,
  TrashIcon,
  Bars3Icon,
} from '@heroicons/react/24/solid'

const ACCEPTED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

export default function FileUploader({
  projectId,
  files = [],
  onFilesChange,
  onFileUploaded,
  onFileRemoved,
  onFilesReordered,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState([])
  const [errors, setErrors] = useState([])
  const [savingOrder, setSavingOrder] = useState(false)
  const inputRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES[file.type]) {
      return 'Tipo de archivo no soportado'
    }

    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024

    if (file.size > maxSize) {
      return `Archivo muy grande (máx ${isVideo ? '50MB' : '10MB'})`
    }

    return null
  }

  const uploadFile = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId)

    const tempId = `temp-${Date.now()}-${Math.random()}`
    
    setUploading((prev) => [...prev, { id: tempId, name: file.name, progress: 0 }])

    try {
      const res = await fetch('/api/upload.php', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await res.json()

      if (data.ok && data.file) {
        onFileUploaded?.(data.file)
      } else {
        setErrors((prev) => [...prev, { name: file.name, error: data.error || 'Error al subir' }])
      }
    } catch (err) {
      setErrors((prev) => [...prev, { name: file.name, error: 'Error de conexión' }])
    } finally {
      setUploading((prev) => prev.filter((u) => u.id !== tempId))
    }
  }

  const handleFiles = useCallback(async (fileList) => {
    const filesToUpload = []

    for (const file of fileList) {
      const error = validateFile(file)
      if (error) {
        setErrors((prev) => [...prev, { name: file.name, error }])
      } else {
        filesToUpload.push(file)
      }
    }

    // Upload files sequentially
    for (const file of filesToUpload) {
      await uploadFile(file)
    }
  }, [projectId])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer?.files
    if (files?.length) {
      handleFiles(Array.from(files))
    }
  }, [handleFiles])

  const handleInputChange = useCallback((e) => {
    const files = e.target.files
    if (files?.length) {
      handleFiles(Array.from(files))
    }
    e.target.value = ''
  }, [handleFiles])

  const handleRemoveFile = async (file) => {
    if (!confirm('¿Eliminar este archivo?')) return

    try {
      const res = await fetch(`/api/upload.php?id=${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await res.json()

      if (data.ok) {
        onFileRemoved?.(file.id)
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (err) {
      alert('Error de conexión')
    }
  }

  // Reordenar archivos
  const handleSortEnd = async (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id)
      const newIndex = files.findIndex((f) => f.id === over.id)
      
      const newFiles = arrayMove(files, oldIndex, newIndex)
      
      // Notificar al padre
      onFilesReordered?.(newFiles)
      
      // Guardar en el servidor
      setSavingOrder(true)
      try {
        const orders = newFiles.map((f, index) => ({
          id: f.id,
          display_order: index + 1,
        }))

        await fetch('/api/upload.php?action=reorder', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders }),
        })
      } catch (err) {
        console.error('Error al guardar orden:', err)
      } finally {
        setSavingOrder(false)
      }
    }
  }

  const dismissError = (index) => {
    setErrors((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative rounded-xl border-2 border-dashed p-8
          flex flex-col items-center justify-center
          cursor-pointer transition-all
          ${isDragging
            ? 'border-cyan-400 bg-cyan-400/10'
            : 'border-white/20 hover:border-white/40 hover:bg-white/5'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_TYPES).join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        <CloudArrowUpIcon
          className={`w-12 h-12 mb-3 transition-colors ${
            isDragging ? 'text-cyan-400' : 'text-white/30'
          }`}
        />
        <p className="text-white/70 text-sm text-center">
          {isDragging ? (
            'Suelta los archivos aquí'
          ) : (
            <>
              Arrastra archivos aquí o <span className="text-cyan-400">haz clic</span>
            </>
          )}
        </p>
        <p className="text-white/40 text-xs mt-2">
          Imágenes (JPG, PNG, WebP, GIF) hasta 10MB • Videos (MP4, WebM) hasta 50MB
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20"
            >
              <span className="text-red-400 text-sm">
                <strong>{err.name}:</strong> {err.error}
              </span>
              <button
                onClick={() => dismissError(i)}
                className="text-red-400 hover:text-red-300"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Uploading */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
            >
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/70 text-sm flex-1 truncate">{file.name}</span>
              <span className="text-white/40 text-xs">Subiendo...</span>
            </div>
          ))}
        </div>
      )}

      {/* Files list with drag & drop reordering */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-white/50 text-sm">
              {files.length} archivo{files.length !== 1 ? 's' : ''} • Arrastra para reordenar
            </p>
            {savingOrder && (
              <span className="text-cyan-400 text-xs">Guardando orden...</span>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSortEnd}
          >
            <SortableContext
              items={files.map((f) => f.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((file, index) => (
                  <SortableFileThumb
                    key={file.id}
                    file={file}
                    index={index}
                    onRemove={() => handleRemoveFile(file)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}

function SortableFileThumb({ file, index, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  }

  const isVideo = file.file_type === 'video' || file.path?.match(/\.(mp4|webm)$/i)
  const url = file.path?.startsWith('http') ? file.path : `/${file.path || file.file_path}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative aspect-square rounded-lg overflow-hidden bg-slate-800
        ${isDragging ? 'shadow-2xl shadow-cyan-500/30 scale-105' : ''}
      `}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 p-1.5 rounded bg-black/60 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Arrastrar para reordenar"
      >
        <Bars3Icon className="w-3 h-3 text-white" />
      </div>

      {/* Order number */}
      <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded bg-black/60 flex items-center justify-center">
        <span className="text-white text-xs font-medium">{index + 1}</span>
      </div>

      {isVideo ? (
        <div className="w-full h-full flex items-center justify-center bg-slate-700">
          <VideoCameraIcon className="w-8 h-8 text-white/40" />
        </div>
      ) : (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Overlay with delete button */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={onRemove}
          className="p-2 rounded-full bg-red-500/70 hover:bg-red-500 transition-colors"
          title="Eliminar"
        >
          <TrashIcon className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Type indicator */}
      <div className="absolute bottom-1 right-1">
        {isVideo ? (
          <VideoCameraIcon className="w-4 h-4 text-white/60" />
        ) : (
          <PhotoIcon className="w-4 h-4 text-white/60" />
        )}
      </div>
    </div>
  )
}
