/**
 * Main dashboard - Project grid with drag & drop reordering
 * Terminal CRT theme
 */

import React, { useState, useEffect, useCallback } from 'react'
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
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  Bars3Icon,
} from '@heroicons/react/24/solid'

export default function AdminDashboard({ onNewProject, onEditProject, onEditAbout }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Very responsive drag - 3px movement to start
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/projects.php', { credentials: 'include' })
      const data = await res.json()

      if (data.ok) {
        // Sort by display_order
        const sorted = (data.projects || []).sort((a, b) => a.display_order - b.display_order)
        setProjects(sorted)
      } else {
        setError(data.error || 'Error al cargar proyectos')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Save new order to server
  const saveNewOrder = async (newProjects) => {
    setSavingOrder(true)

    try {
      const orders = newProjects.map((p, index) => ({
        id: p.id,
        display_order: index + 1,
      }))

      const res = await fetch('/api/projects.php?action=reorder', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      })

      const data = await res.json()
      if (!data.ok) {
        console.error('Error al guardar orden:', data.error)
      }
    } catch (err) {
      console.error('Error al guardar orden:', err)
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setProjects((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Save to server
        saveNewOrder(newItems)

        return newItems
      })
    }
  }

  const handleDelete = async (project) => {
    if (!confirm(`¿Eliminar "${project.title}"? Esta acción no se puede deshacer.`)) {
      return
    }

    setDeleting(project.id)

    try {
      const res = await fetch(`/api/projects.php?id=${project.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (data.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== project.id))
      } else {
        alert(data.error || 'Error al eliminar')
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setDeleting(null)
    }
  }

  const handleToggleActive = async (project) => {
    try {
      const res = await fetch(`/api/projects.php?id=${project.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !project.is_active }),
      })
      const data = await res.json()

      if (data.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, is_active: !p.is_active } : p
          )
        )
      }
    } catch (err) {
      console.error('Toggle active failed:', err)
    }
  }


  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="admin-section-title text-lg">
            projects
          </h1>
          <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
            // drag to reorder {savingOrder && <span className="text-blue-400">• saving_order...</span>}
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="
            inline-flex items-center gap-2 px-5 py-2.5 rounded
            text-sm font-bold uppercase tracking-wider
            active:scale-[0.98] transition-all
          "
          style={{
            backgroundColor: '#3b82f6',
            color: '#000',
            border: '1px solid #60a5fa',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
          }}
        >
          <PlusIcon className="w-4 h-4" />
          <span>&gt; new_project</span>
        </button>
      </div>


      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; fetching_projects...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4 text-sm admin-terminal-font">
            <span className="opacity-60">&gt; </span>ERROR: {error}
          </p>
          <button
            onClick={fetchProjects}
            className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors"
          >
            &gt; retry()
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-20">
          <PhotoIcon className="w-16 h-16 text-blue-500/15 mx-auto mb-4" />
          <p className="text-blue-500/40 mb-4 text-sm admin-terminal-font">
            // No projects found in database
          </p>
          <button
            onClick={onNewProject}
            className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors"
          >
            &gt; create_first_project()
          </button>
        </div>
      )}

      {/* Projects grid with drag & drop */}
      {!loading && !error && projects.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project, index) => (
                <SortableProjectCard
                  key={project.id}
                  project={project}
                  index={index}
                  onEdit={() => onEditProject(project.id)}
                  onDelete={() => handleDelete(project)}
                  onToggleActive={() => handleToggleActive(project)}
                  isDeleting={deleting === project.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableProjectCard({ project, index, onEdit, onDelete, onToggleActive, isDeleting }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.95 : 1,
  }

  const coverUrl = project.cover_image
    ? (project.cover_image.startsWith('http')
      ? project.cover_image
      : `/${project.cover_image}`)
    : null

  // Stop propagation to prevent drag when clicking buttons
  const handleButtonClick = (e, callback) => {
    e.stopPropagation()
    e.preventDefault()
    callback()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative rounded overflow-hidden
        cursor-grab active:cursor-grabbing
        ${!project.is_active ? 'opacity-60' : ''}
        ${isDragging ? 'scale-[1.02]' : ''}
        transition-shadow
      `}
    >
      {/* Terminal card border */}
      <div
        className="absolute inset-0 rounded pointer-events-none z-[1]"
        style={{
          border: isDragging
            ? '1px solid rgba(59, 130, 246, 0.6)'
            : '1px solid rgba(59, 130, 246, 0.15)',
          boxShadow: isDragging
            ? '0 0 25px rgba(59, 130, 246, 0.3), inset 0 0 25px rgba(59, 130, 246, 0.05)'
            : 'inset 0 0 20px rgba(59, 130, 246, 0.03)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      />

      {/* Drag indicator - visual only */}
      <div
        className="absolute top-2 right-2 z-10 p-1.5 rounded pointer-events-none opacity-60"
        style={{ backgroundColor: 'rgba(0, 10, 30, 0.7)' }}
      >
        <Bars3Icon className="w-4 h-4 text-blue-400/60" />
      </div>

      {/* Cover image */}
      <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'rgba(0, 10, 30, 0.6)' }}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={project.title}
            className="w-full h-full object-cover pointer-events-none select-none"
            loading="lazy"
            draggable="false"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <PhotoIcon className="w-12 h-12 text-blue-500/15" />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2 pointer-events-none">
          <span
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase"
            style={{
              backgroundColor: project.project_type === 'link'
                ? 'rgba(59, 130, 246, 0.7)'
                : 'rgba(96, 165, 250, 0.5)',
              color: '#000',
              fontFamily: '"Cascadia Code", monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.05em',
            }}
          >
            {project.project_type === 'link' ? (
              <>
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                LINK
              </>
            ) : (
              <>
                <PhotoIcon className="w-3 h-3" />
                GALLERY
              </>
            )}
          </span>
        </div>

        {/* Active/Inactive badge */}
        {!project.is_active && (
          <div className="absolute bottom-2 left-2 pointer-events-none">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold uppercase"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.6)',
                color: '#000',
                fontFamily: '"Cascadia Code", monospace',
                fontSize: '0.65rem',
              }}
            >
              <EyeSlashIcon className="w-3 h-3" />
              HIDDEN
            </span>
          </div>
        )}
      </div>

      {/* Info - not draggable area for text selection */}
      <div
        className="p-3"
        style={{ backgroundColor: 'rgba(0, 10, 20, 0.5)' }}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="text-blue-300 truncate text-sm flex-1"
            style={{ fontFamily: '"Cascadia Code", monospace' }}
          >
            {project.title}
          </h3>
          {/* Order indicator */}
          <span
            className="text-blue-500/30 text-xs font-bold shrink-0"
            style={{ fontFamily: '"Cascadia Code", monospace' }}
          >
            #{index + 1}
          </span>
        </div>
        <p className="text-blue-500/40 text-xs line-clamp-1 mb-3" style={{ fontFamily: '"Cascadia Code", monospace' }}>
          {project.description_en || project.description_es || '// No description'}
        </p>

        {/* External URL */}
        {project.external_url && (
          <a
            href={project.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 text-xs mb-3 hover:text-blue-300 transition-colors"
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: '"Cascadia Code", monospace' }}
          >
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            {new URL(project.external_url).hostname}
          </a>
        )}

        {/* Action buttons - always visible toolbar */}
        {!isDragging && (
          <div
            className="flex items-center gap-1.5 pt-2"
            style={{ borderTop: '1px solid rgba(59, 130, 246, 0.1)' }}
          >
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => handleButtonClick(e, onEdit)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex-1 justify-center"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                fontFamily: '"Cascadia Code", monospace',
              }}
              title="Editar"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">edit</span>
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => handleButtonClick(e, onToggleActive)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer flex-1 justify-center"
              style={{
                backgroundColor: project.is_active
                  ? 'rgba(234, 179, 8, 0.08)'
                  : 'rgba(34, 197, 94, 0.08)',
                border: project.is_active
                  ? '1px solid rgba(234, 179, 8, 0.2)'
                  : '1px solid rgba(34, 197, 94, 0.2)',
                color: project.is_active ? '#eab308' : '#22c55e',
                fontFamily: '"Cascadia Code", monospace',
              }}
              title={project.is_active ? 'Ocultar' : 'Mostrar'}
            >
              {project.is_active ? (
                <>
                  <EyeSlashIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">hide</span>
                </>
              ) : (
                <>
                  <EyeIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">show</span>
                </>
              )}
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => handleButtonClick(e, onDelete)}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors disabled:opacity-50 cursor-pointer justify-center"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontFamily: '"Cascadia Code", monospace',
              }}
              title="Eliminar"
            >
              {isDeleting ? (
                <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <TrashIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
