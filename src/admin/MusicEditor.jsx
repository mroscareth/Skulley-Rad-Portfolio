/**
 * Music Editor CMS — Manage songs/manifest.json
 * Vinyl card grid with color picker, audio preview and drag & drop
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
    MusicalNoteIcon,
    PlayIcon,
    PauseIcon,
    ArrowUpIcon,
    Bars3Icon,
    ArrowPathRoundedSquareIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/solid'

// Must match VINYL_COLORS in MusicPlayer.jsx
const VINYL_COLORS = {
    red: { c1: '#e01b1b', c2: '#b81414', c3: '#6e0a0a', hl: 'rgba(255,80,80,0.18)' },
    black: { c1: '#555555', c2: '#333333', c3: '#111111', hl: 'rgba(255,255,255,0.10)' },
    yellow: { c1: '#e8c812', c2: '#c4a80e', c3: '#7a6a08', hl: 'rgba(255,230,50,0.20)' },
    blue: { c1: '#1a5cff', c2: '#1248d4', c3: '#0a2e8a', hl: 'rgba(80,140,255,0.18)' },
    purple: { c1: '#9b2aed', c2: '#7b1ec4', c3: '#4c1080', hl: 'rgba(180,100,255,0.18)' },
    teal: { c1: '#12ccb3', c2: '#0ea894', c3: '#08705e', hl: 'rgba(80,255,220,0.18)' },
    green: { c1: '#30d418', c2: '#26ac12', c3: '#14700a', hl: 'rgba(100,255,80,0.18)' },
    orange: { c1: '#f07818', c2: '#cc6212', c3: '#884008', hl: 'rgba(255,160,60,0.20)' },
    pink: { c1: '#f0289a', c2: '#c81e7e', c3: '#80124e', hl: 'rgba(255,80,180,0.18)' },
}

const COLOR_KEYS = Object.keys(VINYL_COLORS)

const API_URL = '/api/music.php'

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-quests'

/**
 * Derive a full vinyl palette from any hex color
 */
function hexToPalette(hex) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const darken = (v, f) => Math.round(v * f)
    return {
        c1: hex,
        c2: `rgb(${darken(r, 0.8)},${darken(g, 0.8)},${darken(b, 0.8)})`,
        c3: `rgb(${darken(r, 0.45)},${darken(g, 0.45)},${darken(b, 0.45)})`,
        hl: `rgba(${r},${g},${b},0.18)`,
    }
}

/**
 * Resolve a color key or hex string to a palette
 */
function resolvePalette(color) {
    if (VINYL_COLORS[color]) return VINYL_COLORS[color]
    if (color && color.startsWith('#') && color.length === 7) return hexToPalette(color)
    return VINYL_COLORS.red
}

/**
 * Small vinyl disc preview for the grid cards
 */
function MiniVinyl({ color = 'red', size = 64, playing = false }) {
    const palette = resolvePalette(color)
    return (
        <div
            className="rounded-full shrink-0"
            style={{
                width: size, height: size,
                background: `radial-gradient(circle at 50% 50%, ${palette.hl} 0%, transparent 42%), repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0) 1px 4px), radial-gradient(circle at 50% 50%, ${palette.c1} 0%, ${palette.c2} 55%, ${palette.c3} 100%)`,
                animation: playing ? 'spin 1.5s linear infinite' : 'none',
            }}
        >
            {/* Center hole */}
            <div style={{
                position: 'relative',
                top: '50%', left: '50%',
                width: size * 0.15, height: size * 0.15,
                transform: 'translate(-50%, -50%)',
                background: 'var(--a-surface)',
                borderRadius: '50%',
            }} />
        </div>
    )
}

/**
 * Sortable vinyl card
 */
