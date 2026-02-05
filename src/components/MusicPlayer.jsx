import React, { useEffect, useRef, useState } from 'react'
import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
// Professional library for scratch with negative playbackRate without glitches
import { ReversibleAudioBufferSourceNode } from 'simple-reversible-audio-buffer-source-node'

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPlayer({
  tracks = [],
  navHeight,
  autoStart = false,
  pageHidden = false,
  // Allows parent to align "mobile mode" with hamburger menu breakpoint
  mobileBreakpointPx = 640,
  // Optional override (useful if layout depends on UI, not just viewport)
  forceMobile,
}) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isPressing, setIsPressing] = useState(false)
  const [isHoverOver, setIsHoverOver] = useState(false)
  const [discExpanded, setDiscExpanded] = useState(false)
  const [ctxReady, setCtxReady] = useState(false)
  const fallbackSetRef = useRef(new Set()) // src strings that use HTMLAudio fallback

  const hasTracks = tracks && tracks.length > 0
  const current = hasTracks ? tracks[Math.min(index, tracks.length - 1)] : null

  const containerRef = useRef(null)
  const heightPx = Math.max(40, Math.min(80, typeof navHeight === 'number' ? navHeight : 56))
  const verticalPadding = 8
  const mobileDiscBase = Math.max(110, Math.min(180, Math.round((Math.min(window.innerWidth || 360, 360) - 80) * 0.55)))
  const isHoveringMobile = isMobile
  const mobileFactor = isHoveringMobile ? 1.12 : 1
  const discSize = isMobile
    ? Math.round(mobileDiscBase * mobileFactor)
    : Math.max(36, Math.min(72, heightPx - verticalPadding * 2))
  const deltaPushPx = isMobile ? Math.max(0, (discSize - mobileDiscBase)) : 0
  const pushMarginPx = isMobile ? (isHoveringMobile ? Math.max(32, Math.round(deltaPushPx + 32)) : 16) : undefined
  const resolveUrl = (path) => {
    if (!path) return null
    try {
      const base = ((typeof window !== 'undefined' ? window.location.origin : '') + (import.meta.env.BASE_URL || '/'))
      return encodeURI(new URL(path.replace(/^\/+/, ''), base).href)
    } catch { return path }
  }

  async function handleDownloadCurrentTrack(e) {
    try { e?.preventDefault?.() } catch {}
    const track = current
    const src = track?.src
    if (!src) return
    const url = resolveUrl(src)
    const nameFromSrc = (() => {
      try {
        const u = new URL(url)
        const parts = (u.pathname || '').split('/')
        return decodeURIComponent(parts[parts.length - 1] || 'track.mp3')
      } catch {
        const parts = (src || '').split('/')
        return decodeURIComponent(parts[parts.length - 1] || 'track.mp3')
      }
    })()
    const fileName = (track?.title ? `${track.title}.mp3` : nameFromSrc).replace(/[\/:*?"<>|]+/g, ' ').trim() || 'track.mp3'
    try {
      const res = await fetch(url, { cache: 'no-cache' })
      if (!res.ok) throw new Error('download-fetch-failed')
      const blob = await res.blob()
      const type = blob?.type && blob.type !== 'application/octet-stream' ? blob.type : 'audio/mpeg'
      const fixed = blob && blob.type === type ? blob : new Blob([blob], { type })
      const objUrl = URL.createObjectURL(fixed)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = fileName
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => { try { URL.revokeObjectURL(objUrl) } catch {} }, 2500)
    } catch {
      // Fallback: navigate directly to URL (allows "Save As")
      try { window.open(url, '_blank', 'noopener') } catch {}
    }
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
  const wasScratchingRef = useRef(false) // Track previous scratch state to detect end of scratch
  const lastRateUpdateRef = useRef(0) // Timestamp of last rate update for debouncing
  const wasEggActiveRef = useRef(false) // Track previous easter egg state to detect changes
  
  // WebAudio engine (using ReversibleAudioBufferSourceNode for glitch-free scratch)
  const ctxRef = useRef(null)
  const gainRef = useRef(null)
  const bufferRef = useRef(null) // Only need one buffer, the library handles reverse
  const srcRef = useRef(null) // ReversibleAudioBufferSourceNode
  const currentPlaybackRateRef = useRef(1) // Track current playback rate
  const waBufferCacheRef = useRef(new Map())
  const currentUrlRef = useRef(null)
  const MAX_CACHE_ITEMS = 5

  function touchCacheKey(key) {
    const m = waBufferCacheRef.current
    if (!m.has(key)) return
    const v = m.get(key)
    m.delete(key)
    m.set(key, v)
  }

  function ensureCacheCapacity(keepKey) {
    const m = waBufferCacheRef.current
    while (m.size > MAX_CACHE_ITEMS) {
      let victimKey = null
      for (const k of m.keys()) { if (k !== keepKey) { victimKey = k; break } }
      if (!victimKey) break
      try {
        const val = m.get(victimKey)
        if (val) { val.f = null; val.r = null }
      } catch {}
      m.delete(victimKey)
    }
  }
  const coverCacheRef = useRef(new Map())
  const switchingRef = useRef(false)

  useEffect(() => {
    // If parent forces mode, respect it without listening to viewport
    if (typeof forceMobile === 'boolean') {
      setIsMobile(forceMobile)
      return
    }
    const bp = (typeof mobileBreakpointPx === 'number' && isFinite(mobileBreakpointPx)) ? Math.round(mobileBreakpointPx) : 640
    const mql = window.matchMedia(`(max-width: ${bp}px)`)
    const update = () => setIsMobile(Boolean(mql.matches))
    update()
    try { mql.addEventListener('change', update) } catch { window.addEventListener('resize', update) }
    return () => { try { mql.removeEventListener('change', update) } catch { window.removeEventListener('resize', update) } }
  }, [mobileBreakpointPx, forceMobile])

  useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx
    const g = ctx.createGain()
    g.gain.value = 1
    g.connect(ctx.destination)
    gainRef.current = g
    setCtxReady(true)
    return () => { try { srcRef.current?.stop(0) } catch {}; try { ctx.close() } catch {}; setCtxReady(false) }
  }, [])

  async function loadTrack(urlIn, opts = { activate: true }) {
    if (!urlIn) return false
    const url = (() => {
      try {
        const base = ((typeof window !== 'undefined' ? window.location.origin : '') + (import.meta.env.BASE_URL || '/'))
        return new URL(urlIn.replace(/^\/+/, ''), base).href
      } catch { return urlIn }
    })()
    try {
      const ctx = ctxRef.current
      if (!ctx) return false
      // cache hit
      const cached = waBufferCacheRef.current.get(url)
      if (cached) {
        touchCacheKey(url)
        if (opts.activate) {
          bufferRef.current = cached.buffer
          setDuration(cached.buffer.duration || 0)
          const v = 0.75
          maxAngleRef.current = (cached.buffer.duration || 0) * v * Math.PI * 2
          currentUrlRef.current = url
        }
        return true
      }
      // fetch & decode
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch-failed')
      const arr = await res.arrayBuffer()
      const buf = await ctx.decodeAudioData(arr.slice(0))
      // Store buffer (ReversibleAudioBufferSourceNode handles reverse internally)
      waBufferCacheRef.current.set(url, { buffer: buf })
      ensureCacheCapacity(opts.activate ? url : currentUrlRef.current)
      if (opts.activate) {
        bufferRef.current = buf
        setDuration(buf.duration || 0)
        const v = 0.75
        maxAngleRef.current = (buf.duration || 0) * v * Math.PI * 2
        currentUrlRef.current = url
      }
      return true
    } catch {
      return false
    }
  }

  async function ensureCoverLoaded(track) {
    if (!track) return
    const src = track.cover || track.src
    if (!src) return
    const url = (() => { try { return new URL((track.cover || track.src).replace(/^\/+/, ''), import.meta.env.BASE_URL).href } catch { return (track.cover || track.src) } })()
    if (coverCacheRef.current.get(url)) return
    // download image (or ID3) and cache for readiness only
    try {
      const res = await fetch(url, { cache: 'force-cache' })
      if (!res.ok) throw new Error('cover-failed')
      coverCacheRef.current.set(url, true)
    } catch { /* ignore; CoverFromMeta will keep trying */ }
  }

  const stoppingRef = useRef(false)
  
  function pauseWA() {
    try { 
      stoppingRef.current = true
      // ReversibleAudioBufferSourceNode uses stop() same as native
      srcRef.current?.stop(0) 
    } catch {}
    srcRef.current = null
  }
  
  function playFrom(seconds = 0) {
    // Fallback: use audio element if current track is marked
    if (current && fallbackSetRef.current.has(current.src)) {
      try {
        const el = audioRef.current
        if (!el) return
        if (el.src !== resolveUrl(current.src)) el.src = resolveUrl(current.src)
        el.currentTime = Math.max(0, Math.min((duration || 0) - 0.01, seconds || 0))
        el.play().catch(() => {})
      } catch {}
      return
    }
    const ctx = ctxRef.current
    const g = gainRef.current
    const buf = bufferRef.current
    if (!ctx || !g || !buf) return
    pauseWA()
    
    // Use ReversibleAudioBufferSourceNode for glitch-free scratch
    const s = new ReversibleAudioBufferSourceNode(ctx)
    s.buffer = buf
    s.connect(g)
    const eps = 0.001
    const offs = Math.max(0, Math.min(buf.duration - eps, seconds))
    s.start(0, offs)
    currentPlaybackRateRef.current = 1
    
    // Auto-next only on natural end (not on pause/manual stop)
    try {
      s.onended(() => {
        // Avoid bounces: only auto-next if not switching or manual stop
        if (stoppingRef.current) { stoppingRef.current = false; return }
        if (switchingRef.current) return
        // If there was a recent scratch, don't auto-skip
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        if (isDraggingRef.current || (now - lastScratchTsRef.current) < SCRATCH_GUARD_MS) {
          return
        }
        if (!tracks || tracks.length <= 1) return
        switchingRef.current = true
        setIndex((i) => (i + 1) % tracks.length)
      })
    } catch {}
    srcRef.current = s
  }
  
  function updateSpeed(rate, reversed, seconds, isDragging = false) {
    if (current && fallbackSetRef.current.has(current.src)) {
      // No scratch or speed changes in HTML fallback; keep normal playback
      return
    }
    const ctx = ctxRef.current
    if (!ctx) return
    
    const s = srcRef.current
    if (!s) return
    
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    
    // Easter egg: detect if active (lowers BPM to 60, i.e. playbackRate 0.5)
    const eggActive = typeof window !== 'undefined' && window.__eggActiveGlobal
    const eggSlow = eggActive ? 0.5 : 1
    const eggChanged = eggActive !== wasEggActiveRef.current
    
    // KEY: During normal playback (no scratch), do NOT touch playbackRate
    // EXCEPT when the easter egg state changes
    if (!isDragging) {
      // Detect easter egg state change
      if (eggChanged) {
        wasEggActiveRef.current = eggActive
        const newRate = eggActive ? 0.5 : 1
        if (Math.abs(currentPlaybackRateRef.current - newRate) > 0.01) {
          try {
            s.playbackRate(newRate)
            currentPlaybackRateRef.current = newRate
          } catch {}
        }
        return
      }
      
      // If we just finished a scratch, restore rate (considering easter egg)
      if (wasScratchingRef.current) {
        wasScratchingRef.current = false
        const normalRate = eggActive ? 0.5 : 1
        if (Math.abs(currentPlaybackRateRef.current - normalRate) > 0.01) {
          try {
            s.playbackRate(normalRate)
            currentPlaybackRateRef.current = normalRate
          } catch {}
        }
      }
      // Do nothing more during normal playback
      return
    }
    
    // Mark that we're scratching
    wasScratchingRef.current = true
    
    // DEBOUNCING: Limit updates during scratch to max 30/sec (~33ms each)
    // This prevents audio API overload
    const MIN_UPDATE_INTERVAL_MS = 33
    if (now - lastRateUpdateRef.current < MIN_UPDATE_INTERVAL_MS) {
      return
    }
    
    // During scratch: calculate rate with correct sign
    const targetRate = reversed ? -Math.abs(rate) : Math.abs(rate)
    
    // Clamp and apply eggSlow (easter egg also affects scratch)
    const sign = targetRate < 0 ? -1 : 1
    const clampedRate = sign * Math.max(0.001, Math.min(4, Math.abs(targetRate) * eggSlow))
    
    // LARGER THRESHOLD: Only update if significant change (> 5%)
    // This avoids micro-adjustments that cause glitches
    const threshold = Math.max(0.05, Math.abs(currentPlaybackRateRef.current) * 0.05)
    if (Math.abs(clampedRate - currentPlaybackRateRef.current) > threshold) {
      try { 
        // ReversibleAudioBufferSourceNode accepts negative values directly
        s.playbackRate(clampedRate)
        currentPlaybackRateRef.current = clampedRate
        lastRateUpdateRef.current = now
      } catch {}
    }
  }

  useEffect(() => {
    if (!current?.src) return
    // preload WA if possible; don't mark fallback here
    loadTrack(current.src, { activate: true })
  }, [current?.src])

  // Autoplay gated by "Enter" button (autoStart prop)
  const autoplayedRef = useRef(false)
  const autoplayRetriesRef = useRef(0)
  useEffect(() => {
    if (autoplayedRef.current) return
    if (!autoStart) return
    if (!ctxReady) return
    const first = tracks && tracks.length ? tracks[0] : null
    if (!first) return
    const idx = 0
    const attempt = async () => {
      try {
        const ok = await loadTrack(first.src, { activate: true })
        if (!ok || !bufferRef.current) {
          if (autoplayRetriesRef.current < 3) {
            autoplayRetriesRef.current += 1
            setTimeout(attempt, 400)
          } else {
            // Mark fallback and play with HTMLAudio
            try { fallbackSetRef.current.add(first.src) } catch {}
            try {
              const el = audioRef.current
              if (el) {
                el.src = resolveUrl(first.src)
                el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch {} }
                angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
                setIndex(idx)
                el.play().then(() => { setIsPlaying(true); autoplayedRef.current = true }).catch(() => {})
              }
            } catch {}
          }
          return
        }
        await ensureCoverLoaded(first)
        angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
        if (idx >= 0) setIndex(idx)
        try { await ctxRef.current?.resume() } catch {}
        setIsPlaying(true)
        playFrom(0)
        autoplayedRef.current = true
      } catch {
        if (autoplayRetriesRef.current < 3) {
          autoplayRetriesRef.current += 1
          setTimeout(attempt, 400)
        }
      }
    }
    setTimeout(attempt, 200)
  }, [tracks, autoStart, ctxReady])

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
    // On mobile don't toggle growth on click; growth is only while pressing
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
      if (pageHidden) { return } // stop advancing when page hidden
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
      // Detect reverse based on angle change (small threshold to avoid false positives)
      const angleDelta = angleRef.current - anglePrevRef.current
      isReversedRef.current = angleDelta < -0.001
      anglePrevRef.current = angleRef.current
      tsPrevRef.current = now
      setAngleDeg((angleRef.current * 180) / Math.PI)
      const secondsPlayed = (angleRef.current / TWO_PI) / v
      // Pass isDragging so only real scratch is allowed during drag
      updateSpeed(playbackSpeedRef.current, isReversedRef.current, secondsPlayed, isDraggingRef.current)
      setCurrentTime(secondsPlayed)
      rafIdRef.current = requestAnimationFrame(loop)
    }
    if (!pageHidden) {
      rafIdRef.current = requestAnimationFrame(loop)
    }
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [isPlaying, pageHidden])

  const switchAttemptsRef = useRef(0)
  // Track advance: on index change, load WA buffers and reset angle/time to keep cover/sound in sync
  useEffect(() => {
    if (!hasTracks) return
    const t = tracks[Math.min(index, tracks.length - 1)]
    if (!t) return
    const url = t.src
    ;(async () => {
      switchingRef.current = true
      // use immediately if cached
      const fullUrl = (() => {
        try {
          const base = ((typeof window !== 'undefined' ? window.location.origin : '') + (import.meta.env.BASE_URL || '/'))
          return new URL(url.replace(/^\/+/, ''), base).href
        } catch { return url }
      })()
      const cached = waBufferCacheRef.current.get(fullUrl)
      // always pause before switching
      pauseWA()
      // Per-track fallback: use HTMLAudio directly if already marked
      if (fallbackSetRef.current.has(t.src)) {
        try {
          const el = audioRef.current
          if (el) {
            el.src = resolveUrl(t.src)
            el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch {} }
            angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
            if (isPlaying) el.play().catch(() => {})
            switchAttemptsRef.current = 0
            switchingRef.current = false
            return
          }
        } catch {}
      }
      // load buffer and cover in parallel
      let ok = true
      if (!cached) ok = await loadTrack(url, { activate: true })
      else {
        bufferRef.current = cached.buffer
        setDuration(cached.buffer.duration || 0)
        const v = 0.75
        maxAngleRef.current = (cached.buffer.duration || 0) * v * Math.PI * 2
      }
      if (!bufferRef.current || !ok) {
        // Mark fallback and play this SAME track with HTMLAudio
        try { fallbackSetRef.current.add(t.src) } catch {}
        try {
          const el = audioRef.current
          if (el) {
            el.src = resolveUrl(t.src)
            el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch {} }
            angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
            if (isPlaying) el.play().catch(() => {})
            switchAttemptsRef.current = 0
            switchingRef.current = false
            return
          }
        } catch {}
      }
      await ensureCoverLoaded(t)
      // reset angle/UI and play only when everything is ready
      angleRef.current = 0; anglePrevRef.current = 0; setAngleDeg(0); setCurrentTime(0)
      if (isPlaying) playFrom(0)
      switchAttemptsRef.current = 0
      switchingRef.current = false
    })()
  }, [index])

  // Keep currentTime synchronized with HTMLAudio in fallback
  useEffect(() => {
    const t = current
    if (!t) return () => {}
    if (!fallbackSetRef.current.has(t.src)) return () => {}
    const el = audioRef.current
    if (!el) return () => {}
    const onTime = () => { try { setCurrentTime(el.currentTime || 0) } catch {} }
    const onEnd = () => { try { setIsPlaying(false) } catch {} }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnd) }
  }, [current?.src])

  // Play/Pause wiring (resume AudioContext if suspended)
  useEffect(() => {
    if (!current) return
    if (switchingRef.current) return
    if (isPlaying) {
      // HTML fallback: use native audio element
      if (fallbackSetRef.current.has(current.src)) {
        try {
          const el = audioRef.current
          if (el) {
            if (el.src !== resolveUrl(current.src)) el.src = resolveUrl(current.src)
            el.play().catch(() => {})
          }
        } catch {}
        return
      }
      try { if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => {}) } catch {}
      const secondsPlayed = currentTime
      playFrom(secondsPlayed)
    } else {
      if (fallbackSetRef.current.has(current.src)) {
        try { audioRef.current?.pause() } catch {}
      } else {
        pauseWA()
      }
    }
  }, [isPlaying, current])

  return (
    <div
      ref={containerRef}
      className={isMobile ? 'music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-xl shadow-lg grid grid-rows-[auto_auto_auto_auto] gap-4 w-[min(360px,92vw)] p-10 select-none text-black' : 'music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-full shadow-lg flex items-center gap-2 max-w-[92vw] select-none text-black'}
      // Note: avoid mixing `padding` (shorthand) with `paddingBottom` to prevent React warning.
      style={isMobile
        ? { paddingBottom: discExpanded ? '24px' : undefined }
        : {
            height: `${heightPx}px`,
            paddingTop: `${verticalPadding}px`,
            paddingRight: `${verticalPadding}px`,
            paddingBottom: `${verticalPadding}px`,
            paddingLeft: `${verticalPadding}px`,
            width: '420px',
            overflow: 'visible',
          }}
    >
      {(() => { return (
      <div
        className={isMobile ? 'disc-wrap always-expanded justify-self-center relative select-none transition-all' : 'disc-wrap always-expanded shrink-0 relative select-none origin-left'}
        style={{ width: `${discSize}px`, height: `${discSize}px`, marginBottom: isMobile ? `${pushMarginPx}px` : undefined }}
        onPointerEnter={() => { if (isMobile) setIsHoverOver(true) }}
        onPointerLeave={() => { if (isMobile) setIsHoverOver(false) }}
        onTouchStart={() => { if (isMobile) setIsHoverOver(true) }}
        onTouchEnd={() => { if (isMobile) setIsHoverOver(false) }}
      >
        <div id="disc" className={`disc ${isDraggingRef.current ? 'is-scratching' : ''}`} style={{ width: '100%', height: '100%', transform: `rotate(${angleDeg}deg)` }}>
          {current?.cover ? (
            <img src={resolveUrl(current.cover)} alt={t('music.coverAlt')} className="disc__label" />
          ) : (
            <CoverFromMeta src={current?.src} className="disc__label" alt={t('music.coverAlt')} />
          )}
          <div className="disc__middle" />
        </div>
        <div className="disc__glare" style={{ width: `${discSize}px` }} />
        <div className="absolute inset-0" style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onTouchStart={() => {}} />
      </div>) })()}
      <div className={isMobile ? 'text-center w-full' : 'pill-content right-ui flex-1 min-w-0'} style={isMobile ? { marginTop: `${isHoveringMobile ? Math.max(16, Math.round((deltaPushPx * 0.2) + 16)) : 8}px` } : undefined}>
        {isMobile ? (
          <div className="overflow-hidden w-full">
            <div className="mx-auto inline-block max-w-[260px] whitespace-nowrap font-marquee text-[33px] sm:text-[13px] opacity-95 will-change-transform" style={{ animation: 'marquee 12s linear infinite' }}>{Array.from({ length: 2 }).map((_, i) => (<span key={i} className="mx-2">{current ? (current.title || t('music.unknownTitle')) : t('music.noTracks')}{current?.artist ? ` — ${current.artist}` : ''}</span>))}</div>
          </div>
        ) : (
          <>
            <div className="overflow-hidden w-full">
              <div className="whitespace-nowrap font-marquee text-[13px] opacity-95 will-change-transform" style={{ animation: 'marquee 12s linear infinite' }}>
                {Array.from({ length: 2 }).map((_, i) => (
                  <span key={i} className="mx-3">{current ? (current.title || t('music.unknownTitle')) : t('music.noTracks')}{current?.artist ? ` — ${current.artist}` : ''}</span>
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
                onClick={handleDownloadCurrentTrack}
                className="mx-2 grow text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors truncate"
                title={current?.title ? t('music.downloadTitle', { title: current.title }) : t('music.downloadThisTrack')}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  <span>{t('music.downloadThisTrack')}</span>
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
          onClick={handleDownloadCurrentTrack}
          className="text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors text-[12px]"
          title={current?.title ? t('music.downloadTitle', { title: current.title }) : t('music.downloadThisTrack')}
        >{t('music.downloadThisTrack')}</a>
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
        }} aria-label={t('music.previous')}>
          <BackwardIcon className="w-5 h-5" />
        </button>
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-50" onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {} setIsPlaying((v) => !v) }} disabled={!hasTracks} aria-label={isPlaying ? t('music.pause') : t('music.play')}>
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
        }} aria-label={t('music.next')}>
          <ForwardIcon className="w-5 h-5" />
        </button>
      </div>
      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}

function CoverFromMeta({ src, className, alt }) {
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
  if (dataUrl) return <img src={dataUrl} alt={alt || ''} className={className || ''} />
  return (
    <div className={className ? `${className} grid place-items-center` : 'grid place-items-center'}>
      <span className="inline-block w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
    </div>
  )
}


