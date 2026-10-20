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
                setError(data.error || 'Could not load the posts')
            }
        } catch {
            setError('Connection error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPosts()
    }, [fetchPosts])

    const handleDelete = async (post) => {
        if (!confirm(`Delete "${post.title}"? This can't be undone.`)) return

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
                alert(data.error || 'Could not delete the post')
            }
        } catch {
            alert('Connection error')
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
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
                <div className="min-w-0">
                    <h1 className="a-title">Blog</h1>
                    <p className="a-subtitle">Create, edit, feature and publish posts.</p>
                </div>
                <button
                    type="button"
                    onClick={onNewBlog}
                    className="a-btn a-btn--primary self-start sm:self-auto"
                >
                    <PlusIcon className="w-4 h-4" aria-hidden />
                    New post
                </button>
            </header>

            {loading && (
                <div className="flex items-center justify-center py-24">
                    <div className="a-spinner" role="status" aria-label="Loading posts" />
                </div>
            )}

            {error && !loading && (
                <div className="a-alert a-alert--danger flex-wrap items-center gap-3 p-4" role="alert">
                    <span className="flex-1 min-w-0 break-words">{error}</span>
                    <button type="button" onClick={fetchPosts} className="a-btn a-btn--secondary a-btn--sm">
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && posts.length === 0 && (
                <div className="a-empty flex flex-col items-center gap-4">
                    <DocumentTextIcon className="w-8 h-8 text-white/25" aria-hidden />
                    <p>No posts yet.</p>
                    <button type="button" onClick={onNewBlog} className="a-btn a-btn--primary">
                        <PlusIcon className="w-4 h-4" aria-hidden />
                        Write the first post
                    </button>
                </div>
            )}

            {!loading && !error && posts.length > 0 && (
                <div className="grid gap-4 sm:gap-5 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onEditBlog(post.id)}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                                    e.preventDefault()
                                    onEditBlog(post.id)
                                }
                            }}
                            className="a-card a-card--interactive overflow-hidden flex flex-col"
                        >
                            <div className="aspect-video bg-[var(--a-surface-2)] border-b-2 border-white/10">
                                {post.cover_image ? (
                                    <img
                                        src={post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`}
                                        alt=""
                                        loading="lazy"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full grid place-items-center">
                                        <PhotoIcon className="w-10 h-10 text-white/15" aria-hidden />
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 flex flex-col p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                                        {post.published ? (
                                            <span className="a-badge a-badge--success">Published</span>
                                        ) : (
                                            <span className="a-badge">Draft</span>
                                        )}
                                        {post.featured && (
                                            <span className="a-badge a-badge--gold">
                                                <StarIcon className="w-3 h-3" aria-hidden />
                                                Featured
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleToggleFeatured(post) }}
                                            className={`a-icon-btn a-icon-btn--sm ${post.featured ? 'text-yellow-400' : ''}`}
                                            aria-pressed={!!post.featured}
                                            aria-label="Featured"
                                            title={post.featured ? 'Unfeature' : 'Feature'}
                                        >
                                            <StarIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(post) }}
                                            disabled={deleting === post.id}
                                            className="a-icon-btn a-icon-btn--sm a-icon-btn--danger disabled:opacity-50"
                                            aria-label="Delete post"
                                            title="Delete"
                                        >
                                            {deleting === post.id ? (
                                                <span className="a-spinner a-spinner--sm inline-block" aria-hidden />
                                            ) : (
                                                <TrashIcon className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <h3 className="mt-3 text-base font-bold leading-snug text-white line-clamp-2 break-words">
                                    {post.title}
                                </h3>
                                <p className="mt-1.5 flex items-center gap-2 min-w-0 text-xs text-white/45">
                                    <span className="a-code text-white/45 truncate">/{post.slug}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="a-meta shrink-0">
                                        {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                                    </span>
                                </p>

                                {post.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {post.tags.map((tag) => (
                                            <span key={tag} className="a-badge">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