function SortableTrackCard({ track, index, onDelete, onSetFirst, onColorChange, onPlay, isPlaying, isDeleting }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `track-${index}` })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.9 : 1,
    }

    const [showColorPicker, setShowColorPicker] = useState(false)

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`a-card relative overflow-hidden flex flex-col cursor-grab active:cursor-grabbing ${FOCUS_RING} ${isDragging ? 'border-section-quests scale-[1.02]' : ''}`}
        >
            {/* Drag affordance: the whole card is the handle */}
            <Bars3Icon className="absolute top-3 right-3 w-4 h-4 text-white/30 pointer-events-none" aria-hidden />

            <div className="flex-1 p-4 pr-9 flex items-center gap-4 min-h-[120px]">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPlay() }}
                    className={`group/vinyl relative block shrink-0 rounded-full ${FOCUS_RING}`}
                    aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                    title={isPlaying ? 'Pause' : 'Preview'}
                >
                    <MiniVinyl color={track.vinylColor || 'red'} size={72} playing={isPlaying} />
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/vinyl:opacity-100 group-focus-visible/vinyl:opacity-100">
                        {isPlaying
                            ? <PauseIcon className="w-5 h-5 text-white" />
                            : <PlayIcon className="w-5 h-5 text-white" />
                        }
                    </span>
                </button>

                <div className="flex-1 min-w-0">
                    {index === 0 && (
                        <div className="mb-2">
                            <span className="a-badge a-badge--accent">
                                <PlayIcon className="w-3 h-3" aria-hidden />
                                Plays first
                            </span>
                        </div>
                    )}
                    <h3 className="text-sm font-bold text-white truncate">
                        {track.title || 'Untitled'}
                    </h3>
                    <p className="text-xs text-white/45 truncate mt-0.5 mb-2.5">
                        {track.artist || 'No artist'}
                    </p>

                    {/* Color selector (inline) */}
                    <div className="flex items-center gap-1.5 flex-wrap" onPointerDown={(e) => e.stopPropagation()}>
                        {showColorPicker ? (
                            <>
                                {COLOR_KEYS.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onColorChange(key); setShowColorPicker(false) }}
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${FOCUS_RING} ${track.vinylColor === key ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'
                                            }`}
                                        style={{ backgroundColor: VINYL_COLORS[key].c1 }}
                                        title={key}
                                        aria-label={`Vinyl color ${key}`}
                                        aria-pressed={track.vinylColor === key}
                                    />
                                ))}
                                {/* Native color picker for custom colors */}
                                <label
                                    className="w-5 h-5 rounded-full border-2 border-dashed border-white/30 cursor-pointer hover:border-white/70 transition-colors flex items-center justify-center overflow-hidden"
                                    title="Custom color"
                                >
                                    <input
                                        type="color"
                                        value={track.vinylColor?.startsWith('#') ? track.vinylColor : '#3b82f6'}
                                        onChange={(e) => { onColorChange(e.target.value); setShowColorPicker(false) }}
                                        className="opacity-0 absolute w-0 h-0"
                                        aria-label="Custom vinyl color"
                                    />
                                    <PlusIcon className="w-3 h-3 text-white/60" aria-hidden />
                                </label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(false) }}
                                    className={`ml-0.5 w-5 h-5 grid place-items-center rounded-full text-white/45 hover:text-white transition-colors ${FOCUS_RING}`}
                                    aria-label="Close colors"
                                    title="Close"
                                >
                                    <XMarkIcon className="w-3.5 h-3.5" />
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowColorPicker(true) }}
                                className={`flex items-center gap-1.5 rounded-full text-xs font-semibold capitalize text-white/55 hover:text-white transition-colors ${FOCUS_RING}`}
                                aria-label={`Change vinyl color (${track.vinylColor || 'red'})`}
                            >
                                <span
                                    className="w-4 h-4 rounded-full border-2 border-white/15"
                                    style={{ backgroundColor: resolvePalette(track.vinylColor).c1 }}
                                />
                                {track.vinylColor || 'red'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Actions bar */}
            {!isDragging && (
                <div className="flex items-center gap-2 px-3 py-2.5 border-t-2 border-white/10">
                    {index !== 0 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onSetFirst() }}
                            className="a-btn a-btn--secondary a-btn--sm flex-1"
                            title="Set as first track"
                        >
                            <ArrowUpIcon className="w-3.5 h-3.5" aria-hidden />
                            Make first
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        disabled={isDeleting}
                        className="a-btn a-btn--danger a-btn--sm ml-auto"
                        title="Delete track"
                    >
                        {isDeleting ? (
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
                        ) : (
                            <TrashIcon className="w-3.5 h-3.5" aria-hidden />
                        )}
                        Delete
                    </button>
                </div>
            )}
        </div>
    )
}

/**
 * Upload modal for new tracks
 */
function UploadModal({ onClose, onUpload }) {
    const [title, setTitle] = useState('')
    const [artist, setArtist] = useState('')
    const [vinylColor, setVinylColor] = useState('blue')
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState(null)
    const fileInputRef = useRef(null)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!file || !title.trim()) return

        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append('audio', file)
        formData.append('title', title.trim())
        formData.append('artist', artist.trim())
        formData.append('vinylColor', vinylColor)

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            })
            const data = await res.json()
            if (data.ok) {
                onUpload(data.track)
            } else {
                setError(data.error || 'Upload failed')
            }
        } catch (err) {
            setError('Connection error')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-track-title"
                className="a-card a-fade-in w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto a-scroll p-5 sm:p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="upload-track-title" className="a-title text-[1.75rem] mb-5">
                    Upload track
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Audio file */}
                    <div>
                        <div className="a-label">Audio file</div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,.ogg,.wav,.flac"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files[0]
                                if (f) {
                                    setFile(f)
                                    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''))
                                }
                            }}
                        />
                        <button
                            type="button"
                            className={`a-inset border-dashed w-full flex items-center justify-center gap-2 p-4 text-sm font-semibold text-white/55 hover:text-white hover:border-white/30 transition-colors ${FOCUS_RING}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {file ? (
                                <>
                                    <CheckIcon className="w-4 h-4 text-green-300 shrink-0" aria-hidden />
                                    <span className="a-code text-white truncate">{file.name}</span>
                                </>
                            ) : (
                                <>
                                    <MusicalNoteIcon className="w-4 h-4 shrink-0" aria-hidden />
                                    <span>Choose an audio file</span>
                                </>
                            )}
                        </button>
                        <p className="a-help mt-1.5">MP3, OGG or WAV.</p>
                    </div>

                    {/* Title */}
                    <div>
                        <label htmlFor="upload-track-name" className="a-label">Title</label>
                        <input
                            id="upload-track-name"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="a-input"
                            placeholder="Track title"
                            required
                        />
                    </div>

                    {/* Artist */}
                    <div>
                        <label htmlFor="upload-track-artist" className="a-label">Artist</label>
                        <input
                            id="upload-track-artist"
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            className="a-input"
                            placeholder="Artist name (optional)"
                        />
                    </div>

                    {/* Vinyl color */}
                    <div>
                        <div className="a-label">Vinyl color</div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {COLOR_KEYS.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setVinylColor(key)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all ${FOCUS_RING} ${vinylColor === key ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                    style={{ backgroundColor: VINYL_COLORS[key].c1 }}
                                    title={key}
                                    aria-label={`Vinyl color ${key}`}
                                    aria-pressed={vinylColor === key}
                                />
                            ))}
                            {/* Native color picker */}
                            <label
                                className={`w-7 h-7 rounded-full border-2 border-dashed cursor-pointer transition-all flex items-center justify-center overflow-hidden ${vinylColor.startsWith('#') ? 'border-white scale-110' : 'border-white/30 opacity-60 hover:opacity-100'
                                    }`}
                                style={vinylColor.startsWith('#') ? { backgroundColor: vinylColor } : {}}
                                title="Custom color"
                            >
                                <input
                                    type="color"
                                    value={vinylColor.startsWith('#') ? vinylColor : '#3b82f6'}
                                    onChange={(e) => setVinylColor(e.target.value)}
                                    className="opacity-0 absolute w-0 h-0"
                                    aria-label="Custom vinyl color"
                                />
                                {!vinylColor.startsWith('#') && <PlusIcon className="w-3.5 h-3.5 text-white/70" aria-hidden />}
                            </label>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="a-inset flex items-center gap-3 p-3">
                        <MiniVinyl color={vinylColor} size={48} />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                {title || 'Track title'}
                            </p>
                            <p className="text-xs text-white/45 truncate">
                                {artist || 'No artist'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="a-alert a-alert--danger px-3 py-2" role="alert">
                            <span className="min-w-0 break-words">{error}</span>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="a-btn a-btn--secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={uploading || !file || !title.trim()}
                            className="a-btn a-btn--primary"
                        >
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}


