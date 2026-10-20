/**
 * Main dashboard - Project grid with drag & drop reordering
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
        distance: 3,
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
        const sorted = (data.projects || []).sort((a, b) => a.display_order - b.display_order)
        setProjects(sorted)
      } else {
        setError(data.error || "Couldn't load projects")
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

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

        saveNewOrder(newItems)

        return newItems
      })
    }
  }

  const handleDelete = async (project) => {
    if (!confirm(`Delete "${project.title}"? This can't be undone.`)) {
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
        alert(data.error || "Couldn't delete the project")
      }
    } catch (err) {
      alert('Connection error')
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
    <div className="w-full">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="a-title">Projects</h1>
          <p className="a-subtitle flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Drag a card to change the order on the site.</span>
            {savingOrder && (
              <span className="inline-flex items-center gap-1.5 text-white/70" role="status">
                <span className="a-spinner a-spinner--sm" aria-hidden />
                Saving order…
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={onNewProject} className="a-btn a-btn--primary self-start sm:self-auto">
          <PlusIcon className="w-4 h-4" aria-hidden />
          New project
        </button>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Loading projects" />
        </div>
      )}

      {error && !loading && (
        <div className="a-alert a-alert--danger items-center justify-between flex-wrap px-4 py-3" role="alert">
          <span>{error}</span>
          <button type="button" onClick={fetchProjects} className="a-btn a-btn--secondary a-btn--sm">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="a-empty flex flex-col items-center gap-4">
          <PhotoIcon className="w-12 h-12 text-white/20" aria-hidden />
          <p>No projects yet.</p>
          <button type="button" onClick={onNewProject} className="a-btn a-btn--secondary">
            <PlusIcon className="w-4 h-4" aria-hidden />
            Create your first project
          </button>
        </div>
      )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

// Una URL mal capturada no debe tumbar toda la lista de proyectos.
function hostnameOf(url) {
  try { return new URL(url).hostname } catch { return url }
}

// Las descripciones se guardan como HTML (TipTap); en el extracto va solo el texto.
function plainText(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
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
    transition: `${transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)'}, border-color 160ms linear`,
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

  // The whole card is the keyboard drag activator, so Enter/Space on a
  // toolbar button would start a drag instead of clicking it.
  const stopKeyDrag = (e) => e.stopPropagation()

  const isLink = project.project_type === 'link'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${project.title}, position ${index + 1}`}
      className={`
        a-card a-card--interactive relative flex flex-col overflow-hidden
        cursor-grab active:cursor-grabbing
        ${isDragging ? 'scale-[1.02] border-section-quests' : ''}
      `}
    >
      <div className="aspect-video relative overflow-hidden bg-[var(--a-surface-2)] border-b-2 border-white/10">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className={`w-full h-full object-cover pointer-events-none select-none ${!project.is_active ? 'opacity-40' : ''}`}
            loading="lazy"
            draggable="false"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <PhotoIcon className="w-10 h-10 text-white/15" aria-hidden />
          </div>
        )}

        <div className="absolute top-2 right-2 w-7 h-7 rounded-full grid place-items-center bg-black/60 text-white/80 pointer-events-none" aria-hidden>
          <Bars3Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h3 className="flex-1 min-w-0 truncate font-bold text-[0.9375rem] leading-snug text-white">
              {project.title}
            </h3>
            <span className="a-meta shrink-0 pt-0.5">#{index + 1}</span>
          </div>
          <p className={`mt-1 text-sm line-clamp-1 ${project.description_en || project.description_es ? 'text-white/45' : 'text-white/30 italic'}`}>
            {plainText(project.description_en || project.description_es) || 'No description'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="a-badge">
            {isLink
              ? <ArrowTopRightOnSquareIcon className="w-3 h-3" aria-hidden />
              : <PhotoIcon className="w-3 h-3" aria-hidden />}
            {isLink ? 'External link' : 'Gallery'}
          </span>
          {!project.is_active && (
            <span className="a-badge a-badge--warning">
              <EyeSlashIcon className="w-3 h-3" aria-hidden />
              Hidden
            </span>
          )}
        </div>

        {project.external_url && (
          <a
            href={project.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start max-w-full text-xs text-white/60 hover:text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={stopKeyDrag}
          >
            <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" aria-hidden />
            <span className="truncate">{hostnameOf(project.external_url)}</span>
          </a>
        )}

        {!isDragging && (
          <div className="mt-auto flex items-center gap-2 pt-3 border-t-2 border-white/10">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={stopKeyDrag}
              onClick={(e) => handleButtonClick(e, onEdit)}
              className="a-btn a-btn--secondary a-btn--sm flex-1"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={stopKeyDrag}
              onClick={(e) => handleButtonClick(e, onToggleActive)}
              className="a-icon-btn a-icon-btn--sm"
              aria-label={project.is_active ? 'Hide from site' : 'Show on site'}
              title={project.is_active ? 'Hide from site' : 'Show on site'}
            >
              {project.is_active
                ? <EyeSlashIcon className="w-4 h-4" />
                : <EyeIcon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={stopKeyDrag}
              onClick={(e) => handleButtonClick(e, onDelete)}
              disabled={isDeleting}
              className="a-icon-btn a-icon-btn--sm a-icon-btn--danger disabled:opacity-50"
              aria-label="Delete project"
              title="Delete project"
            >
              {isDeleting ? (
                <span className="a-spinner a-spinner--sm" role="status" aria-label="Deleting" />
              ) : (
                <TrashIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
