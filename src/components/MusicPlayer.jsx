import React, { useEffect, useRef, useState } from 'react'
import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPlayer({ tracks = [], navHeight, autoStart = false }) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [isHoverOver, setIsHoverOver] = useState(false)
  const [discExpanded, setDiscExpanded] = useState(false)

  const hasTracks = tracks && tracks.length > 0
  const current = hasTracks ? tracks[Math.min(index, tracks.length - 1)] : null

  const containerRef = useRef(null)
  const heightPx = Math.max(40, Math.min(80, typeof navHeight === 'number' ? navHeight : 56))
  const verticalPadding = 8
  const mobileDiscBase = Math.max(110, Math.min(180, Math.round((Math.min(window.innerWidth || 360, 360) - 80) * 0.55)))
  const isHoveringMobile = isMobile && (isPressing || isHoverOver)
  const mobileFactor = isHoveringMobile ? 1.12 : 1
  const discSize = isMobile
    ? Math.round(mobileDiscBase * mobileFactor)
    : Math.max(36, Math.min(72, heightPx - verticalPadding * 2))
  const deltaPushPx = isMobile ? Math.max(0, (discSize - mobileDiscBase)) : 0
  const pushMarginPx = isMobile ? (isHoveringMobile ? Math.max(32, Math.round(deltaPushPx + 32)) : 16) : undefined
  const resolveUrl = (path) => {
    if (!path) return null
    try { return encodeURI(new URL(path.replace(/^\/+/, ''), import.meta.env.BASE_URL).href) } catch { return path }
  }

  // Disc state (radians)
  const discRef = useRef(null)
  const isDraggingRef = useRef(false)
  const centerRef = useRef({ x: 0, y: 0 })
  const draggingFromRef = useRef({ x: 0, y: 0 })
  const tapStartRef = useRef({ x: 0, y: 0, t: 0 })
  const angleRef = useRef(0)
  const anglePrevRef = useRef(0)
  const tsPrevRef = useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const speedsRef = useRef([])
  const playbackSpeedRef = useRef(1)
  const isReversedRef = useRef(false)
  const [angleDeg, setAngleDeg] = useState(0)
  const maxAngleRef = useRef(Math.PI * 2)
  const rafIdRef = useRef(0)
  const lastScratchTsRef = useRef(0)
  const SCRATCH_GUARD_MS = 1200

  // WebAudio engine
  const ctxRef = useRef(null)
  const gainRef = useRef(null)
  const bufFRef = useRef(null)
  const bufRRef = useRef(null)
  const srcRef = useRef(null)
  const revRef = useRef(false)
  const waBufferCacheRef = useRef(new Map())
  const coverCacheRef = useRef(new Map())
  const switchingRef = useRef(false)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [])

  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx
    const g = ctx.createGain()
    g.gain.value = 1
    g.connect(ctx.destination)
    gainRef.current = g
    return () => { try { srcRef.current?.stop(0) } catch {}; try { ctx.close() } catch {} }
  }, [])

  async function loadTrack(urlIn, opts = { activate: true }) {
    if (!urlIn) return
    const url = (() => { try { return new URL(urlIn.replace(/^\/+/, ''), import.meta.env.BASE_URL).href } catch { return urlIn } })()
    try {
      const ctx = ctxRef.current
      if (!ctx) return
      // cache hit
      const cached = waBufferCacheRef.current.get(url)
      if (cached) {
        if (opts.activate) {
          bufFRef.current = cached.f
          bufRRef.current = cached.r
          setDuration(cached.f.duration || 0)
          const v = 0.75
          maxAngleRef.current = (cached.f.duration || 0) * v * Math.PI * 2
        }
        return
      }
      // fetch & decode
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch-failed')
      const arr = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(arr.slice(0))
      const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate)
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const src = buf.getChannelData(ch)
        const dst = rev.getChannelData(ch)
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j]
      }
      waBufferCacheRef.current.set(url, { f: buf, r: rev })
      if (opts.activate) {
        bufFRef.current = buf
        bufRRef.current = rev
        setDuration(buf.duration || 0)
        const v = 0.75
        maxAngleRef.current = (buf.duration || 0) * v * Math.PI * 2
      }
    } catch {}
  }

  async function ensureCoverLoaded(track) {
    if (!track) return
    const src = track.cover || track.src
    if (!src) return
    const url = (() => { try { return new URL((track.cover || track.src).replace(/^\/+/, ''), import.meta.env.BASE_URL).href } catch { return (track.cover || track.src) } })()
    if (coverCacheRef.current.get(url)) return
    // descargar imagen (o ID3) y cachear solo para readiness
    try {
      const res = await fetch(url, { cache: 'force-cache' })
      if (!res.ok) throw new Error('cover-failed')
      coverCacheRef.current.set(url, true)
    } catch { /* ignorar; CoverFromMeta seguirá intentando */ }
  }

  function changeDirection(rev, seconds) {
    if (revRef.current === rev) return
    revRef.current = rev
    playFrom(seconds)
  }
  const stoppingRef = useRef(false)
  function pauseWA() {
    try { stoppingRef.current = true; srcRef.current?.stop(0) } catch {}
    srcRef.current = null
  }
  function playFrom(seconds = 0) {
    const ctx = ctxRef.current
    const g = gainRef.current
    const buf = revRef.current ? bufRRef.current : bufFRef.current
    if (!ctx || !g || !buf) return
    pauseWA()
    const s = ctx.createBufferSource()
    s.buffer = buf
    s.connect(g)
    const eps = 0.001
    const offs = Math.max(0, Math.min(buf.duration - eps, revRef.current ? (buf.duration - seconds) : seconds))
    s.playbackRate.value = 1
    s.start(0, offs)
    // Auto-next solo cuando termina naturalmente (no en pauses/stop manual)
    try {
      s.onended = () => {
        // Evitar rebotes: sólo auto-next si no estamos en switching o stop manual
        if (stoppingRef.current) { stoppingRef.current = false; return }
        if (switchingRef.current) return
        // Si hubo scratch recientemente, no saltar automáticamente
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        if (isDraggingRef.current || (now - lastScratchTsRef.current) < SCRATCH_GUARD_MS) {
          return
        }
        if (!tracks || tracks.length <= 1) return
        switchingRef.current = true
        setIndex((i) => (i + 1) % tracks.length)
      }
    } catch {}
    srcRef.current = s
  }
  function updateSpeed(rate, reversed, seconds) {
    const ctx = ctxRef.current
    if (!ctx) return
    changeDirection(reversed, seconds)
    const s = srcRef.current
    if (!s) return
    const now = ctx.currentTime
    const eggSlow = (typeof window !== 'undefined' && window.__eggActiveGlobal) ? 0.5 : 1
    const r = Math.max(0.001, Math.min(4, Math.abs(rate) * eggSlow))
    try { s.playbackRate.cancelScheduledValues(now); s.playbackRate.linearRampToValueAtTime(r, now + 0.05) } catch {}
  }

  useEffect(() => {
    if (current?.src) loadTrack(current.src, { activate: true })
  }, [current?.src])

  // Autoplay gateado por botón "Entrar" (prop autoStart)
  const autoplayedRef = useRef(false)
  useEffect(() => {
    if (autoplayedRef.current) return
    if (!autoStart) return
    const first = tracks && tracks.length ? (tracks.find(t => /(Skulley Rad - Station Tokyo\.mp3)$/i.test(t.src)) || tracks[0]) : null
    if (!first) return
    const idx = tracks.indexOf(first)
    ;(async () => {
      try {
        await loadTrack(first.src, { activate: true })
        await ensureCoverLoaded(first)
        angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
        if (idx >= 0) setIndex(idx)
        try { await ctxRef.current?.resume() } catch {}
        setIsPlaying(true)
        playFrom(0)
        autoplayedRef.current = true
      } catch {}
    })()
  }, [tracks, autoStart])

  function getAngle(e, el) {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const px = e.clientX ?? cx
    const py = e.clientY ?? cy
    return Math.atan2(py - cy, px - cx)
  }

  function onDown(e) {
    isDraggingRef.current = true
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0
    const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0
    draggingFromRef.current = { x: cx, y: cy }
    tapStartRef.current = { x: cx, y: cy, t: (typeof performance !== 'undefined' ? performance.now() : Date.now()) }
    if (isMobile) setIsPressing(true)
    lastScratchTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    try { el.setPointerCapture?.(e.pointerId) } catch {}
    e.preventDefault()
  }
  function onMove(e) {
    if (!isDraggingRef.current) return
    const n = { x: (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0), y: (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0) }
    const o = Math.atan2(n.y - centerRef.current.y, n.x - centerRef.current.x)
    const a = Math.atan2(draggingFromRef.current.y - centerRef.current.y, draggingFromRef.current.x - centerRef.current.x)
    const l = Math.atan2(Math.sin(a - o), Math.cos(a - o))
    angleRef.current = Math.max(0, Math.min(angleRef.current - l, maxAngleRef.current))
    draggingFromRef.current = { ...n }
    setAngleDeg((angleRef.current * 180) / Math.PI)
    lastScratchTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    e.preventDefault()
  }
  function onUp(e) {
    isDraggingRef.current = false
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
    // Tap detection (mobile): short tap with small movement toggles expanded disc
    const nx = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? draggingFromRef.current.x
    const ny = e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY) ?? draggingFromRef.current.y
    const dx = nx - tapStartRef.current.x
    const dy = ny - tapStartRef.current.y
    const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tapStartRef.current.t
    // En mobile no togglear crecimiento en click; crecimiento es sólo mientras se presiona
    if (isMobile) setIsPressing(false)
    e.preventDefault()
  }

  useEffect(() => {
    const TWO_PI = Math.PI * 2
    const v = 0.75
    const C = v * 60
    const L = C * TWO_PI
    const M = L / 60
    const b = M * 0.001
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi))
    const movingAvg = (arr, win) => { const s = Math.max(0, arr.length - win); return arr.slice(s) }
    const loop = () => {
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (!isDraggingRef.current && isPlaying) {
        const t = now - tsPrevRef.current
        let s = b * t * playbackSpeedRef.current
        s += 0.1
        s = clamp(s, 0, b * t)
        angleRef.current = clamp(angleRef.current + s, 0, maxAngleRef.current)
      }
      const t = now - tsPrevRef.current
      const s = angleRef.current - anglePrevRef.current
      const n = (M * 0.001) * t
      const speed = s / (n || 1)
      const arr = movingAvg(speedsRef.current.concat(speed), 10)
      speedsRef.current = arr
      const avg = arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
      playbackSpeedRef.current = clamp(avg, -4, 4)
      isReversedRef.current = angleRef.current < anglePrevRef.current
      anglePrevRef.current = angleRef.current
      tsPrevRef.current = now
      setAngleDeg((angleRef.current * 180) / Math.PI)
      const secondsPlayed = (angleRef.current / TWO_PI) / v
      updateSpeed(playbackSpeedRef.current, isReversedRef.current, secondsPlayed)
      setCurrentTime(secondsPlayed)
      rafIdRef.current = requestAnimationFrame(loop)
    }
    rafIdRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [isPlaying])

  // Play/Pause wiring (resumir AudioContext si está suspendido)
  useEffect(() => {
    if (!current) return
    if (switchingRef.current) return
    if (isPlaying) {
      try { if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {}) } catch {}
      const secondsPlayed = currentTime
      playFrom(secondsPlayed)
    } else {
      pauseWA()
    }
  }, [isPlaying, current])

  // Avance de pista: al cambiar index, cargar buffers WA y resetear ángulo/tiempo para mantener sincronía cover/sonido
  useEffect(() => {
    if (!hasTracks) return
    const t = tracks[Math.min(index, tracks.length - 1)]
    if (!t) return
    const url = t.src
    ;(async () => {
      switchingRef.current = true
      // uso inmediato si cacheado
      const fullUrl = (() => { try { return new URL(url.replace(/^\/+/, ''), import.meta.env.BASE_URL).href } catch { return url } })()
      const cached = waBufferCacheRef.current.get(fullUrl)
      // siempre pausa antes del switch
      pauseWA()
      // cargar buffers y cover en paralelo
      if (!cached) await loadTrack(url, { activate: true })
      else {
        bufFRef.current = cached.f; bufRRef.current = cached.r
        setDuration(cached.f.duration || 0)
        const v = 0.75
        maxAngleRef.current = (cached.f.duration || 0) * v * Math.PI * 2
      }
      await ensureCoverLoaded(t)
      // reset angular/UI y reproducir sólo cuando todo listo
      angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
      if (isPlaying) playFrom(0)
      switchingRef.current = false
    })()
  }, [index])

  return (
    <div
      ref={containerRef}
      className={isMobile ? 'music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-xl shadow-lg grid grid-rows-[auto_auto_auto_auto] gap-4 w-[min(360px,92vw)] p-10 select-none text-black' : 'music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-full shadow-lg flex items-center gap-2 max-w-[92vw] select-none text-black'}
      style={isMobile ? { paddingBottom: discExpanded ? '24px' : undefined } : { height: `${heightPx}px`, padding: `${verticalPadding}px`, width: '420px', overflow: 'visible' }}
    >
      {(() => { return (
      <div
        className={isMobile ? 'disc-wrap justify-self-center relative select-none transition-all' : 'disc-wrap shrink-0 relative select-none origin-left'}
        style={{ width: `${discSize}px`, height: `${discSize}px`, marginBottom: isMobile ? `${pushMarginPx}px` : undefined }}
        onPointerEnter={() => { if (isMobile) setIsHoverOver(true) }}
        onPointerLeave={() => { if (isMobile) setIsHoverOver(false) }}
        onTouchStart={() => { if (isMobile) setIsHoverOver(true) }}
        onTouchEnd={() => { if (isMobile) setIsHoverOver(false) }}
      >
        <div id="disc" className={`disc ${isDraggingRef.current ? 'is-scratching' : ''}`} style={{ width: '100%', height: '100%', transform: `rotate(${angleDeg}deg)` }}>
          {current?.cover ? (
            <img src={resolveUrl(current.cover)} alt="cover" className="disc__label" />
          ) : (
            <CoverFromMeta src={current?.src} className="disc__label" />
          )}
          <div className="disc__middle" />
        </div>
        <div className="disc__glare" style={{ width: `${discSize}px` }} />
        <div className="absolute inset-0" style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onTouchStart={() => {}} />
      </div>) })()}
      <div className={isMobile ? 'text-center w-full' : 'pill-content right-ui flex-1 min-w-0'} style={isMobile ? { marginTop: `${isHoveringMobile ? Math.max(16, Math.round((deltaPushPx * 0.2) + 16)) : 8}px` } : undefined}>
        {isMobile ? (
          <div className="overflow-hidden w-full">
            <div className="mx-auto inline-block max-w-[260px] whitespace-nowrap font-marquee text-[33px] sm:text-[13px] opacity-95 will-change-transform" style={{ animation: 'marquee 12s linear infinite' }}>{Array.from({ length: 2 }).map((_, i) => (<span key={i} className="mx-2">{current ? (current.title || 'Unknown title') : 'No tracks'}{current?.artist ? ` — ${current.artist}` : ''}</span>))}</div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden w-full">
              <div className="whitespace-nowrap font-marquee text-[13px] opacity-95 will-change-transform" style={{ animation: 'marquee 12s linear infinite' }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <span key={i} className="mx-3">{current ? (current.title || 'Unknown title') : 'No tracks'}{current?.artist ? ` — ${current.artist}` : ''}</span>
                ))}
              </div>
            </div>
            <div className="mt-1 h-[3px] rounded-full bg-black/10 overflow-hidden">
              <div className="h-full bg-black/70" style={{ width: `${Math.max(0, Math.min(100, (duration ? (currentTime / duration) * 100 : 0)))}%` }} />
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10px] text-black/70 tabular-nums leading-4 whitespace-nowrap">
              <span className="shrink-0">{formatTime(currentTime)}</span>
              <a
                href={resolveUrl(current?.src) || '#'}
                download
                className="mx-2 grow text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors truncate"
                title={current?.title ? `Download: ${current.title}` : 'Download this track'}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  <span>Download this track</span>
                </span>
              </a>
              <span className="shrink-0">{formatTime(duration)}</span>
            </div>
          </>
        )}
      </div>
      {isMobile && (
        <a
          href={resolveUrl(current?.src) || '#'}
          download
          className="text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors text-[12px]"
          title={current?.title ? `Download: ${current.title}` : 'Download this track'}
        >Download this track</a>
      )}
      <div className={isMobile ? 'flex items-center justify-center gap-1.5' : 'flex items-center gap-1.5'}>
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-40" disabled={!hasTracks || switchingRef.current || isDraggingRef.current || ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS} onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => {
          try { playSfx('click', { volume: 1.0 }) } catch {}
          if (!hasTracks) return
          if (switchingRef.current) return
          if (isDraggingRef.current) return
          if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS) return
          stoppingRef.current = true
          pauseWA()
          switchingRef.current = true
          setIndex((i) => (i - 1 + tracks.length) % tracks.length)
          setIsPlaying(true)
        }} aria-label="Previous">
          <BackwardIcon className="w-5 h-5" />
        </button>
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-50" onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setIsPlaying((v) => !v) }} disabled={!hasTracks} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-40" disabled={!hasTracks || switchingRef.current || isDraggingRef.current || ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS} onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => {
          try { playSfx('click', { volume: 1.0 }) } catch {}
          if (!hasTracks) return
          if (switchingRef.current) return
          if (isDraggingRef.current) return
          if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS) return
          stoppingRef.current = true
          pauseWA()
          switchingRef.current = true
          setIndex((i) => (i + 1) % tracks.length)
          setIsPlaying(true)
        }} aria-label="Next">
          <ForwardIcon className="w-5 h-5" />
        </button>
      </div>
      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}

function CoverFromMeta({ src, className }) {
  const [dataUrl, setDataUrl] = React.useState(null)
  const cacheRef = React.useRef(new Map())
  React.useEffect(() => {
    let cancelled = false
    if (!src) { setDataUrl(null); return }
    setDataUrl(null)
    const key = src
    const cached = cacheRef.current.get(key)
    if (cached) { setDataUrl(cached); return }
    ;(async () => {
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
  if (dataUrl) return <img src={dataUrl} alt="cover" className={className || ''} />
  return (
    <div className={className ? `${className} grid place-items-center` : 'grid place-items-center'}>
      <span className="inline-block w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
    </div>
  )
}


