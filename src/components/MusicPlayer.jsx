import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowsRightLeftIcon, ChevronUpIcon, ChevronDownIcon, SquaresPlusIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
// Local patched version — fixes stereo collapse bug in the original library
// (ChannelMergerNode → GainNode to preserve L/R channels)
import {
  ReversibleAudioBufferSourceNode,
  reverseAudioBuffer,
} from '../lib/ReversibleAudioBufferSourceNode.js'

// Vinyl color palettes keyed by track vinylColor value
// Intense, vivid colors — like real colored vinyl records under stage lights
const VINYL_COLORS = {
  red:    { c1: '#e01b1b', c2: '#b81414', c3: '#6e0a0a', hl: 'rgba(255,80,80,0.18)' },
  black:  { c1: '#555555', c2: '#333333', c3: '#111111', hl: 'rgba(255,255,255,0.10)' },
  yellow: { c1: '#e8c812', c2: '#c4a80e', c3: '#7a6a08', hl: 'rgba(255,230,50,0.20)' },
  blue:   { c1: '#1a5cff', c2: '#1248d4', c3: '#0a2e8a', hl: 'rgba(80,140,255,0.18)' },
  purple: { c1: '#9b2aed', c2: '#7b1ec4', c3: '#4c1080', hl: 'rgba(180,100,255,0.18)' },
  teal:   { c1: '#12ccb3', c2: '#0ea894', c3: '#08705e', hl: 'rgba(80,255,220,0.18)' },
  green:  { c1: '#30d418', c2: '#26ac12', c3: '#14700a', hl: 'rgba(100,255,80,0.18)' },
  orange: { c1: '#f07818', c2: '#cc6212', c3: '#884008', hl: 'rgba(255,160,60,0.20)' },
  pink:   { c1: '#f0289a', c2: '#c81e7e', c3: '#80124e', hl: 'rgba(255,80,180,0.18)' },
}

