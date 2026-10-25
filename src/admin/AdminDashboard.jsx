/**
 * Main dashboard - Project grid with drag & drop reordering
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
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
  TrashIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
  EyeIcon,
  EyeSlashIcon,
  Bars3Icon,
} from '@heroicons/react/24/solid'

// El servidor responde con códigos (`not_found`, `unauthorized`); aquí se
// vuelven frases. Lo que no está mapeado cae en el mensaje de cada acción.
const SERVER_ERRORS = {
  unauthorized: 'Tu sesión se cerró. Vuelve a iniciar sesión.',
  not_found: 'Ese proyecto ya no existe. Recarga la página.',
}
const serverError = (code, fallback) => SERVER_ERRORS[code] || fallback

// dnd-kit trae sus instrucciones y avisos para lector de pantalla en inglés.
const SR_INSTRUCTIONS = {
  draggable:
    'Para mover un proyecto, presiona la barra espaciadora. Cámbialo de lugar con las flechas y presiona la barra otra vez para soltarlo, o Escape para cancelar.',
}

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
        setError(serverError(data.error, 'No se pudieron cargar los proyectos.'))
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor. Revisa tu conexión.')
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
    if (!confirm(`¿Eliminar “${project.title}”? Se borra con todos sus archivos y no se puede deshacer.`)) {
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
        alert(serverError(data.error, 'No se pudo eliminar el proyecto. Intenta de nuevo.'))
      }
    } catch (err) {
      alert('No se pudo conectar con el servidor. Intenta de nuevo.')
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

  // Avisos en español para lector de pantalla (los de dnd-kit dicen el id
  // numérico en inglés). Se arman con el nombre y la posición.
  const announcements = useMemo(() => {
    const total = projects.length
    const nameOf = (id) => projects.find((p) => p.id === id)?.title || 'El proyecto'
    const posOf = (id) => projects.findIndex((p) => p.id === id) + 1
    return {
      onDragStart: ({ active }) => `Tomaste “${nameOf(active.id)}”, posición ${posOf(active.id)} de ${total}.`,
      onDragOver: ({ active, over }) => (over
        ? `“${nameOf(active.id)}” va en la posición ${posOf(over.id)} de ${total}.`
        : `“${nameOf(active.id)}” está fuera de la lista.`),
      onDragEnd: ({ active, over }) => (over
        ? `Soltaste “${nameOf(active.id)}” en la posición ${posOf(over.id)} de ${total}.`
        : `Soltaste “${nameOf(active.id)}”.`),
      onDragCancel: ({ active }) => `Cancelaste el movimiento. “${nameOf(active.id)}” se queda en la posición ${posOf(active.id)}.`,
    }
  }, [projects])

  return (
    <div className="w-full">
      <header className="a-page-head">
        <div className="min-w-0">
          <h1 className="a-title">Proyectos</h1>
          <p className="a-subtitle">
            Los proyectos de la sección Trabajo: arrastra una tarjeta para cambiar su orden en el sitio.
          </p>
        </div>
        <div className="a-page-head__actions">
          {savingOrder && (
            <span className="a-meta inline-flex items-center gap-2" role="status">
              <span className="a-spinner a-spinner--sm" aria-hidden />
              Guardando orden…
            </span>
          )}
          <button type="button" onClick={onNewProject} className="a-btn a-btn--primary max-sm:min-h-11">
            <PlusIcon className="w-4 h-4" aria-hidden />
            Nuevo proyecto
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="a-spinner" role="status" aria-label="Cargando proyectos" />
        </div>
      )}

      {error && !loading && (
        <div className="a-alert a-alert--danger items-center justify-between flex-wrap gap-3 px-4 py-3" role="alert">
          <span>{error}</span>
          <button type="button" onClick={fetchProjects} className="a-btn a-btn--primary a-btn--sm max-sm:min-h-11">
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="a-empty flex flex-col items-center gap-4">
          <PhotoIcon className="w-12 h-12 text-white/20" aria-hidden />
          <p>Todavía no hay proyectos. El primero que publiques aparece en la sección Trabajo del sitio.</p>
          <button type="button" onClick={onNewProject} className="a-btn a-btn--primary max-sm:min-h-11">
            <PlusIcon className="w-4 h-4" aria-hidden />
            Nuevo proyecto
          </button>
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements, screenReaderInstructions: SR_INSTRUCTIONS }}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="a-item-grid">
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
  } = useSortable({ id: project.id, attributes: { roleDescription: 'proyecto que se puede mover' } })

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
  const excerpt = plainText(project.description_en || project.description_es)
  // La galería vive en /work/{slug} del sitio. Un enlace externo se muestra
  // solo en proyectos de ese tipo: en una galería es un dato viejo que el
  // sitio ya no usa (queda guardado si cambiaste el tipo).
  const workPath = project.slug ? `/work/${project.slug}` : null
  // Etiqueta corta y fija: una URL completa no cabe junto a las acciones y
  // se cortaba a media palabra. La dirección completa queda en el title.
  const footLink = isLink
    ? (project.external_url ? { href: project.external_url, label: 'Abrir enlace', title: hostnameOf(project.external_url) } : null)
    : (workPath ? { href: `${import.meta.env.BASE_URL || '/'}work/${project.slug}`, label: 'Ver en el sitio', title: workPath } : null)

  const tap = 'max-sm:w-11 max-sm:h-11'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${project.title}, posición ${index + 1}`}
      className={`
        a-item a-item--interactive relative
        cursor-grab active:cursor-grabbing
        ${!project.is_active ? 'a-item--muted' : ''}
        ${isDragging ? 'scale-[1.02] border-section-quests' : ''}
      `}
    >
      <div className="a-item__head">
        <div className="min-w-0">
          <h3 className="a-item__title">{project.title}</h3>
          <p className="a-item__meta">
            <span className="inline-flex items-center gap-1.5">
              {isLink
                ? <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" aria-hidden />
                : <PhotoIcon className="w-3.5 h-3.5" aria-hidden />}
              {isLink ? 'Enlace externo' : 'Galería'}
            </span>
            <span className="a-num">#{index + 1}</span>
          </p>
        </div>
        {/* Solo visual: toda la tarjeta es la agarradera. */}
        <Bars3Icon className="w-5 h-5 shrink-0 mt-0.5 text-white/40" aria-hidden />
      </div>

      <div className={`a-item__media ${coverUrl ? 'a-item__media--cover' : ''}`}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="pointer-events-none select-none"
            loading="lazy"
            draggable="false"
          />
        ) : (
          <div className="w-full h-full grid place-items-center pointer-events-none">
            <PhotoIcon className="w-10 h-10 text-white/15" aria-hidden />
          </div>
        )}
      </div>

      <p className={`a-item__body line-clamp-1 ${excerpt ? '' : 'text-white/30 italic'}`}>
        {excerpt || 'Sin descripción'}
      </p>

      <div className="a-item__foot">
        <div className="min-w-0">
          {!project.is_active ? (
            <span className="a-badge a-badge--warning">Oculto</span>
          ) : footLink ? (
            <a
              href={footLink.href}
              target="_blank"
              rel="noopener noreferrer"
              title={footLink.title}
              className="inline-flex items-center gap-1.5 max-w-full py-2 text-xs text-white/60 hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={stopKeyDrag}
            >
              <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" aria-hidden />
              <span className="truncate">{footLink.label}</span>
            </a>
          ) : null}
        </div>

        {/* Mientras se arrastra no se puede hacer clic: se esconden sin
            quitarles su lugar para que la tarjeta no cambie de alto. */}
        <div className={`a-item__actions ${isDragging ? 'invisible' : ''}`}>
          {/* Orden fijo: eliminar lo más lejos de la acción principal, y
              Editar al final (a la derecha), igual que en el resto del CMS. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={stopKeyDrag}
            onClick={(e) => handleButtonClick(e, onDelete)}
            disabled={isDeleting}
            className={`a-icon-btn a-icon-btn--sm a-icon-btn--danger ${tap}`}
            aria-label="Eliminar proyecto"
            title="Eliminar proyecto"
          >
            {isDeleting ? (
              <span className="a-spinner a-spinner--sm" role="status" aria-label="Eliminando" />
            ) : (
              <TrashIcon className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={stopKeyDrag}
            onClick={(e) => handleButtonClick(e, onToggleActive)}
            className={`a-icon-btn a-icon-btn--sm ${tap}`}
            aria-label={project.is_active ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
            title={project.is_active ? 'Ocultar del sitio' : 'Mostrar en el sitio'}
          >
            {project.is_active
              ? <EyeSlashIcon className="w-4 h-4" />
              : <EyeIcon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={stopKeyDrag}
            onClick={(e) => handleButtonClick(e, onEdit)}
            className="a-btn a-btn--primary a-btn--sm max-sm:min-h-11"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  )
}
