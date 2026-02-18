/**
 * Contact Inbox — M.A.D.R.E. Terminal Mail Client
 *
 * Standalone admin section for viewing, managing, and replying to
 * contact form submissions. Terminal CRT aesthetic.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    EnvelopeIcon,
    EnvelopeOpenIcon,
    StarIcon,
    TrashIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    FunnelIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'

// ── Utility: format numbers ──
const fmt = (n) => Number(n || 0).toLocaleString()

// ── Utility: relative time ──
const timeAgo = (dateStr) => {
    const now = new Date()
    const then = new Date(dateStr)
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return then.toLocaleDateString()
}

// Subject display map
const subjectLabels = {
    workTogether: '💼 Work Together',
    collaboration: '🤝 Collaboration',
    other: '💬 Other',
}

export default function ContactInbox() {
    const [messages, setMessages] = useState([])
    const [counts, setCounts] = useState({ total: 0, unread: 0, starred: 0, archived: 0 })
    const [filter, setFilter] = useState('all')
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [search, setSearch] = useState('')
    const refreshTimer = useRef(null)

    const fetchMessages = useCallback(async (p = 1, f = filter) => {
        try {
            const res = await fetch(`/api/analytics.php?action=messages&page=${p}&filter=${f}`, {
                credentials: 'include',
            })
            const json = await res.json()
            if (json.ok) {
                setMessages(json.messages || [])
                setCounts(json.counts || { total: 0, unread: 0, starred: 0, archived: 0 })
                setPage(json.page || 1)
                setPages(json.pages || 1)
            }
        } catch (e) {
            console.error('Inbox fetch error:', e)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => {
        setLoading(true)
        setSelected(null)
        fetchMessages(1, filter)
    }, [filter])

    // Auto-refresh every 30s
    useEffect(() => {
        refreshTimer.current = setInterval(() => fetchMessages(page, filter), 30000)
        return () => clearInterval(refreshTimer.current)
    }, [page, filter, fetchMessages])

    const updateMessage = async (id, field, value) => {
        await fetch('/api/analytics.php?action=message_update', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, field, value }),
        })
        setMessages(prev => prev.map(m => m.id === id ? { ...m, [field]: value ? 1 : 0 } : m))
        if (selected?.id === id) setSelected(prev => ({ ...prev, [field]: value ? 1 : 0 }))
        fetchMessages(page, filter)
    }

    const deleteMessage = async (id) => {
        await fetch('/api/analytics.php?action=message_delete', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
        setConfirmDelete(null)
        if (selected?.id === id) setSelected(null)
        fetchMessages(page, filter)
    }

    const selectMessage = (msg) => {
        setSelected(msg)
        if (!parseInt(msg.is_read)) {
            updateMessage(msg.id, 'is_read', 1)
        }
    }

    // Filter messages by search
    const filtered = search
        ? messages.filter(m =>
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase()) ||
            m.message.toLowerCase().includes(search.toLowerCase())
        )
        : messages

    const filterTabs = [
        { id: 'all', label: 'all', count: counts.total - counts.archived, icon: '◉' },
        { id: 'unread', label: 'unread', count: counts.unread, icon: '●' },
        { id: 'starred', label: 'starred', count: counts.starred, icon: '★' },
        { id: 'archived', label: 'archived', count: counts.archived, icon: '▣' },
    ]

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="admin-section-title text-lg flex items-center gap-2">
                        <EnvelopeIcon className="w-5 h-5 text-cyan-400" />
                        M.A.D.R.E. contact_inbox
                    </h1>
                    <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
                        // inbound communications monitor — {counts.total} total · {counts.unread} unread
                    </p>
                </div>

                <button
                    onClick={() => fetchMessages(page, filter)}
                    className="flex items-center gap-1.5 p-1.5 rounded hover:bg-blue-500/10 text-blue-600 hover:text-blue-400 transition-colors"
                    title="Refresh"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                </button>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'total_messages', value: counts.total, color: '#60a5fa' },
                    { label: 'pending_read', value: counts.unread, color: '#22d3ee' },
                    { label: 'starred', value: counts.starred, color: '#facc15' },
                    { label: 'archived', value: counts.archived, color: '#64748b' },
                ].map(kpi => (
                    <div key={kpi.label} className="rounded-lg p-3" style={{
                        background: 'rgba(59,130,246,0.03)',
                        border: '1px solid rgba(59,130,246,0.1)',
                    }}>
                        <div className="text-[10px] admin-terminal-font text-blue-600/30 uppercase tracking-wider mb-1">
                            {kpi.label}
                        </div>
                        <div className="text-lg admin-terminal-font font-bold" style={{ color: kpi.color }}>
                            {fmt(kpi.value)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters + Search bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-1 flex-wrap">
                    {filterTabs.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs admin-terminal-font transition-all ${filter === f.id
                                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                                : 'text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                                }`}
                        >
                            <span className="text-[10px]">{f.icon}</span>
                            {f.label}
                            {f.count > 0 && (
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filter === f.id
                                    ? 'bg-cyan-400/20 text-cyan-300'
                                    : 'bg-blue-500/10 text-blue-500/50'
                                    }`}>
                                    {f.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded flex-1 sm:max-w-xs" style={{
                    background: 'rgba(59,130,246,0.05)',
                    border: '1px solid rgba(59,130,246,0.1)',
                }}>
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-blue-600/30" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="search messages..."
                        className="bg-transparent text-xs admin-terminal-font text-blue-300 placeholder-blue-600/25 outline-none flex-1"
                    />
                </div>
            </div>

            {/* Loading state */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex items-center gap-3 text-xs admin-terminal-font text-blue-400/60">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        scanning_inbox_channels...
                    </div>
                </div>
            ) : (
                /* Main content: List + Detail */
                <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '500px' }}>
                    {/* Message list */}
                    <div className={`${selected ? 'lg:w-2/5' : 'w-full'} transition-all rounded-lg overflow-hidden`} style={{
                        border: '1px solid rgba(59,130,246,0.1)',
                        background: 'rgba(59,130,246,0.02)',
                    }}>
                        {/* List header */}
                        <div className="px-4 py-2 flex items-center justify-between" style={{
                            borderBottom: '1px solid rgba(59,130,246,0.08)',
                            background: 'rgba(59,130,246,0.03)',
                        }}>
                            <span className="text-[10px] admin-terminal-font text-blue-600/30 uppercase tracking-wider">
                                {filter === 'all' ? 'all messages' : filter} ({filtered.length})
                            </span>
                            <FunnelIcon className="w-3 h-3 text-blue-600/20" />
                        </div>

                        {filtered.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="text-blue-600/15 text-xs admin-terminal-font mb-4">
                                    <pre className="inline-block text-left">{`
    ┌─────────────────┐
    │                 │
    │   ◎  no_data    │
    │                 │
    │   ╭──────────╮  │
    │   │ ░░░░░░░░ │  │
    │   │ ░░░░░░░░ │  │
    │   ╰──────────╯  │
    │                 │
    └─────────────────┘`}</pre>
                                </div>
                                <p className="text-blue-600/25 text-xs admin-terminal-font">
                                    // no messages in [{filter}] channel
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y" style={{ borderColor: 'rgba(59,130,246,0.06)' }}>
                                {filtered.map((msg, i) => {
                                    const isUnread = !parseInt(msg.is_read)
                                    const isStarred = parseInt(msg.is_starred)
                                    const isSelected = selected?.id === msg.id

                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => selectMessage(msg)}
                                            className={`cursor-pointer px-4 py-3 transition-all ${isSelected
                                                ? 'bg-cyan-500/8'
                                                : isUnread
                                                    ? 'bg-blue-500/3 hover:bg-blue-500/6'
                                                    : 'hover:bg-blue-500/3'
                                                }`}
                                            style={{
                                                borderLeft: isSelected
                                                    ? '3px solid rgb(34,211,238)'
                                                    : isUnread
                                                        ? '3px solid rgba(34,211,238,0.3)'
                                                        : '3px solid transparent',
                                                animation: `typeIn 200ms ease ${i * 40}ms both`,
                                            }}
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {/* Avatar initial */}
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5" style={{
                                                    background: isUnread ? 'rgba(34,211,238,0.12)' : 'rgba(59,130,246,0.08)',
                                                    border: `1px solid ${isUnread ? 'rgba(34,211,238,0.25)' : 'rgba(59,130,246,0.12)'}`,
                                                    color: isUnread ? 'rgb(34,211,238)' : 'rgba(96,165,250,0.5)',
                                                }}>
                                                    {msg.name.charAt(0).toUpperCase()}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-0.5">
                                                        <span className={`text-xs admin-terminal-font truncate ${isUnread ? 'text-blue-200 font-bold' : 'text-blue-400/60'}`}>
                                                            {msg.name}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {isStarred && <StarIcon className="w-3 h-3 text-yellow-400" />}
                                                            <span className="text-[10px] admin-terminal-font text-blue-600/25">
                                                                {timeAgo(msg.created_at)}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-[11px] admin-terminal-font text-blue-400/40 truncate mb-0.5">
                                                        {subjectLabels[msg.subject] || msg.subject || '(no subject)'}
                                                    </div>

                                                    <div className="text-[10px] admin-terminal-font text-blue-600/25 truncate">
                                                        {msg.message.substring(0, 90)}{msg.message.length > 90 ? '…' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Pagination */}
                        {pages > 1 && (
                            <div className="flex items-center justify-between px-4 py-2" style={{
                                borderTop: '1px solid rgba(59,130,246,0.06)',
                                background: 'rgba(59,130,246,0.02)',
                            }}>
                                <span className="text-[10px] admin-terminal-font text-blue-600/25">
                                    page {page}/{pages}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => { setPage(p => p - 1); fetchMessages(page - 1, filter) }}
                                        disabled={page <= 1}
                                        className="p-1 rounded hover:bg-blue-500/10 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { setPage(p => p + 1); fetchMessages(page + 1, filter) }}
                                        disabled={page >= pages}
                                        className="p-1 rounded hover:bg-blue-500/10 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detail panel */}
                    {selected ? (
                        <div className="lg:w-3/5 rounded-lg overflow-hidden" style={{
                            border: '1px solid rgba(34,211,238,0.12)',
                            background: 'rgba(6, 6, 20, 0.5)',
                            animation: 'typeIn 300ms ease both',
                        }}>
                            {/* Detail header */}
                            <div className="px-4 py-3 flex items-center justify-between" style={{
                                borderBottom: '1px solid rgba(34,211,238,0.08)',
                                background: 'rgba(34,211,238,0.02)',
                            }}>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelected(null)}
                                        className="text-blue-400 hover:text-cyan-400 text-xs admin-terminal-font transition-colors lg:hidden"
                                    >
                                        ← back
                                    </button>
                                    <span className="text-cyan-400/60 text-xs admin-terminal-font">
                                        transmission://{selected.id}
                                    </span>
                                </div>

                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={() => updateMessage(selected.id, 'is_read', parseInt(selected.is_read) ? 0 : 1)}
                                        className="p-1.5 rounded hover:bg-blue-500/10 text-blue-400 hover:text-cyan-400 transition-colors"
                                        title={parseInt(selected.is_read) ? 'Mark unread' : 'Mark read'}
                                    >
                                        {parseInt(selected.is_read)
                                            ? <EnvelopeIcon className="w-4 h-4" />
                                            : <EnvelopeOpenIcon className="w-4 h-4" />
                                        }
                                    </button>
                                    <button
                                        onClick={() => updateMessage(selected.id, 'is_starred', parseInt(selected.is_starred) ? 0 : 1)}
                                        className={`p-1.5 rounded hover:bg-blue-500/10 transition-colors ${parseInt(selected.is_starred) ? 'text-yellow-400' : 'text-blue-400 hover:text-yellow-400'}`}
                                        title={parseInt(selected.is_starred) ? 'Unstar' : 'Star'}
                                    >
                                        <StarIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => updateMessage(selected.id, 'is_archived', parseInt(selected.is_archived) ? 0 : 1)}
                                        className="p-1.5 rounded hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-colors"
                                        title={parseInt(selected.is_archived) ? 'Unarchive' : 'Archive'}
                                    >
                                        <ArchiveBoxIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(selected.id)}
                                        className="p-1.5 rounded hover:bg-red-500/10 text-blue-600/30 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Delete confirmation */}
                            {confirmDelete === selected.id && (
                                <div className="px-4 py-2 flex items-center gap-3" style={{
                                    background: 'rgba(239,68,68,0.04)',
                                    borderBottom: '1px solid rgba(239,68,68,0.12)',
                                }}>
                                    <span className="text-red-400/70 text-xs admin-terminal-font">⚠ confirm_purge?</span>
                                    <button
                                        onClick={() => deleteMessage(selected.id)}
                                        className="px-2.5 py-1 rounded text-xs admin-terminal-font bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors border border-red-500/25"
                                    >
                                        purge
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(null)}
                                        className="px-2.5 py-1 rounded text-xs admin-terminal-font text-blue-400 hover:bg-blue-500/10 transition-colors"
                                    >
                                        abort
                                    </button>
                                </div>
                            )}

                            {/* Detail body */}
                            <div className="p-5 space-y-5 max-h-[600px] overflow-y-auto admin-scroll">
                                {/* Sender card */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-base font-bold shrink-0" style={{
                                        background: 'rgba(34,211,238,0.08)',
                                        border: '1px solid rgba(34,211,238,0.15)',
                                        color: 'rgb(34,211,238)',
                                    }}>
                                        {selected.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm admin-terminal-font text-blue-200 font-bold">
                                            {selected.name}
                                        </div>
                                        <a
                                            href={`mailto:${selected.email}`}
                                            className="text-xs admin-terminal-font text-cyan-400/50 hover:text-cyan-400 transition-colors"
                                        >
                                            {selected.email}
                                        </a>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] admin-terminal-font text-blue-400/40">
                                                {subjectLabels[selected.subject] || selected.subject || '(no subject)'}
                                            </span>
                                            <span className="text-[10px] admin-terminal-font text-blue-600/25">
                                                {new Date(selected.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="text-blue-500/8 text-xs admin-terminal-font select-none">
                                    {'─'.repeat(50)}
                                </div>

                                {/* Message body */}
                                <div className="text-sm admin-terminal-font text-blue-200/85 whitespace-pre-wrap leading-relaxed rounded-lg p-4" style={{
                                    background: 'rgba(59,130,246,0.02)',
                                    border: '1px solid rgba(59,130,246,0.06)',
                                    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                                }}>
                                    {selected.message}
                                </div>

                                {/* Metadata grid */}
                                <div className="rounded-lg p-3" style={{
                                    background: 'rgba(59,130,246,0.02)',
                                    border: '1px solid rgba(59,130,246,0.06)',
                                }}>
                                    <div className="text-[10px] admin-terminal-font text-blue-600/20 uppercase tracking-widest mb-2">
                                        // transmission_metadata
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                                        {[
                                            { label: 'ip_addr', value: selected.ip_address },
                                            { label: 'source', value: selected.source || 'direct' },
                                            { label: 'locale', value: selected.lang },
                                            { label: 'req_id', value: selected.request_id },
                                        ].map(m => (
                                            <div key={m.label} className="flex items-center gap-2 text-[11px] admin-terminal-font">
                                                <span className="text-blue-600/25 w-16 shrink-0">{m.label}:</span>
                                                <span className="text-blue-400/45 truncate">{m.value || '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex items-start gap-2 text-[11px] admin-terminal-font mt-1">
                                        <span className="text-blue-600/25 w-16 shrink-0">ua:</span>
                                        <span className="text-blue-400/30 break-all text-[10px]">{selected.user_agent || '—'}</span>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-2 pt-1">
                                    <a
                                        href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(subjectLabels[selected.subject] || selected.subject || 'Your message')}`}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs admin-terminal-font text-cyan-400 border border-cyan-500/25 hover:bg-cyan-500/10 transition-colors"
                                    >
                                        <EnvelopeIcon className="w-3.5 h-3.5" />
                                        reply_via_email
                                    </a>
                                    <button
                                        onClick={() => updateMessage(selected.id, 'is_archived', 1)}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs admin-terminal-font text-blue-500/50 border border-blue-500/15 hover:bg-blue-500/10 transition-colors"
                                    >
                                        <ArchiveBoxIcon className="w-3.5 h-3.5" />
                                        archive
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Empty detail state */
                        <div className="hidden lg:flex lg:w-3/5 rounded-lg items-center justify-center" style={{
                            border: '1px dashed rgba(59,130,246,0.08)',
                            background: 'rgba(59,130,246,0.01)',
                        }}>
                            <div className="text-center">
                                <EnvelopeOpenIcon className="w-8 h-8 text-blue-600/10 mx-auto mb-3" />
                                <p className="text-blue-600/20 text-xs admin-terminal-font">
                                    // select a transmission to decrypt
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