function getVinylStyle(colorKey) {
  const palette = VINYL_COLORS[colorKey] || VINYL_COLORS.red
  return {
    '--vinyl-c1': palette.c1,
    '--vinyl-c2': palette.c2,
    '--vinyl-c3': palette.c3,
    '--vinyl-hl': palette.hl,
  }
}

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
  const [repeatOne, setRepeatOne] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [ctxReady, setCtxReady] = useState(false)
  const fallbackSetRef = useRef(new Set()) // src strings that use HTMLAudio fallback

  const repeatOneRef = useRef(repeatOne)
  repeatOneRef.current = repeatOne
  const shuffleRef = useRef(shuffle)
  shuffleRef.current = shuffle
  const indexRef = useRef(index)
  indexRef.current = index
  const tracksRef = useRef(tracks)
  tracksRef.current = tracks

  const hasTracks = tracks && tracks.length > 0
  const current = hasTracks ? tracks[Math.min(index, tracks.length - 1)] : null

  // Stable "random" rotations for vinyl cases (seeded by index, won't change on re-render)
  const caseRotations = useMemo(() =>
    (tracks || []).map((_, i) => {
      const seed = ((i * 7 + 3) * 13 + i * i) % 17
      return (seed - 8) * 1.1 // range: roughly -9 to +9 degrees
    }), [tracks.length])

  // Select a specific track by index (used by vinyl cases)
  function selectTrack(trackIdx) {
    if (trackIdx === index) return
    if (switchingRef.current) return
    if (isDraggingRef.current) return
    try { playSfx('click', { volume: 1.0 }) } catch {}
    stoppingRef.current = true
    pauseWA()
    switchingRef.current = true
    setIndex(trackIdx)
    setIsPlaying(true)
  }

  // Helper: get next index respecting shuffle.
  // Reads shuffle state from ref so it's always current, even in stale closures.
  function getNextIndex(currentIdx) {
    const t = tracksRef.current
    const len = t ? t.length : 0
    if (len <= 1) return 0
    if (shuffleRef.current) {
      let r = currentIdx
      while (r === currentIdx) r = Math.floor(Math.random() * len)
      return r
    }
    return (currentIdx + 1) % len
  }

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
  const discElRef = useRef(null) // Direct DOM ref for disc — avoids React re-renders
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
  const maxAngleRef = useRef(Math.PI * 2)
  const rafIdRef = useRef(0)
  const lastScratchTsRef = useRef(0)
  const SCRATCH_GUARD_MS = 1200
  const wasScratchingRef = useRef(false) // Track previous scratch state to detect end of scratch
  const lastRateUpdateRef = useRef(0) // Timestamp of last rate update for debouncing
  const wasEggActiveRef = useRef(false) // Track previous easter egg state to detect changes
  const needsRestartRef = useRef(false) // Flags that the source died during scratch and needs restart
  const sourceIdRef = useRef(0) // Incremental ID to invalidate stale onended handlers from old sources
  const nearEndFramesRef = useRef(0) // Counter: consecutive frames where angle-derived time is near end
  const NEAR_END_THRESHOLD = 0.8 // seconds before end to start checking
  const NEAR_END_CONFIRM_FRAMES = 15 // ~250ms at 60fps — sustained near-end before fallback triggers
  
  // WebAudio engine (using ReversibleAudioBufferSourceNode for glitch-free scratch)
  const ctxRef = useRef(null)
  const gainRef = useRef(null)
  const filterRef = useRef(null) // BiquadFilterNode — low-pass for analog scratch feel
  const bufferRef = useRef(null) // Raw decoded AudioBuffer (for duration/offset math)
  const srcRef = useRef(null) // ReversibleAudioBufferSourceNode
  const currentPlaybackRateRef = useRef(1) // Track current playback rate
  const currentTimeRef = useRef(0) // Accurate current time (updated every frame)
  const lastTimeUpdateRef = useRef(0) // Timestamp for throttling React state updates
  const waBufferCacheRef = useRef(new Map())
  const currentUrlRef = useRef(null)
  // Only cache current + one prefetch to reduce memory (decoded PCM is ~95 MB per 4-min stereo track)
  const MAX_CACHE_ITEMS = 2

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
        if (val) { val.buffer = null; val.reversed = null }
      } catch {}
      m.delete(victimKey)
    }
  }
  const coverCacheRef = useRef(new Map())
  const switchingRef = useRef(false)

  // --- Performance helpers ---
  // Updates the disc rotation via direct DOM mutation (no React re-render)
  function setDiscRotation(deg) {
    if (discElRef.current) discElRef.current.style.transform = `rotate(${deg}deg)`
  }
  // Resets angle, disc rotation, and time — called on track switch / restart
  function resetDiscAndTime() {
    angleRef.current = 0
    anglePrevRef.current = 0
    setDiscRotation(0)
    currentTimeRef.current = 0
    setCurrentTime(0)
  }

  // Helper: restart current track (for repeat-one)
  const restartCurrentTrack = useCallback(() => {
    resetDiscAndTime()
    playFrom(0)
  }, [])

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
    // Low-pass filter for analog vinyl scratch simulation.
    // During normal playback: frequency at max (transparent).
    // During scratch: frequency tracks playback rate — slower = more muffled,
    // exactly like a real turntable where high frequencies drop as RPM decreases.
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 22050 // transparent at normal speed
    lp.Q.value = 0.7 // gentle resonance — avoids harsh peak
    lp.connect(g)
    filterRef.current = lp
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
      // Store raw buffer now; compute reversed lazily to avoid blocking main thread.
      // The reversed buffer is only needed if user scratches backward — computed via
      // setTimeout so it doesn't block the current frame.
      waBufferCacheRef.current.set(url, { buffer: buf, reversed: null })
      ensureCacheCapacity(opts.activate ? url : currentUrlRef.current)
      if (opts.activate) {
        bufferRef.current = buf
        setDuration(buf.duration || 0)
        const v = 0.75
        maxAngleRef.current = (buf.duration || 0) * v * Math.PI * 2
        currentUrlRef.current = url
      }
      // Lazy reversed buffer computation — runs after current tasks complete
      const capturedUrl = url
      setTimeout(() => {
        try {
          const entry = waBufferCacheRef.current.get(capturedUrl)
          if (!entry || entry.reversed) return // already computed or evicted
          const c = ctxRef.current
          if (!c) return
          entry.reversed = reverseAudioBuffer(c, entry.buffer)
        } catch { /* ignore — playFrom will compute on the fly if needed */ }
      }, 0)
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
    // Increment sourceId so any async onended from this source is ignored
    sourceIdRef.current += 1
    try { 
      stoppingRef.current = true
      srcRef.current?.stop(0) 
    } catch {}
    srcRef.current = null
  }
  
  function playFrom(seconds = 0) {
    // Clear stale restart flag when a new source is created
    needsRestartRef.current = false
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

    // --- Gapless resume strategy ---
    // Prepare the NEW source BEFORE stopping the old one. The only potentially
    // slow operation is position-channel creation (~40ms for a 4-min track),
    // which happens while old audio is still playing — no audible gap.
    // If a cached reversed buffer exists, skip the expensive reversal entirely.
    const cacheEntry = waBufferCacheRef.current.get(currentUrlRef.current)
    const reversed = cacheEntry?.reversed

    const s = new ReversibleAudioBufferSourceNode(ctx)
    if (reversed) {
      // Use cached reversed buffer — skips reverseAudioBuffer (~80ms savings).
      // Position channels are still created by the library (~40ms) but this
      // happens while the old source keeps playing.
      s.buffer = { forward: buf, reverse: reversed }
    } else {
      // Reversed not cached yet (first ~100ms after load) — library computes all
      s.buffer = buf
    }
    // Connect through the low-pass filter for analog scratch sound.
    // Chain: source → filter (low-pass) → gain → destination
    const filterNode = filterRef.current
    s.connect(filterNode || g)
    const eps = 0.001
    const offs = Math.max(0, Math.min(buf.duration - eps, seconds))

    // Now stop old source — preparation is done, so stop+start happen in the
    // same JS frame / audio quantum (~3ms), eliminating the audible gap.
    pauseWA()

    s.start(0, offs)
    currentPlaybackRateRef.current = 1
    
    // Capture a unique ID for THIS source so stale onended handlers
    // from old/zombie sources (caused by direction switches inside the library)
    // are safely ignored.
    const mySourceId = sourceIdRef.current
    
    try {
      s.onended = () => {
        // Ignore stale onended from previous sources or direction-switch ghosts.
        // The library internally stops/starts AudioBufferSourceNodes on every
        // direction change, which can fire onended on sources we no longer own.
        if (mySourceId !== sourceIdRef.current) return
        if (stoppingRef.current) { stoppingRef.current = false; return }
        if (switchingRef.current) return
        // If there was a recent scratch, don't auto-skip — but flag for restart
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
        if (isDraggingRef.current || (now - lastScratchTsRef.current) < SCRATCH_GUARD_MS) {
          needsRestartRef.current = true
          return
        }
        // Extra safety: verify the track was actually near its end.
        // The angle-derived time should be within 2 seconds of the duration.
        // If not, this onended is likely a spurious fire — restart instead of skipping.
        const derivedSecs = currentTimeRef.current
        const trackDur = bufferRef.current?.duration || duration || 0
        if (trackDur > 0 && derivedSecs < trackDur - 2.0) {
          // Audio ended but we're not near the end — spurious fire, restart playback
          needsRestartRef.current = true
          return
        }
        // Repeat-one: restart same track instead of advancing
        if (repeatOneRef.current) {
          resetDiscAndTime()
          playFrom(0)
          return
        }
        const t = tracksRef.current
        if (!t || t.length <= 1) return
        switchingRef.current = true
        setIndex((i) => getNextIndex(i))
      }
    } catch {}
    srcRef.current = s
    // Reset stoppingRef: pauseWA set it to true, but with sourceId protection
    // the old source's async onended is ignored and will never clear it.
    // We must clear it here so the NEW source's onended works for auto-next.
    stoppingRef.current = false
  }
  
  function updateSpeed(rate, reversed, seconds, isDragging = false) {
    if (current && fallbackSetRef.current.has(current.src)) {
      // No scratch or speed changes in HTML fallback; keep normal playback
      return
    }
    const ctx = ctxRef.current
    if (!ctx) return
    
    const s = srcRef.current
    if (!s) {
      // Source is null — if we're actively dragging, flag for restart so
      // the animation loop recreates the source once drag ends
      if (isDragging) needsRestartRef.current = true
      return
    }
    
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const lp = filterRef.current
    
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
      
      // If we just finished a scratch, restore rate and filter (considering easter egg)
      if (wasScratchingRef.current) {
        wasScratchingRef.current = false
        const normalRate = eggActive ? 0.5 : 1
        if (Math.abs(currentPlaybackRateRef.current - normalRate) > 0.01) {
          try {
            s.playbackRate(normalRate)
            currentPlaybackRateRef.current = normalRate
          } catch {}
        }
        // Restore filter to transparent — smooth ramp back to full frequency
        if (lp) {
          try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch {}
          lp.frequency.setTargetAtTime(22050, ctx.currentTime, 0.06)
        }
      }
      // Do nothing more during normal playback
      return
    }
    
    // Mark that we're scratching
    wasScratchingRef.current = true
    
    // DEBOUNCING: Limit updates during scratch to ~60/sec (16ms each)
    // Smoother updates = more analog-feeling scratch
    const MIN_UPDATE_INTERVAL_MS = 16
    if (now - lastRateUpdateRef.current < MIN_UPDATE_INTERVAL_MS) {
      return
    }
    
    // During scratch: calculate rate with correct sign
    const targetRate = reversed ? -Math.abs(rate) : Math.abs(rate)
    
    // Clamp and apply eggSlow (easter egg also affects scratch)
    const sign = targetRate < 0 ? -1 : 1
    const clampedRate = sign * Math.max(0.001, Math.min(4, Math.abs(targetRate) * eggSlow))
    
    // --- Analog vinyl filter: track playback rate ---
    // Real vinyl: high frequencies drop as RPM decreases.
    // Map |rate| to low-pass cutoff frequency with a natural curve.
    // rate 1.0 → 22050 Hz (transparent), 0.5 → ~11000 Hz, 0.1 → ~2500 Hz
    // rate 0.01 → ~400 Hz (deep muffled rumble, like stopping a record)
    if (lp) {
      const absRate = Math.abs(clampedRate)
      // Use a power curve for more natural rolloff (vinyl physics)
      const filterFreq = Math.max(300, Math.min(22050, 300 + Math.pow(absRate, 0.6) * 21750))
      // setTargetAtTime gives smooth exponential ramp — no clicks or zipper noise
      try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch {}
      lp.frequency.setTargetAtTime(filterFreq, ctx.currentTime, 0.015)
    }
    
    // Only update playbackRate if significant change (> 3%)
    // This avoids micro-adjustments that cause glitches
    const threshold = Math.max(0.03, Math.abs(currentPlaybackRateRef.current) * 0.03)
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
                resetDiscAndTime()
                setIndex(idx)
                el.play().then(() => { setIsPlaying(true); autoplayedRef.current = true }).catch(() => {})
              }
            } catch {}
          }
          return
        }
        await ensureCoverLoaded(first)
        resetDiscAndTime()
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
    // Update disc class via DOM directly (no re-render needed)
    if (discElRef.current) discElRef.current.classList.add('is-scratching')
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
    // Direct DOM mutation — no React re-render for disc rotation during scratch
    setDiscRotation((angleRef.current * 180) / Math.PI)
    lastScratchTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    e.preventDefault()
  }
  function onUp(e) {
    const wasDragging = isDraggingRef.current
    isDraggingRef.current = false
    // Update disc class via DOM directly
    if (discElRef.current) discElRef.current.classList.remove('is-scratching')
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
    // Tap detection (mobile): short tap with small movement toggles expanded disc
    const nx = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? draggingFromRef.current.x
    const ny = e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY) ?? draggingFromRef.current.y
    const dx = nx - tapStartRef.current.x
    const dy = ny - tapStartRef.current.y
    const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tapStartRef.current.t
    // On mobile don't toggle growth on click; growth is only while pressing
    if (isMobile) setIsPressing(false)

    // After scratch: ALWAYS restart audio from the current angle position.
    // The ReversibleAudioBufferSourceNode internally creates/destroys
    // AudioBufferSourceNodes on every direction switch, which can leave the
    // internal nodes in a dead state. A clean restart guarantees audio resumes.
    if (wasDragging && isPlaying && !switchingRef.current) {
      needsRestartRef.current = false
      wasScratchingRef.current = false
      // Reset speed history to normal (1.0) so the disc resumes spinning
      // immediately. Without this, the moving average of scratch-speed samples
      // (negative, zero, or erratic) causes visible lag for ~10 frames.
      speedsRef.current = [1]
      playbackSpeedRef.current = 1
      // Keep lastScratchTsRef at a recent timestamp (don't zero it) so the
      // SCRATCH_GUARD_MS window still protects against spurious onended fires
      // from the old source that might arrive after the new source starts.
      lastScratchTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // Immediately restore the low-pass filter to transparent with a smooth ramp.
      // This creates the characteristic "record speeding back up" sound.
      const lp = filterRef.current
      const ctx = ctxRef.current
      if (lp && ctx) {
        try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch {}
        lp.frequency.setTargetAtTime(22050, ctx.currentTime, 0.08)
      }
      const TWO_PI = Math.PI * 2
      const v = 0.75
      const secs = (angleRef.current / TWO_PI) / v
      const dur = duration || 0
      const safeSec = Math.max(0, Math.min(secs, dur > 0 ? dur - 0.05 : 0))
      if (dur > 0) {
        playFrom(safeSec)
      }
    }

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

      // Direct DOM mutation for disc rotation — avoids React re-render
      setDiscRotation((angleRef.current * 180) / Math.PI)

      const secondsPlayed = (angleRef.current / TWO_PI) / v
      // Pass isDragging so only real scratch is allowed during drag
      updateSpeed(playbackSpeedRef.current, isReversedRef.current, secondsPlayed, isDraggingRef.current)

      // Always keep the accurate time ref up to date
      currentTimeRef.current = secondsPlayed
      // Throttle React state updates to ~4fps — time display doesn't need 60fps
      if (now - lastTimeUpdateRef.current > 250) {
        setCurrentTime(secondsPlayed)
        lastTimeUpdateRef.current = now
      }

      // Safety net: restart audio if the source died during scratch and
      // onUp didn't fire (e.g. pointer cancel on mobile, focus loss).
      // playFrom() internally resets stoppingRef via sourceId protection.
      if (isPlaying && !isDraggingRef.current && !switchingRef.current && needsRestartRef.current) {
        needsRestartRef.current = false
        wasScratchingRef.current = false
        lastScratchTsRef.current = 0
        const safeSec = Math.max(0, Math.min(secondsPlayed, (duration || 0) - 0.05))
        playFrom(safeSec)
      }

      // Fallback end-of-track detection: if the angle-derived time is near the end
      // for a sustained number of frames, trigger auto-next.
      // This is a safety net for rare cases where onended doesn't fire.
      // Uses a generous threshold (0.8s) + confirmation counter (~250ms at 60fps)
      // to avoid premature skipping from minor angle drift.
      const dur = duration
      if (isPlaying && !isDraggingRef.current && !switchingRef.current && dur > 0 && secondsPlayed >= dur - NEAR_END_THRESHOLD) {
        const recentScratch = (now - lastScratchTsRef.current) < SCRATCH_GUARD_MS
        if (!recentScratch) {
          nearEndFramesRef.current += 1
          if (nearEndFramesRef.current >= NEAR_END_CONFIRM_FRAMES) {
            nearEndFramesRef.current = 0
            // Repeat-one: restart same track
            if (repeatOneRef.current) {
              resetDiscAndTime()
              playFrom(0)
              return
            }
            if (tracksRef.current && tracksRef.current.length > 1) {
              switchingRef.current = true
              stoppingRef.current = true
              pauseWA()
              setIndex((i) => getNextIndex(i))
              return
            }
          }
        } else {
          nearEndFramesRef.current = 0
        }
      } else {
        nearEndFramesRef.current = 0
      }

      rafIdRef.current = requestAnimationFrame(loop)
    }
    if (!pageHidden) {
      rafIdRef.current = requestAnimationFrame(loop)
    }
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [isPlaying, pageHidden, duration, tracks])

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
            resetDiscAndTime()
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
            resetDiscAndTime()
            if (isPlaying) el.play().catch(() => {})
            switchAttemptsRef.current = 0
            switchingRef.current = false
            return
          }
        } catch {}
      }
      await ensureCoverLoaded(t)
      // reset angle/UI and play only when everything is ready
      resetDiscAndTime()
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
      // Use the accurate ref instead of (potentially stale) React state
      const secondsPlayed = currentTimeRef.current
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
    <div className="flex items-center gap-5">
    {/* --- Player pill --- */}
    <div
      ref={containerRef}
      className={isMobile ? 'music-pill shrink-0 pointer-events-auto relative bg-white/95 backdrop-blur rounded-xl shadow-lg grid grid-rows-[auto_auto_auto_auto] gap-4 w-[min(360px,92vw)] p-10 select-none text-black' : 'music-pill shrink-0 pointer-events-auto relative bg-white/95 backdrop-blur rounded-full shadow-lg flex items-center gap-2 max-w-[92vw] select-none text-black'}
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
        style={{ width: `${discSize}px`, height: `${discSize}px`, marginBottom: isMobile ? `${pushMarginPx}px` : undefined, ...getVinylStyle(current?.vinylColor) }}
        onPointerEnter={() => { if (isMobile) setIsHoverOver(true) }}
        onPointerLeave={() => { if (isMobile) setIsHoverOver(false) }}
        onTouchStart={() => { if (isMobile) setIsHoverOver(true) }}
        onTouchEnd={() => { if (isMobile) setIsHoverOver(false) }}
      >
        <div ref={discElRef} id="disc" className="disc" style={{ width: '100%', height: '100%' }}>
          {current?.cover ? (
            <img src={resolveUrl(current.cover)} alt={t('music.coverAlt')} className="disc__label" />
          ) : (
            <CoverFromMeta src={current?.src} className="disc__label" alt={t('music.coverAlt')} />
          )}
          <div className="disc__middle" />
          {/* DJ cue dot — visual reference for scratch position */}
          <span className="disc__cue-dot" aria-hidden="true" />
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
        {/* Shuffle toggle */}
        <button
          type="button"
          className={`p-2 rounded-full transition-colors ${shuffle ? 'bg-black/20 text-black' : 'hover:bg-black/10'}`}
          disabled={!hasTracks}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setShuffle((v) => !v) }}
          aria-label={shuffle ? t('music.shuffleOn') : t('music.shuffleOff')}
          title={shuffle ? t('music.shuffleOn') : t('music.shuffleOff')}
        >
          <ArrowsRightLeftIcon className="w-5 h-5" />
        </button>
        {/* Previous */}
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
        {/* Play / Pause */}
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-50" onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setIsPlaying((v) => !v) }} disabled={!hasTracks} aria-label={isPlaying ? t('music.pause') : t('music.play')}>
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>
        {/* Next */}
        <button type="button" className="p-2 rounded-full hover:bg-black/10 disabled:opacity-40" disabled={!hasTracks || switchingRef.current || isDraggingRef.current || ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS} onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }} onClick={() => {
          try { playSfx('click', { volume: 1.0 }) } catch {}
          if (!hasTracks) return
          if (switchingRef.current) return
          if (isDraggingRef.current) return
          if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS) return
          stoppingRef.current = true
          pauseWA()
          switchingRef.current = true
          setIndex((i) => getNextIndex(i))
          setIsPlaying(true)
        }} aria-label={t('music.next')}>
          <ForwardIcon className="w-5 h-5" />
        </button>
        {/* Repeat-one toggle */}
        <button
          type="button"
          className={`relative p-2 rounded-full transition-colors ${repeatOne ? 'bg-black/20 text-black' : 'hover:bg-black/10'}`}
          disabled={!hasTracks}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch {} }}
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch {}; setRepeatOne((v) => !v) }}
          aria-label={repeatOne ? t('music.repeatOn') : t('music.repeatOff')}
          title={repeatOne ? t('music.repeatOn') : t('music.repeatOff')}
        >
          <ArrowPathIcon className="w-5 h-5" />
          {repeatOne && <span className="absolute top-0.5 right-0.5 text-[8px] font-bold leading-none">1</span>}
        </button>
      </div>
      <audio ref={audioRef} preload="metadata" />
    </div>
    {/* --- Vinyl cases with scroll arrows (right side) --- */}
    {hasTracks && tracks.length > 1 && (
      <VinylCasesColumn
        tracks={tracks}
        index={index}
        caseRotations={caseRotations}
        selectTrack={selectTrack}
        playSfx={playSfx}
      />
    )}
    </div>
  )
}

