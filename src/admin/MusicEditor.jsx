/**
 * Music Editor CMS — Manage songs/manifest.json
 * Terminal CRT theme with vinyl box grid, color picker, audio preview, drag & drop
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
    ArrowLeftIcon,
    ArrowUpIcon,
    Bars3Icon,
    ArrowPathRoundedSquareIcon,
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
                boxShadow: playing ? `0 0 12px ${palette.c1}60` : 'none',
                transition: 'box-shadow 0.3s',
            }}
        >
            {/* Center hole */}
            <div style={{
                position: 'relative',
                top: '50%', left: '50%',
                width: size * 0.15, height: size * 0.15,
                transform: 'translate(-50%, -50%)',
                background: '#0a0f0a',
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
            className={`
        group relative rounded overflow-hidden
        cursor-grab active:cursor-grabbing
        ${isDragging ? 'scale-[1.02]' : ''}
        transition-shadow
      `}
        >
            {/* Card border */}
            <div
                className="absolute inset-0 rounded pointer-events-none z-[1]"
                style={{
                    border: isDragging
                        ? '1px solid rgba(59, 130, 246, 0.6)'
                        : '1px solid rgba(59, 130, 246, 0.15)',
                    boxShadow: isDragging
                        ? '0 0 25px rgba(59, 130, 246, 0.3), inset 0 0 25px rgba(59, 130, 246, 0.05)'
                        : 'inset 0 0 20px rgba(59, 130, 246, 0.03)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
            />

            {/* Drag handle */}
            <div
                className="absolute top-2 right-2 z-10 p-1.5 rounded pointer-events-none opacity-60"
                style={{ backgroundColor: 'rgba(0, 10, 30, 0.7)' }}
            >
                <Bars3Icon className="w-3.5 h-3.5 text-blue-400/60" />
            </div>

            {/* First track badge */}
            {index === 0 && (
                <div
                    className="absolute top-2 left-2 z-10 pointer-events-none"
                >
                    <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase"
                        style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.7)',
                            color: '#000',
                            fontFamily: '"Cascadia Code", monospace',
                            fontSize: '0.6rem',
                            letterSpacing: '0.05em',
                        }}
                    >
                        ▶ FIRST
                    </span>
                </div>
            )}

            {/* Vinyl + info area */}
            <div
                className="p-4 flex items-center gap-4"
                style={{ backgroundColor: 'rgba(0, 10, 20, 0.5)', minHeight: '120px' }}
            >
                {/* Vinyl disc */}
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPlay() }}
                        className="relative block focus:outline-none"
                        title={isPlaying ? 'Pause' : 'Preview'}
                    >
                        <MiniVinyl color={track.vinylColor || 'red'} size={72} playing={isPlaying} />
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                            {isPlaying
                                ? <PauseIcon className="w-5 h-5 text-white" />
                                : <PlayIcon className="w-5 h-5 text-white" />
                            }
                        </div>
                    </button>
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                    <h3
                        className="text-blue-300 text-sm truncate mb-0.5"
                        style={{ fontFamily: '"Cascadia Code", monospace' }}
                    >
                        {track.title || 'Untitled'}
                    </h3>
                    <p
                        className="text-blue-500/40 text-xs truncate mb-2"
                        style={{ fontFamily: '"Cascadia Code", monospace' }}
                    >
                        {track.artist || '// no artist'}
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
                                        className={`w-5 h-5 rounded-full border-2 transition-all ${track.vinylColor === key ? 'border-white scale-125' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'
                                            }`}
                                        style={{ backgroundColor: VINYL_COLORS[key].c1 }}
                                        title={key}
                                    />
                                ))}
                                {/* Native color picker for custom colors */}
                                <label
                                    className="w-5 h-5 rounded-full border-2 border-dashed border-blue-500/40 cursor-pointer hover:border-blue-400 transition-colors flex items-center justify-center overflow-hidden"
                                    title="Custom color"
                                >
                                    <input
                                        type="color"
                                        value={track.vinylColor?.startsWith('#') ? track.vinylColor : '#3b82f6'}
                                        onChange={(e) => { onColorChange(e.target.value); setShowColorPicker(false) }}
                                        className="opacity-0 absolute w-0 h-0"
                                    />
                                    <span className="text-blue-400 text-xs leading-none">+</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(false) }}
                                    className="text-blue-500/50 text-xs hover:text-blue-400 ml-1"
                                    style={{ fontFamily: '"Cascadia Code", monospace' }}
                                >
                                    ×
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setShowColorPicker(true) }}
                                className="flex items-center gap-1.5 text-xs text-blue-500/50 hover:text-blue-400 transition-colors"
                                style={{ fontFamily: '"Cascadia Code", monospace' }}
                            >
                                <span
                                    className="w-4 h-4 rounded-full border border-blue-500/30"
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
                <div
                    className="flex items-center gap-1.5 p-2"
                    style={{
                        backgroundColor: 'rgba(0, 10, 20, 0.7)',
                        borderTop: '1px solid rgba(59, 130, 246, 0.1)',
                    }}
                >
                    {/* Set as first */}
                    {index !== 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onSetFirst() }}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors flex-1 justify-center"
                            style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.2)',
                                color: '#60a5fa',
                                fontFamily: '"Cascadia Code", monospace',
                            }}
                            title="Set as first track"
                        >
                            <ArrowUpIcon className="w-3 h-3" />
                            <span>first</span>
                        </button>
                    )}

                    {/* Delete */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete() }}
                        disabled={isDeleting}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50 justify-center"
                        style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            fontFamily: '"Cascadia Code", monospace',
                        }}
                        title="Delete track"
                    >
                        {isDeleting ? (
                            <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <TrashIcon className="w-3 h-3" />
                        )}
                        <span>del</span>
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
            className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md p-6 rounded"
                onClick={(e) => e.stopPropagation()}
                style={{
                    backgroundColor: 'rgba(0, 15, 30, 0.95)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    boxShadow: '0 0 40px rgba(59, 130, 246, 0.15)',
                }}
            >
                <h2
                    className="text-lg mb-4"
                    style={{ fontFamily: '"Cascadia Code", monospace', color: '#22d3ee', textShadow: '0 0 8px rgba(34, 211, 238, 0.3)' }}
                >
                    &gt; upload_track
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Audio file */}
                    <div>
                        <label className="block text-xs text-blue-500/50 mb-1" style={{ fontFamily: '"Cascadia Code", monospace' }}>
              // audio_file (mp3, ogg, wav)
                        </label>
                        <div
                            className="relative p-4 rounded text-center cursor-pointer hover:border-blue-400/50 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '1px dashed rgba(59, 130, 246, 0.3)',
                                backgroundColor: 'rgba(0, 10, 30, 0.5)',
                            }}
                        >
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
                            {file ? (
                                <p className="text-blue-300 text-xs truncate" style={{ fontFamily: '"Cascadia Code", monospace' }}>
                                    ✓ {file.name}
                                </p>
                            ) : (
                                <p className="text-blue-500/40 text-xs" style={{ fontFamily: '"Cascadia Code", monospace' }}>
                                    click to select audio file
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-xs text-blue-500/50 mb-1" style={{ fontFamily: '"Cascadia Code", monospace' }}>
              // title *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="admin-input w-full px-3 py-2 rounded text-sm"
                            placeholder="Track title"
                            required
                        />
                    </div>

                    {/* Artist */}
                    <div>
                        <label className="block text-xs text-blue-500/50 mb-1" style={{ fontFamily: '"Cascadia Code", monospace' }}>
              // artist
                        </label>
                        <input
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            className="admin-input w-full px-3 py-2 rounded text-sm"
                            placeholder="Artist name (optional)"
                        />
                    </div>

                    {/* Vinyl color */}
                    <div>
                        <label className="block text-xs text-blue-500/50 mb-1" style={{ fontFamily: '"Cascadia Code", monospace' }}>
              // vinyl_color
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {COLOR_KEYS.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setVinylColor(key)}
                                    className={`w-7 h-7 rounded-full border-2 transition-all ${vinylColor === key ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                        }`}
                                    style={{ backgroundColor: VINYL_COLORS[key].c1 }}
                                    title={key}
                                />
                            ))}
                            {/* Native color picker */}
                            <label
                                className={`w-7 h-7 rounded-full border-2 border-dashed cursor-pointer transition-all flex items-center justify-center overflow-hidden ${vinylColor.startsWith('#') ? 'border-white scale-110' : 'border-blue-500/40 opacity-60 hover:opacity-100'
                                    }`}
                                style={vinylColor.startsWith('#') ? { backgroundColor: vinylColor } : {}}
                                title="Custom color"
                            >
                                <input
                                    type="color"
                                    value={vinylColor.startsWith('#') ? vinylColor : '#3b82f6'}
                                    onChange={(e) => setVinylColor(e.target.value)}
                                    className="opacity-0 absolute w-0 h-0"
                                />
                                {!vinylColor.startsWith('#') && <span className="text-blue-400 text-xs leading-none">+</span>}
                            </label>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-3 pt-2">
                        <MiniVinyl color={vinylColor} size={48} />
                        <div className="min-w-0">
                            <p className="text-blue-300 text-xs truncate" style={{ fontFamily: '"Cascadia Code", monospace' }}>
                                {title || 'Track title'}
                            </p>
                            <p className="text-blue-500/40 text-xs truncate" style={{ fontFamily: '"Cascadia Code", monospace' }}>
                                {artist || '// no artist'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="admin-error rounded px-3 py-2 text-xs">
                            &gt; ERROR: {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={uploading || !file || !title.trim()}
                            className="admin-btn-primary px-4 py-2 rounded text-xs disabled:opacity-50"
                        >
                            {uploading ? '> uploading...' : '> upload'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="admin-btn-secondary px-4 py-2 rounded text-xs"
                        >
                            cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}


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
        <div className="max-w-7xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded hover:bg-blue-500/10 transition-colors text-blue-400"
                        title="Back"
                    >
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="admin-section-title text-lg">
                            music_tracks
                        </h1>
                        <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
              // drag to reorder • click vinyl to preview
                            {savingOrder && <span className="text-blue-400 ml-2">• saving_order...</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchTracks()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded text-xs admin-btn-secondary"
                        title="Refresh"
                    >
                        <ArrowPathRoundedSquareIcon className="w-4 h-4" />
                        <span>refresh</span>
                    </button>
                    <button
                        onClick={() => setShowUpload(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded text-sm font-bold uppercase tracking-wider active:scale-[0.98] transition-all"
                        style={{
                            backgroundColor: '#3b82f6',
                            color: '#000',
                            border: '1px solid #60a5fa',
                            boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)',
                        }}
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>&gt; upload_track</span>
                    </button>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-blue-500/50 text-xs admin-terminal-font">&gt; fetching_tracks...</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && !loading && (
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4 text-sm admin-terminal-font">
                        <span className="opacity-60">&gt; </span>ERROR: {error}
                    </p>
                    <button
                        onClick={fetchTracks}
                        className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors"
                    >
                        &gt; retry()
                    </button>
                </div>
            )}

            {/* Empty */}
            {!loading && !error && tracks.length === 0 && (
                <div className="text-center py-20">
                    <MusicalNoteIcon className="w-16 h-16 text-blue-500/15 mx-auto mb-4" />
                    <p className="text-blue-500/40 mb-4 text-sm admin-terminal-font">
            // No tracks in manifest.json
                    </p>
                    <button
                        onClick={() => setShowUpload(true)}
                        className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors"
                    >
                        &gt; upload_first_track()
                    </button>
                </div>
            )}

            {/* Track grid */}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

            {/* Upload modal */}
            {showUpload && (
                <UploadModal
                    onClose={() => setShowUpload(false)}
                    onUpload={handleUpload}
                />
            )}
        </div>
    )
}
