/**
 * Music Editor CMS — Manage songs/manifest.json
 * Sortable track list with color picker, audio preview and drag & drop
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

// Solo para mostrar: el manifest guarda la clave en inglés (o un #hex).
const COLOR_NAMES = {
    red: 'rojo',
    black: 'negro',
    yellow: 'amarillo',
    blue: 'azul',
    purple: 'morado',
    teal: 'turquesa',
    green: 'verde',
    orange: 'naranja',
    pink: 'rosa',
}
const colorName = (color) => COLOR_NAMES[color] || (color?.startsWith('#') ? 'personalizado' : COLOR_NAMES.red)

const API_URL = '/api/music.php'

// music.php responde con frases en inglés; al usuario se le dice qué pasó y qué hacer.
const API_ERRORS = {
    'No audio file uploaded or upload error': 'No llegó el archivo. Si pesa mucho, prueba con un MP3.',
    'Title is required': 'Ponle título a la canción.',
    'Invalid audio format. Allowed: mp3, ogg, wav, flac': 'Ese formato no se puede subir. Usa MP3, OGG, WAV o FLAC.',
    'Failed to save audio file': 'El servidor no pudo guardar el archivo. Intenta de nuevo.',
    'Invalid track index': 'Esa canción ya no está en la lista. Dale a Actualizar.',
    unauthorized: 'Tu sesión se cerró. Vuelve a iniciar sesión e intenta de nuevo.',
}

const RULES = [
    'La primera de la lista es la que suena primero en el sitio; las demás siguen en este orden.',
    'Al tocar un disco escuchas sus primeros 10 segundos.',
    'Los cambios se guardan solos: el orden, el color y cuál va primero. No hay botón de guardar.',
    'Las canciones nuevas se agregan al final de la lista.',
    'Formatos: MP3, OGG, WAV o FLAC. Mejor MP3: pesa menos y carga más rápido.',
    'Eliminar una canción también borra su archivo del servidor. No se puede deshacer.',
]

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-section-quests'
// a-icon-btn mide 40px; en móvil el dedo necesita 44px.
const ICON_BTN = 'a-icon-btn w-11 h-11 sm:w-10 sm:h-10'

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
 * Small vinyl disc preview for the list rows
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
 * Color swatches (presets + native picker). The hit area is the button; the
 * visible dot inside stays small.
 */
function ColorSwatches({ value, onPick, idPrefix }) {
    const isCustom = typeof value === 'string' && value.startsWith('#')
    return (
        <>
            {COLOR_KEYS.map((key) => (
                <button
                    key={key}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPick(key) }}
                    className={`group/sw w-11 h-11 sm:w-9 sm:h-9 grid place-items-center rounded-full ${FOCUS_RING}`}
                    title={COLOR_NAMES[key]}
                    aria-label={`Disco ${COLOR_NAMES[key]}`}
                    aria-pressed={value === key}
                >
                    <span
                        aria-hidden
                        className={`w-7 h-7 rounded-full border-2 transition-all ${value === key ? 'border-white scale-110' : 'border-transparent opacity-70 group-hover/sw:opacity-100'}`}
                        style={{ backgroundColor: VINYL_COLORS[key].c1 }}
                    />
                </button>
            ))}
            {/* Native color picker for custom colors */}
            <label
                htmlFor={`${idPrefix}-custom`}
                className="relative w-11 h-11 sm:w-9 sm:h-9 grid place-items-center rounded-full cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-section-quests"
                title="Color personalizado"
            >
                <span
                    aria-hidden
                    className={`w-7 h-7 rounded-full border-2 border-dashed grid place-items-center transition-all ${isCustom ? 'border-white scale-110' : 'border-white/30 opacity-70 hover:opacity-100'}`}
                    style={isCustom ? { backgroundColor: value } : {}}
                >
                    {!isCustom && <PlusIcon className="w-3.5 h-3.5 text-white/70" />}
                </span>
                <input
                    id={`${idPrefix}-custom`}
                    type="color"
                    value={isCustom ? value : '#3b82f6'}
                    onChange={(e) => onPick(e.target.value)}
                    className="opacity-0 absolute w-0 h-0"
                    aria-label="Color personalizado del disco"
                />
            </label>
        </>
    )
}

