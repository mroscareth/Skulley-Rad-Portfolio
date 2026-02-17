/**
 * File upload component with drag & drop
 * Includes reordering of existing files with drag & drop
 * Terminal CRT theme
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
  CheckIcon,
  XCircleIcon,
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
  onEnsureProject, // Function to create project if needed
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState([])
  const [errors, setErrors] = useState([])
  const [savingOrder, setSavingOrder] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // null | 'single' | 'bulk'
  const [fileToDelete, setFileToDelete] = useState(null)
  const [creatingProject, setCreatingProject] = useState(false)
  const inputRef = useRef(null)
  const currentProjectIdRef = useRef(projectId) // Track current project ID

  // Update ref when projectId changes
  if (projectId !== currentProjectIdRef.current) {
    currentProjectIdRef.current = projectId
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Very responsive drag
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

  const uploadFile = async (file, projectIdToUse) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectIdToUse)

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
        onFileUploaded?.(data.file, data.optimization || null)
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

    if (filesToUpload.length === 0) return

    // Ensure project exists before uploading
    let projectIdToUse = currentProjectIdRef.current

    if (!projectIdToUse && onEnsureProject) {
      setCreatingProject(true)
      try {
        projectIdToUse = await onEnsureProject()
        if (projectIdToUse) {
          currentProjectIdRef.current = projectIdToUse
        }
      } finally {
        setCreatingProject(false)
      }
    }

    if (!projectIdToUse) {
      setErrors((prev) => [...prev, { name: 'upload', error: 'No se pudo crear el proyecto' }])
      return
    }

    // Upload files sequentially
    for (const file of filesToUpload) {
      await uploadFile(file, projectIdToUse)
    }
  }, [projectId, onEnsureProject])

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

  // Toggle selection mode
  const toggleSelectMode = () => {
    setSelectMode(!selectMode)
    setSelectedIds(new Set())
    setConfirmDelete(null)
  }

  // Toggle file selection (ensure ID is always a number for consistency)
  const toggleFileSelection = (fileId) => {
    const id = Number(fileId)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(files.map((f) => Number(f.id))))
    }
  }

  // Request single file deletion (shows inline confirm)
  const requestDeleteFile = (file) => {
    setFileToDelete(file)
    setConfirmDelete('single')
  }

  // Request bulk deletion
  const requestBulkDelete = () => {
    if (selectedIds.size === 0) return
    setConfirmDelete('bulk')
  }

  // Cancel delete
  const cancelDelete = () => {
    setConfirmDelete(null)
    setFileToDelete(null)
  }

  // Execute single file deletion
  const executeDeleteFile = async (file) => {
    if (!file || !file.id) {
      console.error('Invalid file to delete:', file)
      setErrors((prev) => [...prev, { name: 'Error', error: 'Archivo inválido' }])
      setConfirmDelete(null)
      setFileToDelete(null)
      return
    }

    setDeleting(true)
    console.log('Deleting file:', file.id)

    try {
      const res = await fetch(`/api/upload.php?id=${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      console.log('Delete response status:', res.status)

      // Parse JSON response (read body only once)
      let data
      try {
        data = await res.json()
      } catch (parseErr) {
        console.error('JSON parse error:', parseErr)
        setErrors((prev) => [...prev, { name: `Archivo ${file.id}`, error: `Error al procesar respuesta` }])
        return
      }

      console.log('Delete response:', data)

      if (data.ok) {
        onFileRemoved?.(file.id)
      } else {
        setErrors((prev) => [...prev, { name: `Archivo ${file.id}`, error: data.error || 'Error al eliminar' }])
      }
    } catch (err) {
      console.error('Delete error:', err)
      setErrors((prev) => [...prev, { name: `Archivo ${file.id}`, error: 'Error de conexión: ' + err.message }])
    } finally {
      setDeleting(false)
      setConfirmDelete(null)
      setFileToDelete(null)
    }
  }

  // Execute bulk deletion
  const executeBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setDeleting(true)
    const idsToDelete = Array.from(selectedIds)

    for (const id of idsToDelete) {
      try {
        const res = await fetch(`/api/upload.php?id=${id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        const data = await res.json()
        if (data.ok) {
          onFileRemoved?.(id)
          setSelectedIds((prev) => {
            const next = new Set(prev)
            next.delete(id)
            return next
          })
        }
      } catch (err) {
        // Continue with other deletions
      }
    }

    setDeleting(false)
    setConfirmDelete(null)
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // Handle click on file (either select or request delete based on mode)
  const handleFileAction = (file) => {
    if (selectMode) {
      toggleFileSelection(file.id)
    } else {
      requestDeleteFile(file)
    }
  }

  // Reorder files
  const handleSortEnd = async (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id)
      const newIndex = files.findIndex((f) => f.id === over.id)

      const newFiles = arrayMove(files, oldIndex, newIndex)

      // Notify parent
      onFilesReordered?.(newFiles)

      // Save to server
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
        className="relative rounded p-8 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          border: isDragging
            ? '2px dashed rgba(59, 130, 246, 0.6)'
            : '2px dashed rgba(59, 130, 246, 0.15)',
          backgroundColor: isDragging
            ? 'rgba(59, 130, 246, 0.08)'
            : 'rgba(0, 10, 30, 0.3)',
          boxShadow: isDragging
            ? '0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 20px rgba(59, 130, 246, 0.05)'
            : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_TYPES).join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        {creatingProject ? (
          <>
            <div className="w-12 h-12 mb-3 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 text-sm text-center admin-terminal-font">
              &gt; creating_draft_project...
            </p>
          </>
        ) : (
          <>
            <CloudArrowUpIcon
              className={`w-12 h-12 mb-3 transition-colors ${isDragging ? 'text-blue-400' : 'text-blue-500/20'
                }`}
            />
            <p className="text-blue-400/60 text-sm text-center admin-terminal-font">
              {isDragging ? (
                '> drop_files_here'
              ) : (
                <>
                  Drag files here or <span className="text-blue-400">&gt; click_to_browse</span>
                </>
              )}
            </p>
          </>
        )}
        <p className="text-blue-600/30 text-xs mt-2 admin-terminal-font">
          // Images (JPG, PNG, WebP, GIF) up to 10MB | Videos (MP4, WebM) up to 50MB
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded admin-error"
            >
              <span className="text-sm">
                <strong>{err.name}:</strong> {err.error}
              </span>
              <button
                type="button"
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
              className="flex items-center gap-3 p-3 rounded"
              style={{
                backgroundColor: 'rgba(0, 10, 30, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
              }}
            >
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-300/60 text-sm flex-1 truncate admin-terminal-font">{file.name}</span>
              <span className="text-blue-500/40 text-xs admin-terminal-font">uploading...</span>
            </div>
          ))}
        </div>
      )}

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div
          className="p-4 rounded flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <p className="text-blue-300 text-sm admin-terminal-font">
            <span className="text-red-400">&gt; </span>
            {confirmDelete === 'single'
              ? 'confirm_delete(file)?'
              : `confirm_delete(${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''})?`
            }
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded text-blue-500/50 hover:text-blue-400 text-xs transition-colors admin-terminal-font"
              style={{ border: '1px solid rgba(59, 130, 246, 0.15)' }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete === 'single' ? executeDeleteFile(fileToDelete) : executeBulkDelete()}
              disabled={deleting}
              className="px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1 admin-terminal-font"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                color: '#000',
                border: '1px solid rgba(239, 68, 68, 0.8)',
              }}
            >
              {deleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>deleting...</span>
                </>
              ) : (
                <>
                  <TrashIcon className="w-4 h-4" />
                  <span>delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Files list with drag & drop reordering */}
      {files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-blue-500/40 text-xs admin-terminal-font">
              {selectMode && selectedIds.size > 0
                ? `// ${selectedIds.size} selected`
                : `// ${files.length} file${files.length !== 1 ? 's' : ''} | drag to reorder`
              }
            </p>
            <div className="flex items-center gap-2">
              {savingOrder && (
                <span className="text-blue-400 text-xs admin-terminal-font">saving_order...</span>
              )}
              {/* Select mode toggle */}
              <button
                type="button"
                onClick={toggleSelectMode}
                className="px-3 py-1 rounded text-xs transition-colors admin-terminal-font"
                style={{
                  backgroundColor: selectMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(0, 10, 30, 0.4)',
                  color: selectMode ? '#60a5fa' : 'rgba(96, 165, 250, 0.4)',
                  border: selectMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(59, 130, 246, 0.1)',
                }}
              >
                {selectMode ? 'cancel_select' : 'select'}
              </button>
              {/* Bulk actions when in select mode */}
              {selectMode && (
                <>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3 py-1 rounded text-xs transition-colors admin-terminal-font"
                    style={{
                      backgroundColor: 'rgba(0, 10, 30, 0.4)',
                      color: 'rgba(96, 165, 250, 0.5)',
                      border: '1px solid rgba(59, 130, 246, 0.1)',
                    }}
                  >
                    {selectedIds.size === files.length ? 'deselect_all' : 'select_all'}
                  </button>
                  <button
                    type="button"
                    onClick={requestBulkDelete}
                    disabled={selectedIds.size === 0 || deleting}
                    className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 admin-terminal-font"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    <TrashIcon className="w-3 h-3" />
                    delete ({selectedIds.size})
                  </button>
                </>
              )}
            </div>
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
                    selectMode={selectMode}
                    isSelected={selectedIds.has(Number(file.id))}
                    onAction={() => handleFileAction(file)}
                    onToggleSelect={() => toggleFileSelection(file.id)}
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

function SortableFileThumb({ file, index, selectMode, isSelected, onAction, onToggleSelect }) {
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
    transition: transition || 'transform 150ms ease',
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.9 : 1,
  }

  const isVideo = file.file_type === 'video' || file.path?.match(/\.(mp4|webm)$/i)
  const url = file.path?.startsWith('http') ? file.path : `/${file.path || file.file_path}`

  // Handle delete click with event stop
  const handleDeleteClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onAction()
  }

  // Handle select click with event stop
  const handleSelectClick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleSelect()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!selectMode ? { ...attributes, ...listeners } : {})}
      className={`
        group relative aspect-square rounded overflow-hidden
        ${!selectMode ? 'cursor-grab active:cursor-grabbing' : ''}
        transition-shadow
      `}
    >
      {/* Terminal border */}
      <div
        className="absolute inset-0 rounded pointer-events-none z-[5]"
        style={{
          border: isDragging
            ? '2px solid rgba(59, 130, 246, 0.6)'
            : isSelected
              ? '2px solid rgba(59, 130, 246, 0.5)'
              : '1px solid rgba(59, 130, 246, 0.1)',
          boxShadow: isDragging
            ? '0 0 20px rgba(59, 130, 246, 0.3)'
            : isSelected
              ? '0 0 12px rgba(59, 130, 246, 0.2)'
              : 'none',
        }}
      />

      {/* Selection checkbox in select mode */}
      {selectMode && (
        <div
          onClick={handleSelectClick}
          className="absolute top-1 left-1 z-30 w-6 h-6 rounded flex items-center justify-center cursor-pointer transition-colors"
          style={{
            backgroundColor: isSelected ? '#3b82f6' : 'rgba(0, 10, 30, 0.7)',
            border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          {isSelected && <CheckIcon className="w-4 h-4 text-black" />}
        </div>
      )}

      {/* Drag indicator - visual only, whole card is draggable */}
      {!selectMode && (
        <div
          className="absolute top-1 left-1 z-10 p-1.5 rounded pointer-events-none opacity-60"
          style={{ backgroundColor: 'rgba(0, 10, 30, 0.7)' }}
        >
          <Bars3Icon className="w-3 h-3 text-blue-400/60" />
        </div>
      )}

      {/* Order number */}
      <div
        className="absolute top-1 right-1 z-10 w-5 h-5 rounded flex items-center justify-center pointer-events-none"
        style={{
          backgroundColor: 'rgba(0, 10, 30, 0.7)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        <span className="text-blue-500/50 text-xs font-bold" style={{ fontFamily: '"Cascadia Code", monospace' }}>
          {index + 1}
        </span>
      </div>

      {isVideo ? (
        <div
          className="w-full h-full flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: 'rgba(0, 10, 30, 0.6)' }}
        >
          <VideoCameraIcon className="w-8 h-8 text-blue-500/30" />
        </div>
      ) : (
        <img
          src={url}
          alt=""
          className="w-full h-full object-cover pointer-events-none select-none"
          loading="lazy"
          draggable="false"
        />
      )}

      {/* Delete button - positioned to not interfere with drag */}
      {!selectMode && !isDragging && (
        <div
          onClick={handleDeleteClick}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 p-2 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 hover:scale-110"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            border: '1px solid rgba(239, 68, 68, 0.8)',
          }}
          title="Eliminar"
        >
          <TrashIcon className="w-4 h-4 text-black" />
        </div>
      )}

      {/* Clickable overlay for selection mode */}
      {selectMode && (
        <div
          onClick={handleSelectClick}
          className="absolute inset-0 z-20 cursor-pointer"
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
        />
      )}

      {/* Type indicator */}
      <div className="absolute bottom-1 right-1 z-10 pointer-events-none">
        {isVideo ? (
          <VideoCameraIcon className="w-4 h-4 text-blue-400/40" />
        ) : (
          <PhotoIcon className="w-4 h-4 text-blue-400/40" />
        )}
      </div>
    </div>
  )
}
