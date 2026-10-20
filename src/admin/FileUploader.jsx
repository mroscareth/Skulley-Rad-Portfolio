/**
 * File upload component with drag & drop
 * Includes reordering of existing files with drag & drop
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
      return 'Unsupported file type'
    }

    const isVideo = file.type.startsWith('video/')
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024

    if (file.size > maxSize) {
      return `File too large (max ${isVideo ? '50 MB' : '10 MB'})`
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
        setErrors((prev) => [...prev, { name: file.name, error: data.error || 'Upload failed' }])
      }
    } catch (err) {
      setErrors((prev) => [...prev, { name: file.name, error: 'Connection error' }])
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
      setErrors((prev) => [...prev, { name: 'Upload', error: "Couldn't create the project" }])
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
      setErrors((prev) => [...prev, { name: 'Error', error: 'Invalid file' }])
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
        setErrors((prev) => [...prev, { name: `File ${file.id}`, error: "Couldn't read the server response" }])
        return
      }

      console.log('Delete response:', data)

      if (data.ok) {
        onFileRemoved?.(file.id)
      } else {
        setErrors((prev) => [...prev, { name: `File ${file.id}`, error: data.error || 'Delete failed' }])
      }
    } catch (err) {
      console.error('Delete error:', err)
      setErrors((prev) => [...prev, { name: `File ${file.id}`, error: 'Connection error: ' + err.message }])
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

  const openFilePicker = () => inputRef.current?.click()

  return (
    <div className="space-y-4">
      {/* Children ignore pointer events so dragging across them doesn't fire
          dragleave and make the drop state flicker. */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload gallery files"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            openFilePicker()
          }
        }}
        className={`
          flex flex-col items-center justify-center gap-2 px-4 py-8 sm:px-8 sm:py-10 text-center
          rounded-[var(--a-radius)] border-2 border-dashed cursor-pointer transition-colors
          *:pointer-events-none
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--a-accent)]
          ${isDragging
            ? 'border-section-quests bg-[var(--a-accent-soft)]'
            : 'border-white/15 bg-[var(--a-surface-2)] hover:border-white/30'}
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

        {creatingProject ? (
          <>
            <div className="a-spinner mb-1" aria-hidden />
            <p className="text-sm text-white/70" role="status">Creating a draft project…</p>
          </>
        ) : (
          <>
            <CloudArrowUpIcon
              className={`w-10 h-10 mb-1 transition-colors ${isDragging ? 'text-section-quests' : 'text-white/30'}`}
              aria-hidden
            />
            <p className="text-sm text-white/70">
              {isDragging ? (
                'Drop files to upload'
              ) : (
                <>
                  Drag files here or{' '}
                  <span className="font-bold text-white underline underline-offset-4 decoration-white/30">browse</span>
                </>
              )}
            </p>
          </>
        )}
        <p className="a-help">
          Images (JPG, PNG, WebP, GIF) up to 10 MB · Videos (MP4, WebM) up to 50 MB
        </p>
      </div>

      {errors.length > 0 && (
        <div className="space-y-2" role="alert">
          {errors.map((err, i) => (
            <div key={i} className="a-alert a-alert--danger items-center justify-between pl-4 pr-2 py-2">
              <span className="min-w-0 break-words">
                <strong className="font-bold">{err.name}:</strong> {err.error}
              </span>
              <button
                type="button"
                onClick={() => dismissError(i)}
                className="a-icon-btn a-icon-btn--sm border-transparent text-inherit"
                aria-label="Dismiss error"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((file) => (
            <div key={file.id} className="a-inset flex items-center gap-3 px-3 py-2.5">
              <span className="a-spinner a-spinner--sm" aria-hidden />
              <span className="a-code flex-1 min-w-0 truncate">{file.name}</span>
              <span className="a-meta shrink-0">Uploading…</span>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div
          className="a-alert a-alert--danger flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4"
          role="alert"
        >
          <p className="font-bold text-white">
            {confirmDelete === 'single'
              ? 'Delete this file?'
              : `Delete ${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''}?`
            }
          </p>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={cancelDelete}
              disabled={deleting}
              className="a-btn a-btn--ghost a-btn--sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDelete === 'single' ? executeDeleteFile(fileToDelete) : executeBulkDelete()}
              disabled={deleting}
              className="a-btn a-btn--danger-solid a-btn--sm"
            >
              {deleting ? (
                <>
                  <span className="a-spinner a-spinner--sm border-white/30 border-t-white" aria-hidden />
                  Deleting…
                </>
              ) : (
                <>
                  <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                  Delete
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-3">
            <p className="a-meta">
              {selectMode
                ? (selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select the files to delete')
                : `${files.length} file${files.length !== 1 ? 's' : ''} · Drag to reorder`
              }
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {savingOrder && (
                <span className="a-meta inline-flex items-center gap-1.5" role="status">
                  <span className="a-spinner a-spinner--sm" aria-hidden />
                  Saving order…
                </span>
              )}
              <button
                type="button"
                onClick={toggleSelectMode}
                className="a-btn a-btn--secondary a-btn--sm"
              >
                {selectMode ? 'Cancel' : 'Select'}
              </button>
              {selectMode && (
                <>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="a-btn a-btn--ghost a-btn--sm"
                  >
                    {selectedIds.size === files.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <button
                    type="button"
                    onClick={requestBulkDelete}
                    disabled={selectedIds.size === 0 || deleting}
                    className="a-btn a-btn--danger a-btn--sm"
                  >
                    <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                    Delete ({selectedIds.size})
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
        a-inset group relative aspect-square overflow-hidden transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--a-accent)]
        ${isDragging || isSelected ? 'border-section-quests' : ''}
        ${!selectMode ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      {selectMode && (
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select file ${index + 1}`}
          onClick={handleSelectClick}
          className={`
            absolute top-1.5 left-1.5 z-30 w-6 h-6 rounded-md grid place-items-center border-2 transition-colors
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--a-accent)]
            ${isSelected
              ? 'bg-section-quests border-section-quests text-[var(--a-on-accent)]'
              : 'bg-black/60 border-white/50 text-transparent'}
          `}
        >
          <CheckIcon className="w-4 h-4" />
        </button>
      )}

      {/* Visual only: the whole tile is the drag handle */}
      {!selectMode && (
        <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded-full grid place-items-center bg-black/60 text-white/80 pointer-events-none" aria-hidden>
          <Bars3Icon className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="absolute top-1.5 right-1.5 z-10 min-w-6 h-6 px-1.5 rounded-full grid place-items-center bg-black/60 pointer-events-none">
        <span className="a-num text-[0.6875rem] font-bold text-white">{index + 1}</span>
      </div>

      {isVideo ? (
        <div className="w-full h-full grid place-items-center pointer-events-none">
          <VideoCameraIcon className="w-8 h-8 text-white/30" aria-hidden />
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

      {/* Always visible on touch screens (no hover to reveal it). The tile is
          the keyboard drag activator, so keydown must not bubble up to it. */}
      {!selectMode && !isDragging && (
        <button
          type="button"
          onClick={handleDeleteClick}
          onKeyDown={(e) => e.stopPropagation()}
          className="
            a-icon-btn a-icon-btn--sm a-icon-btn--danger absolute bottom-1.5 left-1/2 -translate-x-1/2 z-30
            bg-black/70 transition-opacity
            [@media(hover:hover)]:opacity-0 group-hover:opacity-100! focus-visible:opacity-100!
          "
          aria-label={`Delete file ${index + 1}`}
          title="Delete"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      )}

      {selectMode && (
        <div
          onClick={handleSelectClick}
          className="absolute inset-0 z-20 cursor-pointer"
          aria-hidden
        />
      )}

      <div className="absolute bottom-1.5 right-1.5 z-10 w-6 h-6 rounded-full grid place-items-center bg-black/60 text-white/70 pointer-events-none" aria-hidden>
        {isVideo ? (
          <VideoCameraIcon className="w-3.5 h-3.5" />
        ) : (
          <PhotoIcon className="w-3.5 h-3.5" />
        )}
      </div>
    </div>
  )
}
