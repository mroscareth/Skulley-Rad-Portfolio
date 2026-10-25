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

// En celular los controles chicos crecen a 44px para poder tocarlos; desde sm
// vuelven a su tamaño de escritorio.
const TAP = 'min-h-11 sm:min-h-0'
const TAP_ICON_SM = 'w-11 h-11 sm:w-8 sm:h-8'

// ── Utility: format numbers ──
const fmt = (n) => Number(n || 0).toLocaleString('es-MX')

// ── Utility: relative time ──
const timeAgo = (dateStr) => {
    const now = new Date()
    const then = new Date(dateStr)
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return 'Hace un momento'
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
    if (diff < 604800) {
        const days = Math.floor(diff / 86400)
        return `Hace ${days} ${days === 1 ? 'día' : 'días'}`
    }
    return then.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Subject display map — mismos textos que el formulario del sitio en español.
const subjectLabels = {
    workTogether: 'Trabajemos juntos',
    collaboration: 'Colaboración',
    other: 'Otro',
}

// El asunto de la respuesta lo lee quien escribió, así que va en su idioma.
// En inglés se queda exactamente como antes.
const replySubjects = {
    en: { workTogether: 'Work together', collaboration: 'Collaboration', other: 'Other', fallback: 'Your message' },
    es: { workTogether: 'Trabajemos juntos', collaboration: 'Colaboración', other: 'Otro', fallback: 'Tu mensaje' },
}
const replySubjectFor = (msg) => {
    const map = msg.lang === 'es' ? replySubjects.es : replySubjects.en
    return map[msg.subject] || msg.subject || map.fallback
}

const langLabels = { es: 'Español', en: 'Inglés' }

const emptyCopy = {
    unread: 'No hay mensajes sin leer.',
    starred: 'No hay mensajes destacados.',
    archived: 'No hay mensajes archivados.',
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
        { id: 'all', label: 'Todos', count: counts.total - counts.archived },
        { id: 'unread', label: 'Sin leer', count: counts.unread },
        { id: 'starred', label: 'Destacados', count: counts.starred },
        { id: 'archived', label: 'Archivados', count: counts.archived },
    ]
    const activeTab = filterTabs.find(f => f.id === filter)

    const emptyListCopy = search
        ? 'Ningún mensaje coincide con tu búsqueda.'
        : filter === 'all'
            ? 'Todavía no hay mensajes.'
            : emptyCopy[filter] || 'No hay mensajes aquí.'

    const isRead = selected ? !!parseInt(selected.is_read) : false
    const isStarredSel = selected ? !!parseInt(selected.is_starred) : false
    const isArchivedSel = selected ? !!parseInt(selected.is_archived) : false

    return (
        <div className="w-full">
            {/* Header */}
            <header className="a-page-head">
                <div className="min-w-0">
                    <h1 className="a-title">Mensajes</h1>
                    <p className="a-subtitle">
                        Lo que la gente te escribe desde el formulario de contacto. Respóndele por correo y archiva lo que ya atendiste.
                    </p>
                </div>

                <div className="a-page-head__actions justify-end">
                    <button
                        type="button"
                        onClick={() => fetchMessages(page, filter)}
                        className={`a-btn a-btn--secondary a-btn--sm ${TAP}`}
                    >
                        <ArrowPathIcon className="w-4 h-4" aria-hidden />
                        Actualizar
                    </button>
                </div>
            </header>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                {[
                    { label: 'Total', value: counts.total },
                    { label: 'Sin leer', value: counts.unread },
                    { label: 'Destacados', value: counts.starred },
                    { label: 'Archivados', value: counts.archived },
                ].map(kpi => (
                    <div key={kpi.label} className="a-card p-4 sm:p-5">
                        <div className="a-kicker mb-2">{kpi.label}</div>
                        <div className="text-2xl sm:text-3xl font-bold text-white a-num leading-none">
                            {fmt(kpi.value)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters + Search bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
                <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filtrar mensajes">
                    {filterTabs.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={`a-chip ${TAP}`}
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
                        placeholder="Buscar por nombre, correo o texto"
                        aria-label="Buscar mensajes"
                        className="a-input pl-9"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="a-spinner" role="status" aria-label="Cargando mensajes" />
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start lg:min-h-[500px]">
                    {/* Message list. On mobile it gives way to the open message, which has its own back button. */}
                    <div className={`${selected ? 'hidden lg:flex' : 'flex'} flex-col gap-3 w-full lg:w-2/5 lg:shrink-0`}>
                        <div className="flex items-baseline justify-between gap-2 px-1">
                            <span className="text-sm font-semibold text-white/70">
                                {filter === 'all' ? 'Todos los mensajes' : activeTab?.label || filter}
                            </span>
                            <span className="a-meta">{fmt(filtered.length)}</span>
                        </div>

                        {/* La búsqueda filtra lo que ya está cargado, no todo el buzón. */}
                        {search && pages > 1 && (
                            <p className="a-help px-1">Solo busca entre los mensajes de esta página.</p>
                        )}

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
                                        className={`a-card a-card--interactive p-4 ${isSelected ? 'border-section-quests' : ''}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`w-9 h-9 rounded-full grid place-items-center text-sm font-bold shrink-0 ${isUnread ? 'bg-white text-[#0a0510]' : 'bg-white/[0.08] text-white/60'}`}
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
                                                                <span className="sr-only">Sin leer:</span>
                                                            </>
                                                        )}
                                                        <span className="truncate">{msg.name}</span>
                                                    </span>
                                                    <span className="flex items-center gap-1.5 shrink-0">
                                                        {isStarred && (
                                                            <>
                                                                <StarIcon className="w-3.5 h-3.5 text-feedback-warning" aria-hidden />
                                                                <span className="sr-only">Destacado</span>
                                                            </>
                                                        )}
                                                        <span className="a-meta">{timeAgo(msg.created_at)}</span>
                                                    </span>
                                                </div>

                                                <div className="text-[0.8125rem] text-white/70 truncate mt-1">
                                                    {subjectLabels[msg.subject] || msg.subject || '(sin asunto)'}
                                                </div>

                                                <div className="text-[0.8125rem] text-white/45 truncate mt-0.5">
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
                                <span className="a-meta">Página {page} de {pages}</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setPage(p => p - 1); fetchMessages(page - 1, filter) }}
                                        disabled={page <= 1}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM} disabled:opacity-40`}
                                        aria-label="Página anterior"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setPage(p => p + 1); fetchMessages(page + 1, filter) }}
                                        disabled={page >= pages}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM} disabled:opacity-40`}
                                        aria-label="Página siguiente"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {selected ? (
                        <section
                            className="a-card a-fade-in w-full lg:flex-1 min-w-0 overflow-hidden lg:sticky lg:top-10"
                            aria-label="Mensaje"
                        >
                            <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 border-b-2 border-white/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelected(null)}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM} lg:hidden`}
                                        aria-label="Volver a los mensajes"
                                    >
                                        <ArrowLeftIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                    <span className="a-meta truncate hidden sm:block">Mensaje #{selected.id}</span>
                                </div>

                                {/* Eliminar va primero (a la izquierda) y como ícono: nunca junto a la acción principal. */}
                                <div className="flex items-center gap-1.5 sm:gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmDelete(selected.id)}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM} a-icon-btn--danger mr-1 sm:mr-2`}
                                        title="Eliminar"
                                        aria-label="Eliminar"
                                    >
                                        <TrashIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_read', isRead ? 0 : 1)}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM}`}
                                        title={isRead ? 'Marcar como no leído' : 'Marcar como leído'}
                                        aria-label={isRead ? 'Marcar como no leído' : 'Marcar como leído'}
                                    >
                                        {isRead
                                            ? <EnvelopeIcon className="w-4 h-4" aria-hidden />
                                            : <EnvelopeOpenIcon className="w-4 h-4" aria-hidden />
                                        }
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_starred', isStarredSel ? 0 : 1)}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM} ${isStarredSel ? 'text-feedback-warning' : ''}`}
                                        title={isStarredSel ? 'Quitar de destacados' : 'Destacar'}
                                        aria-label={isStarredSel ? 'Quitar de destacados' : 'Destacar'}
                                        aria-pressed={isStarredSel}
                                    >
                                        <StarIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_archived', isArchivedSel ? 0 : 1)}
                                        className={`a-icon-btn a-icon-btn--sm ${TAP_ICON_SM}`}
                                        title={isArchivedSel ? 'Sacar de archivados' : 'Archivar'}
                                        aria-label={isArchivedSel ? 'Sacar de archivados' : 'Archivar'}
                                    >
                                        <ArchiveBoxIcon className="w-4 h-4" aria-hidden />
                                    </button>
                                </div>
                            </div>

                            {confirmDelete === selected.id && (
                                <div className="a-alert a-alert--danger flex-col sm:flex-row sm:items-center gap-3 mx-4 sm:mx-5 mt-4" role="alert">
                                    <span className="flex-1 min-w-0">¿Eliminar este mensaje? Se borra para siempre y no se puede deshacer.</span>
                                    <div className="flex flex-wrap items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDelete(null)}
                                            className={`a-btn a-btn--ghost a-btn--sm ${TAP}`}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteMessage(selected.id)}
                                            className={`a-btn a-btn--danger-solid a-btn--sm ${TAP}`}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 sm:p-6 space-y-6 lg:max-h-[600px] lg:overflow-y-auto a-scroll">
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
                                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                                            <span className="a-badge">
                                                {subjectLabels[selected.subject] || selected.subject || '(sin asunto)'}
                                            </span>
                                            <span className="a-meta">
                                                {new Date(selected.created_at).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <hr className="a-divider" />

                                <div className="text-[0.9375rem] text-white/85 whitespace-pre-wrap break-words leading-relaxed">
                                    {selected.message}
                                </div>

                                {/* Acción principal al final, a la derecha, también en celular. */}
                                <div className="flex flex-wrap items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => updateMessage(selected.id, 'is_archived', 1)}
                                        className={`a-btn a-btn--secondary ${TAP}`}
                                    >
                                        <ArchiveBoxIcon className="w-4 h-4" aria-hidden />
                                        Archivar
                                    </button>
                                    <a
                                        href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(replySubjectFor(selected))}`}
                                        className={`a-btn a-btn--primary ${TAP}`}
                                    >
                                        <EnvelopeIcon className="w-4 h-4" aria-hidden />
                                        Responder por correo
                                    </a>
                                </div>

                                <div className="pt-6 border-t-2 border-white/10">
                                    <h3 className="a-section-title text-sm mb-4">Datos técnicos</h3>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                        {[
                                            { label: 'IP', value: selected.ip_address, code: true },
                                            { label: 'Origen', value: selected.source || 'Directo' },
                                            { label: 'Idioma', value: langLabels[selected.lang] || selected.lang },
                                            { label: 'ID de solicitud', value: selected.request_id, code: true },
                                        ].map(m => (
                                            <div key={m.label} className="min-w-0">
                                                <dt className="a-kicker mb-1">{m.label}</dt>
                                                <dd className={`truncate ${m.code && m.value ? 'a-code' : 'text-sm text-white/70'}`} title={m.value || undefined}>
                                                    {m.value || '—'}
                                                </dd>
                                            </div>
                                        ))}
                                        <div className="min-w-0 sm:col-span-2">
                                            <dt className="a-kicker mb-1">Navegador (user agent)</dt>
                                            <dd className="text-xs text-white/55 break-all leading-relaxed">{selected.user_agent || '—'}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="a-empty hidden lg:flex lg:flex-1 lg:self-stretch flex-col items-center justify-center gap-3">
                            <EnvelopeOpenIcon className="w-8 h-8 text-white/25" aria-hidden />
                            <p>Elige un mensaje para leerlo.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