// --- Vinyl cases column with infinite scroll + auto-center on active ---
const INFINITE_COPIES = 5 // render N copies of tracks for seamless infinite loop

function VinylCasesColumn({ tracks, index, caseRotations, selectTrack, playSfx }) {
  const scrollRef = React.useRef(null)
  const [visible, setVisible] = React.useState(true)
  const [animClass, setAnimClass] = React.useState('') // '', 'entering', 'leaving'
  const animTimerRef = React.useRef(null)
  const teleportingRef = React.useRef(false) // prevent scroll handler re-entrance during teleport
  const prevIndexRef = React.useRef(index)
  const total = tracks.length
  const centerCopy = Math.floor(INFINITE_COPIES / 2) // middle copy index

  // Cleanup animation timer on unmount
  React.useEffect(() => () => clearTimeout(animTimerRef.current), [])

  // --- Infinite scroll: teleport when near edges ---
  const handleScroll = React.useCallback(() => {
    const el = scrollRef.current
    if (!el || teleportingRef.current) return
    const copyHeight = el.scrollHeight / INFINITE_COPIES
    // Threshold: if within 0.8 of a copy from top or bottom, teleport to center
    if (el.scrollTop < copyHeight * 0.8) {
      teleportingRef.current = true
      el.scrollTop += copyHeight
      requestAnimationFrame(() => { teleportingRef.current = false })
    } else if (el.scrollTop > copyHeight * (INFINITE_COPIES - 1.8)) {
      teleportingRef.current = true
      el.scrollTop -= copyHeight
      requestAnimationFrame(() => { teleportingRef.current = false })
    }
  }, [total])

  // Attach scroll listener
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // --- Scroll to center the active case in the center copy ---
  const scrollToActive = React.useCallback((behavior = 'smooth') => {
    const el = scrollRef.current
    if (!el || !visible) return
    const targetChildIdx = centerCopy * total + index
    const child = el.children[targetChildIdx]
    if (!child) return
    // Use getBoundingClientRect for accurate position regardless of offsetParent
    const elRect = el.getBoundingClientRect()
    const childRect = child.getBoundingClientRect()
    // Child's center position within the scrollable content
    const childCenterInContent = (childRect.top - elRect.top) + el.scrollTop + childRect.height / 2
    const containerCenter = el.clientHeight / 2
    const targetScroll = childCenterInContent - containerCenter
    if (behavior === 'instant') {
      teleportingRef.current = true
      el.scrollTop = targetScroll
      requestAnimationFrame(() => { teleportingRef.current = false })
    } else {
      el.scrollTo({ top: targetScroll, behavior: 'smooth' })
    }
  }, [index, visible, total, centerCopy])

  // Initial scroll: position at center copy (instant, no animation)
  React.useEffect(() => {
    if (!visible) return
    // Use double rAF to ensure DOM is fully laid out before measuring
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToActive('instant')))
  }, []) // only on mount

  // Auto-scroll when active track changes
  React.useEffect(() => {
    if (prevIndexRef.current !== index) {
      prevIndexRef.current = index
      if (visible) {
        // Small delay so the active class is applied first (size change)
        requestAnimationFrame(() => scrollToActive('smooth'))
      }
    }
  }, [index, visible, scrollToActive])

  const scrollByAmount = (dir) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ top: dir * 120, behavior: 'smooth' })
  }

  // Stagger animation duration
  const totalStaggerMs = tracks.length * 60 + 380

  const toggleCases = () => {
    try { playSfx('click', { volume: 0.8 }) } catch {}
    clearTimeout(animTimerRef.current)
    if (visible) {
      setAnimClass('leaving')
      animTimerRef.current = setTimeout(() => {
        setVisible(false)
        setAnimClass('')
      }, tracks.length * 60 + 300)
    } else {
      setVisible(true)
      requestAnimationFrame(() => {
        setAnimClass('entering')
        // Re-center after show
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToActive('instant')))
        animTimerRef.current = setTimeout(() => {
          setAnimClass('')
        }, totalStaggerMs)
      })
    }
  }

  // --- Render N copies of the tracks for the infinite loop ---
  const renderCase = (track, realIdx, visualIdx) => {
    const isActive = realIdx === index
    const rotation = caseRotations[realIdx] || 0
    const palette = VINYL_COLORS[track.vinylColor] || VINYL_COLORS.red
    return (
      <button
        key={`${visualIdx}`}
        type="button"
        className={`vinyl-case group ${isActive ? 'vinyl-case--active' : ''}`}
        style={{
          '--i': visualIdx % total,
          '--case-rotation': `${rotation}deg`,
          '--vinyl-peek-color': palette.c1,
        }}
        onClick={() => selectTrack(realIdx)}
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch {} }}
        aria-label={track.title || `Track ${realIdx + 1}`}
        title={track.title ? `${track.title}${track.artist ? ` — ${track.artist}` : ''}` : undefined}
      >
        <span className="vinyl-case__peek" aria-hidden="true" />
        <SmallCover
          src={track.src}
          vinylColor={track.vinylColor}
          className="vinyl-case__cover"
          alt={track.title || ''}
        />
        {isActive && <span className="vinyl-case__glow" aria-hidden="true" />}
      </button>
    )
  }

  return (
    <div className="vinyl-cases-wrapper hidden min-[540px]:flex pointer-events-auto">
      {/* Toggle show/hide */}
      <button
        type="button"
        className={`vinyl-toggle ${!visible ? 'vinyl-toggle--collapsed' : ''}`}
        onClick={toggleCases}
        aria-label={visible ? 'Hide collection' : 'Show collection'}
        title={visible ? 'Hide collection' : 'Show collection'}
      >
        <SquaresPlusIcon />
      </button>

      {/* Collapsible inner area */}
      <div className={`vinyl-cases-inner flex flex-col items-center ${visible ? 'vinyl-cases-inner--visible' : 'vinyl-cases-inner--hidden'}`}
           style={{ maxHeight: visible ? '480px' : undefined }}
      >
        {/* Up arrow — always visible in infinite scroll */}
        <button
          type="button"
          className={`vinyl-arrow vinyl-arrow--up ${visible ? 'vinyl-arrow--visible' : ''}`}
          onClick={() => scrollByAmount(-1)}
          aria-label="Scroll up"
        >
          <ChevronUpIcon />
        </button>

        {/* Scrollable infinite cases */}
        <div
          ref={scrollRef}
          className={[
            'vinyl-cases-stack vinyl-cases-stack--infinite flex flex-col items-center',
            animClass === 'entering' ? 'vinyl-cases-stack--entering' : '',
            animClass === 'leaving' ? 'vinyl-cases-stack--leaving' : '',
          ].join(' ')}
        >
          {Array.from({ length: INFINITE_COPIES }, (_, copy) =>
            tracks.map((track, i) => renderCase(track, i, copy * total + i))
          )}
        </div>

        {/* Down arrow — always visible in infinite scroll */}
        <button
          type="button"
          className={`vinyl-arrow vinyl-arrow--down ${visible ? 'vinyl-arrow--visible' : ''}`}
          onClick={() => scrollByAmount(1)}
          aria-label="Scroll down"
        >
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  )
}

