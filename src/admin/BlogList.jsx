/**
 * BlogList — Standalone blog post management list for the admin CMS
 * Terminal CRT theme
 */

import React, { useState, useEffect, useCallback } from 'react'
import {
    PlusIcon,
    TrashIcon,
    PhotoIcon,
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
                setError(data.error || 'Error loading blog posts')
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
        if (!confirm(`¿Eliminar "${post.title}"? Esta acción no se puede deshacer.`)) return

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
                alert(data.error || 'Error al eliminar')
            }
        } catch {
            alert('Error de conexión')
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
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="admin-section-title text-lg">blog_posts</h1>
                    <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
            // create, edit, feature, and publish blog posts
                    </p>
                </div>
                <button
                    onClick={onNewBlog}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-bold uppercase tracking-wider active:scale-[0.98] transition-all"
                    style={{
                        backgroundColor: '#3b82f6',
                        color: '#000',
                        border: '1px solid #60a5fa',
                        boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
                    }}
                >
                    <PlusIcon className="w-4 h-4" />
                    <span>&gt; new_post</span>
                </button>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; fetching_posts...</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4 text-sm admin-terminal-font">
                        <span className="opacity-60">&gt; </span>ERROR: {error}
                    </p>
                    <button onClick={fetchPosts} className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors">
                        &gt; retry()
                    </button>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && posts.length === 0 && (
                <div className="text-center py-20">
                    <p className="text-blue-500/40 mb-4 text-sm admin-terminal-font">
            // No blog posts yet
                    </p>
                    <button onClick={onNewBlog} className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors">
                        &gt; create_first_post()
                    </button>
                </div>
            )}

            {/* Post card grid */}
            {!loading && !error && posts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            className="admin-card rounded-xl overflow-hidden group transition-all hover:scale-[1.01]"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onEditBlog(post.id)}
                        >
                            {/* Cover image */}
                            <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'rgba(0,10,30,0.6)' }}>
                                {post.cover_image ? (
                                    <img
                                        src={post.cover_image.startsWith('http') ? post.cover_image : `/${post.cover_image}`}
                                        alt=""
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <PhotoIcon className="w-12 h-12 text-blue-500/10" />
                                    </div>
                                )}
                                {/* Status badges overlay */}
                                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                    {post.featured && (
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold backdrop-blur-sm" style={{ background: 'rgba(234,179,8,0.25)', border: '1px solid rgba(234,179,8,0.5)', color: '#fbbf24' }}>
                                            ★ featured
                                        </span>
                                    )}
                                    {post.published ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider backdrop-blur-sm" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80' }}>
                                            published
                                        </span>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider backdrop-blur-sm" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
                                            draft
                                        </span>
                                    )}
                                </div>
                                {/* Action buttons overlay */}
                                <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleFeatured(post) }}
                                        className="p-1.5 rounded backdrop-blur-sm transition-colors"
                                        style={{ background: 'rgba(0,0,0,0.5)' }}
                                        title={post.featured ? 'Unfeature' : 'Feature'}
                                    >
                                        <svg className={`w-4 h-4 ${post.featured ? 'text-yellow-400' : 'text-blue-400/60'}`} fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(post) }}
                                        disabled={deleting === post.id}
                                        className="p-1.5 rounded backdrop-blur-sm transition-colors disabled:opacity-50"
                                        style={{ background: 'rgba(0,0,0,0.5)' }}
                                        title="Delete"
                                    >
                                        {deleting === post.id ? (
                                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <TrashIcon className="w-4 h-4 text-red-400" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Card body */}
                            <div className="p-4">
                                <h3 className="text-blue-300 text-sm mb-1 truncate admin-terminal-font">{post.title}</h3>
                                <div className="flex items-center gap-2 text-blue-500/40 text-[11px] admin-terminal-font mb-2">
                                    <span>/{post.slug}</span>
                                    <span>•</span>
                                    <span>{post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}</span>
                                </div>
                                {post.tags?.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {post.tags.map((tag) => (
                                            <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', color: 'rgba(96,165,250,0.6)' }}>
                                                {tag}
                                            </span>
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