// onBack still arrives from AdminApp, but top-level views navigate through the sidebar.
export default function MusicEditor({ onBack }) {
    const [tracks, setTracks] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [deleting, setDeleting] = useState(null)
    const [showUpload, setShowUpload] = useState(false)
    const [playingIndex, setPlayingIndex] = useState(-1)
    const [savingOrder, setSavingOrder] = useState(false)
    const audioRef = useRef(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 3 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const fetchTracks = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(API_URL, { credentials: 'include', cache: 'no-cache' })
            const data = await res.json()
            setTracks(Array.isArray(data) ? data : [])
        } catch (err) {
            setError('Connection error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchTracks() }, [fetchTracks])

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    const handlePlay = (index) => {
        if (playingIndex === index) {
            // Pause
            if (audioRef.current) audioRef.current.pause()
            setPlayingIndex(-1)
            return
        }

        // Stop current
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
        }

        const track = tracks[index]
        if (!track?.src) return

        const audio = new Audio(`${import.meta.env.BASE_URL}${track.src}`)
        audio.volume = 0.5
        audio.onended = () => setPlayingIndex(-1)
        audio.onerror = () => setPlayingIndex(-1)
        // Play a 10-second preview with 2-second fade-out
        const PREVIEW_MS = 10000
        const FADE_MS = 2000
        audio.play().then(() => {
            // Start fade-out 2 seconds before the end
            setTimeout(() => {
                if (audioRef.current !== audio) return
                const fadeStart = audio.volume
                const fadeSteps = 20
                const stepMs = FADE_MS / fadeSteps
                let step = 0
                const fadeInterval = setInterval(() => {
                    step++
                    if (audioRef.current !== audio || step >= fadeSteps) {
                        clearInterval(fadeInterval)
                        if (audioRef.current === audio) {
                            audio.pause()
                            setPlayingIndex(-1)
                        }
                        return
                    }
                    audio.volume = Math.max(0, fadeStart * (1 - step / fadeSteps))
                }, stepMs)
            }, PREVIEW_MS - FADE_MS)
        }).catch(() => setPlayingIndex(-1))

        audioRef.current = audio
        setPlayingIndex(index)
    }

    const handleDelete = async (index) => {
        const track = tracks[index]
        if (!confirm(`Delete "${track.title}"? This cannot be undone.`)) return

        setDeleting(index)
        try {
            const res = await fetch(`${API_URL}?index=${index}`, {
                method: 'DELETE',
                credentials: 'include',
            })
            const data = await res.json()
            if (data.ok) {
                setTracks((prev) => prev.filter((_, i) => i !== index))
                if (playingIndex === index) {
                    if (audioRef.current) audioRef.current.pause()
                    setPlayingIndex(-1)
                }
            } else {
                alert(data.error || 'Delete failed')
            }
        } catch {
            alert('Connection error')
        } finally {
            setDeleting(null)
        }
    }

    const handleSetFirst = async (index) => {
        try {
            const res = await fetch(API_URL, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ firstTrack: index }),
            })
            const data = await res.json()
            if (data.ok && data.tracks) {
                setTracks(data.tracks)
            }
        } catch {
            console.error('Set first failed')
        }
    }

    const handleColorChange = async (index, color) => {
        // Optimistic update
        setTracks((prev) => prev.map((t, i) => i === index ? { ...t, vinylColor: color } : t))

        try {
            await fetch(API_URL, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index, vinylColor: color }),
            })
        } catch {
            // Revert on error
            fetchTracks()
        }
    }

    const handleDragEnd = async (event) => {
        const { active, over } = event
        if (active.id !== over?.id) {
            const oldIndex = tracks.findIndex((_, i) => `track-${i}` === active.id)
            const newIndex = tracks.findIndex((_, i) => `track-${i}` === over.id)
            const newTracks = arrayMove(tracks, oldIndex, newIndex)
            setTracks(newTracks)

            // Save new order
            setSavingOrder(true)
            try {
                const reorder = newTracks.map((t) => tracks.indexOf(t))
                await fetch(API_URL, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reorder }),
                })
            } catch {
                console.error('Reorder failed')
            } finally {
                setSavingOrder(false)
            }
        }
    }

    const handleUpload = (newTrack) => {
        setTracks((prev) => [...prev, newTrack])
        setShowUpload(false)
    }

    return (
        <div className="w-full">
            <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
                <div className="min-w-0">
                    <h1 className="a-title">Music</h1>
                    <p className="a-subtitle">
                        Drag to reorder. Click a record to preview it.
                        {savingOrder && (
                            <span className="inline-flex items-center gap-1.5 ml-2 text-white/70" role="status">
                                <span className="a-spinner a-spinner--sm inline-block" aria-hidden />
                                Saving order…
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fetchTracks()}
                        className="a-btn a-btn--secondary"
                        title="Refresh"
                    >
                        <ArrowPathRoundedSquareIcon className="w-4 h-4" aria-hidden />
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowUpload(true)}
                        className="a-btn a-btn--primary"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden />
                        Upload track
                    </button>
                </div>
            </header>

            {loading && (
                <div className="flex items-center justify-center py-24">
                    <div className="a-spinner" role="status" aria-label="Loading tracks" />
                </div>
            )}

            {error && !loading && (
                <div className="a-alert a-alert--danger flex-wrap items-center gap-3 p-4" role="alert">
                    <span className="flex-1 min-w-0 break-words">{error}</span>
                    <button type="button" onClick={fetchTracks} className="a-btn a-btn--secondary a-btn--sm">
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && tracks.length === 0 && (
                <div className="a-empty flex flex-col items-center gap-4">
                    <MusicalNoteIcon className="w-8 h-8 text-white/25" aria-hidden />
                    <p>No tracks in <span className="a-code">manifest.json</span> yet.</p>
                    <button
                        type="button"
                        onClick={() => setShowUpload(true)}
                        className="a-btn a-btn--primary"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden />
                        Upload the first track
                    </button>
                </div>
            )}

            {!loading && !error && tracks.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={tracks.map((_, i) => `track-${i}`)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
                            {tracks.map((track, index) => (
                                <SortableTrackCard
                                    key={`track-${index}`}
                                    track={track}
                                    index={index}
                                    onDelete={() => handleDelete(index)}
                                    onSetFirst={() => handleSetFirst(index)}
                                    onColorChange={(color) => handleColorChange(index, color)}
                                    onPlay={() => handlePlay(index)}
                                    isPlaying={playingIndex === index}
                                    isDeleting={deleting === index}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUpload={handleUpload}
                />
            )}
        </div>
    )
}
