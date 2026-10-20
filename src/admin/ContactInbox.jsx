/**
 * Contact Inbox
 *
 * Standalone admin section for viewing, managing, and replying to
 * contact form submissions.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'


import {
    EnvelopeIcon,
    EnvelopeOpenIcon,
    StarIcon,
    TrashIcon,
    ArchiveBoxIcon,
    ArrowPathIcon,
    ArrowLeftIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
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
    workTogether: 'Work together',
    collaboration: 'Collaboration',
    other: 'Other',
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
        { id: 'all', label: 'All', count: counts.total - counts.archived },
        { id: 'unread', label: 'Unread', count: counts.unread },
        { id: 'starred', label: 'Starred', count: counts.starred },
        { id: 'archived', label: 'Archived', count: counts.archived },
    ]
    const activeTab = filterTabs.find(f => f.id === filter)

    const emptyListCopy = search
        ? 'No messages match your search.'
        : filter === 'all'
            ? 'No messages yet.'
            : `No ${activeTab?.label.toLowerCase() || filter} messages.`

    return (
        <div className="w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="a-title">Inbox</h1>
                    <p className="a-subtitle">
                        Contact form messages{' '}· {fmt(counts.total)} total{' '}· {fmt(counts.unread)} unread
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => fetchMessages(page, filter)}
                    className="a-btn a-btn--secondary a-btn--sm self-start sm:self-auto"
                >
                    <ArrowPathIcon className="w-4 h-4" aria-hidden />
                    Refresh
                </button>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Total', value: counts.total },
                    { label: 'Unread', value: counts.unread },
                    { label: 'Starred', value: counts.starred },
                    { label: 'Archived', value: counts.archived },
                ].map(kpi => (
                    <div key={kpi.label} className="a-card px-4 py-3">
                        <div className="a-kicker mb-1.5">{kpi.label}</div>
                        <div className="text-2xl font-bold text-white a-num leading-none">
                            {fmt(kpi.value)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters + Search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter messages">
                    {filterTabs.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className="a-chip"
                            aria-pressed={filter === f.id}
                        >
                            {f.label}
                            {f.count > 0 && <span className="a-chip__count">{fmt(f.count)}</span>}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
                    <MagnifyingGlassIcon
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none"
                        aria-hidden
                    />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search messages"
                        aria-label="Search messages"
                        className="a-input pl-9"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="a-spinner" role="status" aria-label="Loading messages" />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4 lg:items-start lg:min-h-[500px]">
                    {/* Message list. On mobile it gives way to the open message, which has its own back button. */}
                    <div className={`${selected ? 'hidden lg:flex' : 'flex'} flex-col gap-2 w-full lg:w-2/5 lg:shrink-0`}>
                        <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
                            <span className="text-sm font-semibold text-white/70">
                                {filter === 'all' ? 'All messages' : activeTab?.label || filter}
                            </span>
                            <span className="a-meta">{fmt(filtered.length)}</span>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="a-empty">{emptyListCopy}</div>
                        ) : (
                            filtered.map((msg) => {
                                const isUnread = !parseInt(msg.is_read)
                                const isStarred = !!parseInt(msg.is_starred)
                                const isSelected = selected?.id === msg.id

                                return (
                                    <div
                                        key={msg.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => selectMessage(msg)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                selectMessage(msg)
                                            }
                                        }}
                                        aria-current={isSelected ? 'true' : undefined}
                                        className={`a-card a-card--interactive px-4 py-3 ${isSelected ? 'border-section-quests' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0 ${isUnread ? 'bg-white text-[#0a0510]' : 'bg-white/[0.08] text-white/60'}`}
                                                aria-hidden
                                            >
                                                {msg.name.charAt(0).toUpperCase()}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`flex items-center gap-2 min-w-0 text-sm ${isUnread ? 'text-white font-bold' : 'text-white/70 font-medium'}`}>
                                                        {isUnread && (
                                                            <>
                                                                <span className="a-dot bg-section-quests" aria-hidden />
                                                                <span className="sr-only">Unread:</span>
                                                            </>
                                                        )}
                                                        <span className="truncate">{msg.name}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        {isStarred && (
                                                            <>
                                                                <StarIcon className="w-3.5 h-3.5 text-feedback-warning" aria-hidden />
                                                                <span className="sr-only">Starred</span>
                                                            </>
                                                        )}
                                                        <span className="a-meta">{timeAgo(msg.created_at)}</span>
                                                    </span>
                                                </div>

                                                <div className="text-[0.8125rem] text-white/70 truncate mt-0.5">
                                                    {subjectLabels[msg.subject] || msg.subject || '(no subject)'}
                                                </div>

                                                <div className="text-[0.8125rem] text-white/45 truncate">
                                                    {msg.message.substring(0, 90)}{msg.message.length > 90 ? '…' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}

                        {pages > 1 && (
                            <div className="flex items-center justify-between gap-3 px-1 pt-2">
                                <span className="a-meta">Page {page} of {pages}</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setPage(p => p - 1); fetchMessages(page - 1, filter) }}
                                        disabled={page <= 1}
                                        className="a-icon-btn a-icon-btn--sm disabled:opacity-40"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPage(p => p + 1); fetchMessages(page + 1, filter) }}
                                        disabled={page >= pages}
                                        className="a-icon-btn a-icon-btn--sm disabled:opacity-40"
                                        aria-label="Next page"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {selected ? (
                        <section
                            className="a-card a-fade-in w-full lg:flex-1 min-w-0 overflow-hidden lg:sticky lg:top-10"
                            aria-label="Message"
                        >
                            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b-2 border-white/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelected(null)}
                                        className="a-icon-btn a-icon-btn--sm lg:hidden"
                                        aria-label="Back to messages"
                                    >
                                        <ArrowLeftIcon className="w-4 h-4" />
                                    </button>
                                    <span className="a-meta truncate">Message #{selected.id}</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_read', parseInt(selected.is_read) ? 0 : 1)}
                                        className="a-icon-btn a-icon-btn--sm"
                                        title={parseInt(selected.is_read) ? 'Mark unread' : 'Mark read'}
                                        aria-label={parseInt(selected.is_read) ? 'Mark unread' : 'Mark read'}
                                    >
                                        {parseInt(selected.is_read)
                                            ? <EnvelopeIcon className="w-4 h-4" />
                                            : <EnvelopeOpenIcon className="w-4 h-4" />
                                        }
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_starred', parseInt(selected.is_starred) ? 0 : 1)}
                                        className={`a-icon-btn a-icon-btn--sm ${parseInt(selected.is_starred) ? 'text-feedback-warning' : ''}`}
                                        title={parseInt(selected.is_starred) ? 'Unstar' : 'Star'}
                                        aria-label={parseInt(selected.is_starred) ? 'Unstar' : 'Star'}
                                        aria-pressed={!!parseInt(selected.is_starred)}
                                    >
                                        <StarIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_archived', parseInt(selected.is_archived) ? 0 : 1)}
                                        className="a-icon-btn a-icon-btn--sm"
                                        title={parseInt(selected.is_archived) ? 'Unarchive' : 'Archive'}
                                        aria-label={parseInt(selected.is_archived) ? 'Unarchive' : 'Archive'}
                                    >
                                        <ArchiveBoxIcon className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(selected.id)}
                                        className="a-icon-btn a-icon-btn--sm a-icon-btn--danger"
                                        title="Delete"
                                        aria-label="Delete"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {confirmDelete === selected.id && (
                                <div className="a-alert a-alert--danger flex-wrap items-center m-4 mb-0 p-3" role="alert">
                                    <span className="flex-1 min-w-[12rem]">Delete this message? This can't be undone.</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(null)}
                                            className="a-btn a-btn--ghost a-btn--sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteMessage(selected.id)}
                                            className="a-btn a-btn--danger-solid a-btn--sm"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 sm:p-5 space-y-5 lg:max-h-[600px] lg:overflow-y-auto a-scroll">
                                {/* Sender */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full grid place-items-center text-base font-bold shrink-0 bg-white/[0.08] text-white" aria-hidden>
                                        {selected.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-base font-bold text-white leading-snug break-words">
                                            {selected.name}
                                        </h2>
                                        <a
                                            href={`mailto:${selected.email}`}
                                            className="text-sm text-white/70 hover:text-white underline-offset-2 hover:underline break-all"
                                        >
                                            {selected.email}
                                        </a>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className="a-badge">
                                                {subjectLabels[selected.subject] || selected.subject || '(no subject)'}
                                            </span>
                                            <span className="a-meta">
                                                {new Date(selected.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="a-divider" />

                                <div className="text-[0.9375rem] text-white/85 whitespace-pre-wrap break-words leading-relaxed">
                                    {selected.message}
                                </div>

                                <div className="pt-5 border-t-2 border-white/10">
                                    <h3 className="a-section-title text-sm mb-3">Metadata</h3>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                        {[
                                            { label: 'IP address', value: selected.ip_address, code: true },
                                            { label: 'Source', value: selected.source || 'direct' },
                                            { label: 'Locale', value: selected.lang },
                                            { label: 'Request ID', value: selected.request_id, code: true },
                                        ].map(m => (
                                            <div key={m.label} className="min-w-0">
                                                <dt className="a-kicker mb-1">{m.label}</dt>
                                                <dd className={`truncate ${m.code && m.value ? 'a-code' : 'text-sm text-white/70'}`} title={m.value || undefined}>
                                                    {m.value || '—'}
                                                </dd>
                                            </div>
                                        ))}
                                        <div className="min-w-0 sm:col-span-2">
                                            <dt className="a-kicker mb-1">User agent</dt>
                                            <dd className="text-xs text-white/55 break-all leading-relaxed">{selected.user_agent || '—'}</dd>
                                        </div>
                                    </dl>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                    <a
                                        href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(subjectLabels[selected.subject] || selected.subject || 'Your message')}`}
                                        className="a-btn a-btn--primary"
                                    >
                                        <EnvelopeIcon className="w-4 h-4" aria-hidden />
                                        Reply by email
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_archived', 1)}
                                        className="a-btn a-btn--secondary"
                                    >
                                        <ArchiveBoxIcon className="w-4 h-4" aria-hidden />
                                        Archive
                                    </button>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="a-empty hidden lg:flex lg:flex-1 lg:self-stretch flex-col items-center justify-center gap-3">
                            <EnvelopeOpenIcon className="w-8 h-8 text-white/25" aria-hidden />
                            <p>Select a message to read it.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