// --- Shared cover cache for vinyl case thumbnails ---
// Module-level so all SmallCover instances share the same cache
// and avoid duplicate MP3 fetches for ID3 cover extraction.
const globalCoverCache = new Map()

function SmallCover({ src, vinylColor, className, style, alt }) {
  const [url, setUrl] = React.useState(() => globalCoverCache.get(src) || null)
  React.useEffect(() => {
    if (!src) return
    if (globalCoverCache.has(src)) {
      setUrl(globalCoverCache.get(src))
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const resolvedUrl = (() => {
          try {
            const path = src.replace(/^\/+/, '')
            return encodeURI(new URL(path, import.meta.env.BASE_URL).href)
          } catch { return encodeURI(src) }
        })()
        const res = await fetch(resolvedUrl)
        if (!res.ok) return
        const blob = await res.blob()
        const { default: jsmediatags } = await import('jsmediatags/dist/jsmediatags.min.js')
        jsmediatags.read(blob, {
          onSuccess: ({ tags }) => {
            if (cancelled) return
            const pic = tags.picture
            if (pic?.data && pic.format) {
              const imgBlob = new Blob([new Uint8Array(pic.data)], { type: pic.format })
              const objUrl = URL.createObjectURL(imgBlob)
              globalCoverCache.set(src, objUrl)
              setUrl(objUrl)
            }
          },
          onError: () => {},
        })
      } catch {}
    })()
    return () => { cancelled = true }
  }, [src])
  // Placeholder uses vinyl color while loading
  const palette = VINYL_COLORS[vinylColor] || VINYL_COLORS.red
  if (url) return <img src={url} alt={alt || ''} className={className || ''} style={style} draggable={false} />
  return (
    <div
      className={className || ''}
      style={{ ...style, background: `linear-gradient(135deg, ${palette.c1}, ${palette.c3})` }}
    />
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
