/**
 * BlogList — Standalone blog post management list for the admin CMS
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
    PlusIcon,
    TrashIcon,
    PhotoIcon,
    StarIcon,
    DocumentTextIcon,
} from '@heroicons/react/24/solid'

// a-icon-btn mide 40px; en móvil el dedo necesita 44px.
const ICON_BTN = 'a-icon-btn w-11 h-11 sm:w-10 sm:h-10'
const MAX_TAGS = 3

// blog.php responde con códigos; al usuario se le dice qué pasó.
const API_ERRORS = {
    unauthorized: 'Tu sesión se cerró. Vuelve a iniciar sesión.',
    not_found: 'Esa entrada ya no existe. Recarga la lista.',
}

const RULES = [
    'Solo las entradas publicadas se ven en el sitio. Los borradores solo aparecen aquí.',
    'Solo puede haber una entrada destacada: si está publicada, sale arriba de todas en Memorias. Si destacas otra, la anterior deja de serlo.',
    'Eliminar una entrada también borra del servidor su portada y las imágenes de “Imágenes y videos”. No se puede deshacer.',
]

// MySQL entrega "YYYY-MM-DD HH:MM:SS"; Safari no parsea el espacio.
function formatDate(value) {
    if (!value) return null
    const d = new Date(String(value).replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function BlogList({ onNewBlog, onEditBlog }) {
    const [posts, setPosts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [deleting, setDeleting] = useState(null)

    const fetchPosts = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/blog.php?admin=1', { credentials: 'include' })
            const data = await res.json()

            if (data.ok) {
                setPosts(data.posts || [])
            } else {
                setError(API_ERRORS[data.error] || 'No se pudieron cargar las entradas. Intenta de nuevo.')
            }
        } catch {
            setError('No hay conexión con el servidor. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPosts()
    }, [fetchPosts])

    const handleDelete = async (post) => {
        if (!confirm(`¿Eliminar “${post.title}”? También se borran su portada y sus imágenes del servidor. No se puede deshacer.`)) return

        setDeleting(post.id)
        try {
            const res = await fetch(`/api/blog.php?id=${post.id}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            const data = await res.json()

            if (data.ok) {
                setPosts((prev) => prev.filter((p) => p.id !== post.id))
            } else {
                alert(API_ERRORS[data.error] || 'No se pudo eliminar la entrada. Intenta de nuevo.')
            }
        } catch {
            alert('No hay conexión con el servidor. Intenta de nuevo.')
        } finally {
            setDeleting(null)
        }
    }

    const handleToggleFeatured = async (post) => {
        try {
            const res = await fetch('/api/blog.php', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: post.id, featured: !post.featured }),
            })
            const data = await res.json()

            if (data.ok) {
                // Re-fetch to get updated featured states across all posts
                fetchPosts()
            }
        } catch {
            console.error('Toggle featured failed')
        }
    }

    return (
        <div className="w-full">
            <header className="a-page-head">
                <div className="min-w-0">
                    <h1 className="a-title">Memorias</h1>
                    <p className="a-subtitle">Escribe, publica y elige qué entrada va destacada en Memorias.</p>
                </div>
                <div className="a-page-head__actions">
                    <button type="button" onClick={onNewBlog} className="a-btn a-btn--primary">
                        <PlusIcon className="w-4 h-4" aria-hidden />
                        Nueva entrada
                    </button>
                </div>
            </header>

            <section className="a-section" aria-label="Entradas">
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="a-spinner" role="status" aria-label="Cargando entradas" />
                    </div>
                )}

                {error && !loading && (
                    <div className="a-alert a-alert--danger flex-wrap items-center gap-3 p-4" role="alert">
                        <span className="flex-1 min-w-0 break-words">{error}</span>
                        <button type="button" onClick={fetchPosts} className="a-btn a-btn--secondary a-btn--sm min-h-11 sm:min-h-0">
                            Reintentar
                        </button>
                    </div>
                )}

                {!loading && !error && posts.length === 0 && (
                    <div className="a-empty flex flex-col items-center gap-4 px-6">
                        <DocumentTextIcon className="w-8 h-8 text-white/25" aria-hidden />
                        <p>Todavía no hay entradas.</p>
                        <button type="button" onClick={onNewBlog} className="a-btn a-btn--primary">
                            <PlusIcon className="w-4 h-4" aria-hidden />
                            Escribir la primera entrada
                        </button>
                    </div>
                )}

                {!loading && !error && posts.length > 0 && (
                    <div className="a-item-grid">
                        {posts.map((post) => {
                            const date = formatDate(post.created_at)
                            const tags = post.tags || []
                            const extraTags = tags.length - MAX_TAGS
                            const cover = post.cover_image
                                ? (post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`)
                                : null

                            return (
                                // Toda la tarjeta abre el editor con el mouse; con teclado
                                // se llega por el botón Editar (sin controles anidados en un role=button).
                                <article
                                    key={post.id}
                                    onClick={() => onEditBlog(post.id)}
                                    className={`a-item a-item--interactive ${post.published ? '' : 'a-item--muted'}`}
                                >
                                    <div className="a-item__head">
                                        <div className="min-w-0">
                                            <h2 className="a-item__title">{post.title || 'Sin título'}</h2>
                                            <p className="a-item__meta">
                                                <span className="a-num">{date || 'Sin fecha'}</span>
                                                {tags.length > 0 && (
                                                    <span className="min-w-0 break-words">
                                                        {tags.slice(0, MAX_TAGS).join(', ')}
                                                        {extraTags > 0 && ` +${extraTags}`}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="a-item__media a-item__media--cover">
                                        {cover ? (
                                            <img src={cover} alt="" loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="w-full h-full grid place-items-center bg-[var(--a-surface-2)]">
                                                <PhotoIcon className="w-10 h-10 text-white/15" aria-hidden />
                                            </div>
                                        )}
                                    </div>

                                    {post.excerpt && (
                                        <p className="a-item__body line-clamp-2">{post.excerpt}</p>
                                    )}

                                    <div className="a-item__foot flex-wrap">
                                        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                            {post.published ? (
                                                <span className="a-badge a-badge--success">Publicada</span>
                                            ) : (
                                                <span className="a-badge">Borrador</span>
                                            )}
                                            {post.featured && (
                                                <span className="a-badge a-badge--gold">
                                                    <StarIcon className="w-3 h-3" aria-hidden />
                                                    Destacada
                                                </span>
                                            )}
                                        </div>
                                        {/* Íconos primero; la acción principal va al final, a la derecha.
                                            Eliminar queda en la orilla opuesta a Editar. */}
                                        <div className="a-item__actions ml-auto">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(post) }}
                                                disabled={deleting === post.id}
                                                className={`${ICON_BTN} a-icon-btn--danger`}
                                                aria-label={deleting === post.id ? 'Eliminando entrada' : 'Eliminar entrada'}
                                                title="Eliminar"
                                            >
                                                {deleting === post.id ? (
                                                    <span className="a-spinner a-spinner--sm inline-block" aria-hidden />
                                                ) : (
                                                    <TrashIcon className="w-4 h-4" aria-hidden />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleToggleFeatured(post) }}
                                                className={`${ICON_BTN} ${post.featured ? 'text-yellow-400' : ''}`}
                                                aria-pressed={!!post.featured}
                                                aria-label="Destacar en Memorias"
                                                title={post.featured ? 'Quitar de destacada' : 'Destacar'}
                                            >
                                                <StarIcon className="w-4 h-4" aria-hidden />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onEditBlog(post.id) }}
                                                className="a-btn a-btn--primary a-btn--sm h-11 sm:h-10"
                                            >
                                                Editar
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Ayuda donde surge la duda (heurística 10): la estrella y el bote
                de basura tienen efectos que no se ven desde la tarjeta. */}
            {!loading && !error && posts.length > 0 && (
                <section className="a-section" aria-labelledby="blog-rules-title">
                    <h2 id="blog-rules-title" className="a-section-title">Reglas</h2>
                    <ul className="a-rules mt-4 max-w-3xl">
                        {RULES.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                </section>
            )}
        </div>
    )
}
