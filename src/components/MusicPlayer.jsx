import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import React, { useEffect, useMemo, useRef, useState } from 'react'

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPlayer({ tracks = [] }) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  const hasTracks = tracks && tracks.length > 0
  const current = hasTracks ? tracks[Math.min(index, tracks.length - 1)] : null

  // Load metadata and listen current time
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onLoaded = () => {
      setDuration(audio.duration || 0)
    }
    const onTime = () => setCurrentTime(audio.currentTime || 0)
    const onError = () => {
      // detener playback si la pista falla
      setIsPlaying(false)
    }
    const onEnded = () => {
      // auto-next wrap
      if (tracks.length > 1) {
        setIndex((i) => (i + 1) % tracks.length)
        setIsPlaying(true)
      } else {
        setIsPlaying(false)
        setCurrentTime(0)
      }
    }
    const onCanPlay = () => {
      // start if requested
      if (isPlaying) {
        audio.play().catch(() => {})
      }
    }
    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('canplay', onCanPlay)
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('canplay', onCanPlay)
    }
  }, [tracks, index, isPlaying])

  // Play/pause on track change or play state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) return
    const src = (() => {
      try { return encodeURI(new URL(current.src.replace(/^\/+/, ''), import.meta.env.BASE_URL).href) } catch { return current.src }
    })()
    if (audio.getAttribute('data-src') !== src) {
      audio.pause()
      audio.setAttribute('data-src', src)
      try { audio.src = src } catch {}
      try { audio.load() } catch {}
      setCurrentTime(0)
    }
    if (isPlaying) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [index, isPlaying, current])

  // Reflect isPlaying
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.play().catch(() => {})
    else audio.pause()
  }, [isPlaying])

  const canPrev = hasTracks && tracks.length > 1
  const canNext = canPrev
  const ENABLE_ID3_COVER = true

  // Audio-driven glow: update CSS variable --glow from analyser energy
  // Removed WebAudio analyser to avoid interfering with playback; can be re-added later

  const containerRef = useRef(null)

  return (
    <div ref={containerRef} className="pointer-events-auto w-[360px] max-w-[92vw] rounded-2xl overflow-hidden text-white shadow-xl select-none bg-black/50 backdrop-blur rgb-border rgb-glow">
      {/* Cover dominante cuadrada */}
      <div className="relative aspect-[4/3] bg-white/5 rounded-b-none">
        {current?.cover ? (
          <img src={current.cover} alt="cover" className="absolute inset-0 w-full h-full object-cover rounded-t-2xl" />
        ) : ENABLE_ID3_COVER ? (
          <CoverFromMeta src={current?.src} className="absolute inset-0 w-full h-full object-cover rounded-t-2xl" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs opacity-80">No Cover</div>
        )}
        {/* Gradiente y marquee de título/autor sobre el cover */}
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="overflow-hidden w-full">
            <div
              className="whitespace-nowrap font-marquee text-base sm:text-lg opacity-95 will-change-transform"
              style={{ animation: 'marquee 8s linear infinite' }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="mx-6">
                  {(current?.title || 'No tracks')}{current?.artist ? ` — ${current.artist}` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Controles y timeline */}
      <div className="p-3">
        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-40"
            onClick={() => { if (canPrev) { setIndex((i) => (i - 1 + tracks.length) % tracks.length); setIsPlaying(true) } }}
            disabled={!canPrev}
            aria-label="Previous"
          >
            <BackwardIcon className="w-7 h-7" />
          </button>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-50"
            onClick={() => setIsPlaying((p) => !p)}
            disabled={!hasTracks}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon className="w-9 h-9" /> : <PlayIcon className="w-9 h-9" />}
          </button>
          <button
            type="button"
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-40"
            onClick={() => { if (canNext) { setIndex((i) => (i + 1) % tracks.length); setIsPlaying(true) } }}
            disabled={!canNext}
            aria-label="Next"
          >
            <ForwardIcon className="w-7 h-7" />
          </button>
        </div>
        <div className="mt-3">
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.01}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => {
              const t = parseFloat(e.target.value)
              setCurrentTime(t)
              const audio = audioRef.current
              if (audio) audio.currentTime = t
            }}
            className="w-full accent-white/90"
          />
          <div className="flex justify-between text-[11px] opacity-70 tabular-nums">
            <span className="font-marquee">{formatTime(currentTime)}</span>
            <span className="font-marquee">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}

function CoverFromMeta({ src, className }) {
  const [dataUrl, setDataUrl] = useState(null)
  const cacheRef = useRef(new Map())
  useEffect(() => {
    let cancelled = false
    if (!src) { setDataUrl(null); return }
    // reset while loading new cover to avoid showing previous image
    setDataUrl(null)
    const key = src
    const cached = cacheRef.current.get(key)
    if (cached) { setDataUrl(cached); return }
    (async () => {
      try {
        const url = (() => {
          try {
            const path = src.replace(/^\/+/, '')
            return encodeURI(new URL(path, import.meta.env.BASE_URL).href)
          } catch { return encodeURI(src) }
        })()
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch-failed')
        const blob = await res.blob()
        const { default: jsmediatags } = await import('jsmediatags/dist/jsmediatags.min.js')
        jsmediatags.read(blob, {
          onSuccess: ({ tags }) => {
            if (cancelled) return
            const pic = tags.picture
            if (pic && pic.data && pic.format) {
              const byteArray = new Uint8Array(pic.data)
              const imgBlob = new Blob([byteArray], { type: pic.format })
              const urlObj = URL.createObjectURL(imgBlob)
              cacheRef.current.set(key, urlObj)
              setDataUrl(urlObj)
            } else {
              setDataUrl(null)
            }
          },
          onError: () => { if (!cancelled) setDataUrl(null) },
        })
      } catch {
        if (!cancelled) setDataUrl(null)
      }
    })()
    return () => { cancelled = true }
  }, [src])
  if (dataUrl) return <img src={dataUrl} alt="cover" className={className || 'w-16 h-16 rounded object-cover'} />
  return <div className={className ? `${className} grid place-items-center` : 'w-16 h-16 rounded bg-white/10 grid place-items-center text-xs opacity-80'}>No Cover</div>
}


