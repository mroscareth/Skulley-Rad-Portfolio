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
  const [creatingDraft, setCreatingDraft] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before starting drag
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

  // Create draft project so images can be uploaded immediately
  const handleCreateDraft = async () => {
    setCreatingDraft(true)
    
    try {
      const res = await fetch('/api/projects.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Nuevo Proyecto',
          project_type: 'gallery',
          is_active: false, // Hidden until completed
        }),
      })
      
      const data = await res.json()
      
      if (data.ok && data.project?.id) {
        // Redirect to the editor with the new ID
        onEditProject(data.project.id)
      } else {
        alert(data.error || 'Error al crear proyecto')
      }
    } catch (err) {
      alert('Error de conexión')
    } finally {
      setCreatingDraft(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 
            className="text-2xl text-white"
            style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
          >
            Proyectos
          </h1>
          <p className="text-white/50 text-sm mt-1" style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Arrastra para reordenar • {savingOrder && <span className="text-cyan-400">Guardando...</span>}
          </p>
        </div>
        <button
          onClick={handleCreateDraft}
          disabled={creatingDraft}
          className="
            inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
            bg-gradient-to-r from-cyan-500 to-purple-500
            text-white font-semibold text-sm
            hover:opacity-90 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all shadow-lg shadow-cyan-500/25
          "
        >
          {creatingDraft ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Creando...</span>
            </>
          ) : (
            <>
              <PlusIcon className="w-5 h-5" />
              <span>Nuevo Proyecto</span>
            </>
          )}
        </button>
      </div>


      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchProjects}
            className="text-cyan-400 hover:underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && projects.length === 0 && (
        <div className="text-center py-20">
          <PhotoIcon className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/50 mb-4">No hay proyectos todavía</p>
          <button
            onClick={onNewProject}
            className="text-cyan-400 hover:underline"
          >
            Crear el primero
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
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  }

  const coverUrl = project.cover_image
    ? (project.cover_image.startsWith('http')
        ? project.cover_image
        : `/${project.cover_image}`)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-xl overflow-hidden
        bg-white/5 border border-white/10
        transition-all hover:border-white/20
        ${!project.is_active ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-2xl shadow-cyan-500/20 scale-105' : ''}
      `}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 z-10 p-2 rounded-lg bg-black/40 backdrop-blur-sm cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Arrastrar para reordenar"
      >
        <Bars3Icon className="w-4 h-4 text-white" />
      </div>

      {/* Cover image */}
      <div className="aspect-video bg-slate-800 relative overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={project.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PhotoIcon className="w-12 h-12 text-white/20" />
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`
              inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
              ${project.project_type === 'link'
                ? 'bg-blue-500/80 text-white'
                : 'bg-purple-500/80 text-white'
              }
            `}
          >
            {project.project_type === 'link' ? (
              <>
                <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                Link
              </>
            ) : (
              <>
                <PhotoIcon className="w-3 h-3" />
                Galería
              </>
            )}
          </span>
        </div>

        {/* Active/Inactive badge */}
        {!project.is_active && (
          <div className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-500/80 text-white">
              <EyeSlashIcon className="w-3 h-3" />
              Oculto
            </span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onEdit}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title="Editar"
          >
            <PencilSquareIcon className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onToggleActive}
            className="p-3 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            title={project.is_active ? 'Ocultar' : 'Mostrar'}
          >
            {project.is_active ? (
              <EyeSlashIcon className="w-5 h-5 text-white" />
            ) : (
              <EyeIcon className="w-5 h-5 text-white" />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-3 rounded-full bg-red-500/50 hover:bg-red-500/70 transition-colors disabled:opacity-50"
            title="Eliminar"
          >
            {isDeleting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <TrashIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 
          className="text-white truncate"
          style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
        >
          {project.title}
        </h3>
        <p className="text-white/50 text-sm mt-1 line-clamp-2">
          {project.description_en || project.description_es || 'Sin descripción'}
        </p>

        {/* External URL */}
        {project.external_url && (
          <a
            href={project.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 text-xs mt-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            {new URL(project.external_url).hostname}
          </a>
        )}
      </div>

      {/* Order indicator */}
      <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
        <span className="text-white/40 text-xs">{index + 1}</span>
      </div>
    </div>
  )
}