/**
 * Sortable track row
 */
function SortableTrackCard({ track, index, onDelete, onSetFirst, onColorChange, onPlay, isPlaying, isDeleting }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `track-${index}`, attributes: { roleDescription: 'canción ordenable' } })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.9 : 1,
    }

    const [showColorPicker, setShowColorPicker] = useState(false)
    const title = track.title || 'Sin título'
    const color = track.vinylColor || 'red'

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            aria-label={`${index + 1}. ${title}`}
            className={`a-card relative p-4 sm:p-5 cursor-grab active:cursor-grabbing ${FOCUS_RING} ${isDragging ? 'border-section-quests scale-[1.02]' : ''}`}
        >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    {/* Drag affordance: the whole row is the handle */}
                    <Bars3Icon className="w-5 h-5 text-white/30 shrink-0 pointer-events-none" aria-hidden />
                    <span className="w-6 text-center text-base font-bold tabular-nums text-white/45 shrink-0" aria-hidden>
                        {index + 1}
                    </span>

                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPlay() }}
                        className={`group/vinyl relative block shrink-0 rounded-full ${FOCUS_RING}`}
                        aria-label={isPlaying ? `Pausar ${title}` : `Escuchar 10 segundos de ${title}`}
                        title={isPlaying ? 'Pausar' : 'Escuchar'}
                    >
                        <MiniVinyl color={color} size={56} playing={isPlaying} />
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/vinyl:opacity-100 group-focus-visible/vinyl:opacity-100">
                            {isPlaying
                                ? <PauseIcon className="w-5 h-5 text-white" aria-hidden />
                                : <PlayIcon className="w-5 h-5 text-white" aria-hidden />
                            }
                        </span>
                    </button>

                    <div className="min-w-0 flex-1">
                        <h2 className="a-item__title">{title}</h2>
                        <p className="a-item__meta">
                            <span className="min-w-0 truncate">{track.artist || 'Sin artista'}</span>
                            <span>Disco {colorName(track.vinylColor)}</span>
                        </p>
                    </div>
                </div>

                {/* Íconos primero; la acción principal (o el estado de la primera)
                    va al final. Eliminar queda en la orilla opuesta. */}
                {!isDragging && (
                    <div className="a-item__actions justify-end">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete() }}
                            disabled={isDeleting}
                            className={`${ICON_BTN} a-icon-btn--danger`}
                            aria-label={isDeleting ? `Eliminando ${title}` : `Eliminar ${title}`}
                            title="Eliminar"
                        >
                            {isDeleting ? (
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
                            ) : (
                                <TrashIcon className="w-4 h-4" aria-hidden />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowColorPicker((v) => !v) }}
                            className={ICON_BTN}
                            aria-expanded={showColorPicker}
                            aria-label={`Cambiar color del disco (${colorName(track.vinylColor)})`}
                            title="Color del disco"
                        >
                            <span
                                aria-hidden
                                className="w-4 h-4 rounded-full border-2 border-white/15"
                                style={{ backgroundColor: resolvePalette(track.vinylColor).c1 }}
                            />
                        </button>
                        {index === 0 ? (
                            <span className="a-badge a-badge--accent">
                                <PlayIcon className="w-3 h-3" aria-hidden />
                                Suena primero
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onSetFirst() }}
                                className="a-btn a-btn--primary a-btn--sm h-11 sm:h-10"
                                title="Que suene primero en el sitio"
                            >
                                <ArrowUpIcon className="w-3.5 h-3.5" aria-hidden />
                                Poner primero
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Color selector (inline) */}
            {showColorPicker && !isDragging && (
                <div
                    role="group"
                    aria-label={`Color del disco de ${title}`}
                    className="mt-4 pt-4 border-t-2 border-white/10 flex flex-wrap items-center gap-1 sm:gap-1.5"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <ColorSwatches
                        value={color}
                        idPrefix={`track-${index}`}
                        onPick={(c) => { onColorChange(c); setShowColorPicker(false) }}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowColorPicker(false) }}
                        className={`${ICON_BTN} ml-auto`}
                        aria-label="Cerrar colores"
                        title="Cerrar"
                    >
                        <XMarkIcon className="w-4 h-4" aria-hidden />
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
                setError(API_ERRORS[data.error] || 'No se pudo subir la canción. Intenta de nuevo.')
            }
        } catch (err) {
            setError('No hay conexión con el servidor. Intenta de nuevo.')
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
                <h2 id="upload-track-title" className="a-title text-[1.75rem] mb-6">
                    Subir canción
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Audio file */}
                    <div>
                        <div className="a-label">Archivo de audio</div>
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
                            className={`a-inset border-dashed w-full min-h-11 flex items-center justify-center gap-2 p-4 text-sm font-semibold text-white/55 hover:text-white hover:border-white/30 transition-colors ${FOCUS_RING}`}
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
                                    <span>Elige un archivo de audio</span>
                                </>
                            )}
                        </button>
                        <p className="a-help mt-1.5">MP3, OGG, WAV o FLAC. Mejor MP3: pesa menos y carga más rápido.</p>
                    </div>

                    {/* Title */}
                    <div>
                        <label htmlFor="upload-track-name" className="a-label">Título</label>
                        <input
                            id="upload-track-name"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="a-input"
                            placeholder="Nombre de la canción"
                            aria-describedby="upload-track-name-help"
                            required
                        />
                        <p id="upload-track-name-help" className="a-help mt-1.5">
                            Se llena con el nombre del archivo; cámbialo si quieres.
                        </p>
                    </div>

                    {/* Artist */}
                    <div>
                        <label htmlFor="upload-track-artist" className="a-label">Artista</label>
                        <input
                            id="upload-track-artist"
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                            className="a-input"
                            placeholder="Opcional"
                        />
                    </div>

                    {/* Vinyl color */}
                    <div role="group" aria-labelledby="upload-track-color">
                        <div id="upload-track-color" className="a-label">Color del disco</div>
                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                            <ColorSwatches value={vinylColor} idPrefix="upload-track" onPick={setVinylColor} />
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-3">
                        <MiniVinyl color={vinylColor} size={48} />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                {title || 'Nombre de la canción'}
                            </p>
                            <p className="text-xs text-white/45 truncate">
                                {artist || 'Sin artista'}
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="a-alert a-alert--danger px-4 py-3" role="alert">
                            <span className="min-w-0 break-words">{error}</span>
                        </div>
                    )}

                    {/* Buttons: la acción principal va al final (derecha). */}
                    <div className="flex flex-wrap items-center justify-end gap-3 pt-5 border-t-2 border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="a-btn a-btn--secondary min-h-11 sm:min-h-0"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={uploading || !file || !title.trim()}
                            className="a-btn a-btn--primary min-h-11 sm:min-h-0"
                        >
                            {uploading ? 'Subiendo…' : 'Subir canción'}
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
            setError('No se pudo cargar la lista de canciones. Revisa tu conexión e intenta de nuevo.')
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
        if (!confirm(`¿Eliminar “${track.title}”? También se borra su archivo del servidor. No se puede deshacer.`)) return

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
                alert(API_ERRORS[data.error] || 'No se pudo eliminar la canción. Intenta de nuevo.')
            }
        } catch {
            alert('No hay conexión con el servidor. Intenta de nuevo.')
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

    // Lo que el lector de pantalla anuncia al mover una canción con el teclado
    // (dnd-kit trae estos textos en inglés).
    const placeOf = (id) => Number(String(id).replace('track-', '')) + 1
    const nameOf = (id) => tracks[placeOf(id) - 1]?.title || `la canción ${placeOf(id)}`
    const dndAccessibility = {
        screenReaderInstructions: {
            draggable: 'Para mover una canción, presiona espacio o Enter. Muévela con las flechas y vuelve a presionar espacio o Enter para soltarla. Escape cancela.',
        },
        announcements: {
            onDragStart: ({ active }) => `Tomaste ${nameOf(active.id)}, que está en el lugar ${placeOf(active.id)}.`,
            onDragOver: ({ active, over }) => over
                ? `${nameOf(active.id)} está sobre el lugar ${placeOf(over.id)}.`
                : `${nameOf(active.id)} ya no está sobre ningún lugar.`,
            onDragEnd: ({ active, over }) => over
                ? `Soltaste ${nameOf(active.id)} en el lugar ${placeOf(over.id)}.`
                : `Soltaste ${nameOf(active.id)}.`,
            onDragCancel: ({ active }) => `Cancelaste. ${nameOf(active.id)} se quedó en el lugar ${placeOf(active.id)}.`,
        },
    }

    return (
        <div className="w-full">
            <header className="a-page-head">
                <div className="min-w-0">
                    <h1 className="a-title">Música</h1>
                    <p className="a-subtitle">
                        Las canciones del reproductor del sitio, en el orden en que suenan: arrástralas para ordenarlas
                        y toca un disco para escucharlo.
                        {savingOrder && (
                            <span className="inline-flex items-center gap-1.5 ml-2 text-white/70" role="status">
                                <span className="a-spinner a-spinner--sm inline-block" aria-hidden />
                                Guardando el orden…
                            </span>
                        )}
                    </p>
                </div>
                {/* La acción principal va al final (derecha). */}
                <div className="a-page-head__actions">
                    <button
                        type="button"
                        onClick={() => fetchTracks()}
                        className="a-btn a-btn--secondary min-h-11 sm:min-h-0"
                        title="Volver a cargar la lista"
                    >
                        <ArrowPathRoundedSquareIcon className="w-4 h-4" aria-hidden />
                        Actualizar
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowUpload(true)}
                        className="a-btn a-btn--primary min-h-11 sm:min-h-0"
                    >
                        <PlusIcon className="w-4 h-4" aria-hidden />
                        Subir canción
                    </button>
                </div>
            </header>

            <section className="a-section" aria-label="Canciones">
                {loading && (
                    <div className="flex items-center justify-center py-24">
                        <div className="a-spinner" role="status" aria-label="Cargando canciones" />
                    </div>
                )}

                {error && !loading && (
                    <div className="a-alert a-alert--danger flex-wrap items-center gap-3 p-4" role="alert">
                        <span className="flex-1 min-w-0 break-words">{error}</span>
                        <button type="button" onClick={fetchTracks} className="a-btn a-btn--secondary a-btn--sm min-h-11 sm:min-h-0">
                            Reintentar
                        </button>
                    </div>
                )}

                {!loading && !error && tracks.length === 0 && (
                    <div className="a-empty flex flex-col items-center gap-4 px-6">
                        <MusicalNoteIcon className="w-8 h-8 text-white/25" aria-hidden />
                        <p>Todavía no hay canciones.</p>
                        <button
                            type="button"
                            onClick={() => setShowUpload(true)}
                            className="a-btn a-btn--primary"
                        >
                            <PlusIcon className="w-4 h-4" aria-hidden />
                            Subir la primera canción
                        </button>
                    </div>
                )}

                {!loading && !error && tracks.length > 0 && (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        accessibility={dndAccessibility}
                    >
                        <SortableContext
                            items={tracks.map((_, i) => `track-${i}`)}
                            strategy={rectSortingStrategy}
                        >
                            {/* Una lista y no una cuadrícula: el orden es el del
                                reproductor y se lee de arriba abajo. */}
                            <div className="flex flex-col gap-3 max-w-4xl">
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
            </section>

            {/* Ayuda donde surge la duda (heurística 10): no hay botón de guardar
                y eliminar borra el archivo. */}
            {!loading && !error && (
                <section className="a-section" aria-labelledby="music-rules-title">
                    <h2 id="music-rules-title" className="a-section-title">Cómo funciona</h2>
                    <ul className="a-rules mt-4 max-w-3xl">
                        {RULES.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                </section>
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
