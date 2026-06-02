import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowsRightLeftIcon, ChevronUpIcon, ChevronDownIcon, SquaresPlusIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'
// AudioWorklet-based scratch engine. Sustituye al viejo
// ReversibleAudioBufferSourceNode: sin stop/start de sources, sin clicks,
// dirección reversible sample-accurate y latencia ~2.9ms.
import {
  ScratchAudioNode,
  ensureScratchWorkletLoaded,
} from '../lib/ScratchAudioNode.js'

// Vinyl color palettes keyed by track vinylColor value
// Intense, vivid colors — like real colored vinyl records under stage lights
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

function getVinylStyle(colorKey) {
  let palette = VINYL_COLORS[colorKey]
  if (!palette && colorKey && colorKey.startsWith('#') && colorKey.length === 7) {
    // Custom hex color — derive darker shades
    const r = parseInt(colorKey.slice(1, 3), 16)
    const g = parseInt(colorKey.slice(3, 5), 16)
    const b = parseInt(colorKey.slice(5, 7), 16)
    const d = (v, f) => Math.round(v * f)
    palette = {
      c1: colorKey,
      c2: `rgb(${d(r, 0.8)},${d(g, 0.8)},${d(b, 0.8)})`,
      c3: `rgb(${d(r, 0.45)},${d(g, 0.45)},${d(b, 0.45)})`,
      hl: `rgba(${r},${g},${b},0.18)`,
    }
  }
  if (!palette) palette = VINYL_COLORS.red
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
  onClose,
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
  const [slowBpm, setSlowBpm] = useState(() => {
    try { return localStorage.getItem('musicSlowBpm') === '1' } catch { return false }
  })
  const [ctxReady, setCtxReady] = useState(false)
  const fallbackSetRef = useRef(new Set()) // src strings that use HTMLAudio fallback
  const DECK_SKINS = ['technics', 'wood-70s', 'neon-cyber']
  const [skin, setSkin] = useState(() => {
    try { return localStorage.getItem('musicDeckSkin') || 'technics' } catch { return 'technics' }
  })
  const [crateOpen, setCrateOpen] = useState(false)
  const cycleSkin = () => {
    try { playSfx('click', { volume: 1.0 }) } catch { }
    const i = DECK_SKINS.indexOf(skin)
    const next = DECK_SKINS[(i + 1) % DECK_SKINS.length]
    setSkin(next)
    try { localStorage.setItem('musicDeckSkin', next) } catch { }
  }

  const repeatOneRef = useRef(repeatOne)
  repeatOneRef.current = repeatOne
  const shuffleRef = useRef(shuffle)
  shuffleRef.current = shuffle
  const slowBpmRef = useRef(slowBpm)
  slowBpmRef.current = slowBpm
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
    try { playSfx('click', { volume: 1.0 }) } catch { }
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
    try { e?.preventDefault?.() } catch { }
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
      setTimeout(() => { try { URL.revokeObjectURL(objUrl) } catch { } }, 2500)
    } catch {
      // Fallback: navigate directly to URL (allows "Save As")
      try { window.open(url, '_blank', 'noopener') } catch { }
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
  const playbackSpeedRef = useRef(1)
  const maxAngleRef = useRef(Math.PI * 2)
  const rafIdRef = useRef(0)
  const lastScratchTsRef = useRef(0)
  const SCRATCH_GUARD_MS = 1200
  const wasScratchingRef = useRef(false) // Track previous scratch state to detect end of scratch
  // (Worklet-based scratch: needsRestartRef / sourceIdRef / lastRateUpdateRef /
  // wasEggActiveRef ya no aplican — el AudioWorkletNode no muere ni dispara
  // onended fantasma entre cambios de dirección.)
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
      } catch { }
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
    // Carga el AudioWorklet antes de marcar ctx listo — playFrom depende de él.
    let cancelled = false
    ensureScratchWorkletLoaded(ctx)
      .then(() => { if (!cancelled) setCtxReady(true) })
      .catch((err) => {
        // Sin worklet, fallback: marcar ready para que HTMLAudio funcione,
        // pero dejar nota para diagnóstico.
        console.warn('[MusicPlayer] Scratch AudioWorklet failed to load:', err)
        if (!cancelled) setCtxReady(true)
      })
    return () => {
      cancelled = true
      try { srcRef.current?.stop(0) } catch { }
      try { ctx.close() } catch { }
      setCtxReady(false)
    }
  }, [])

  // ─── TTS ducking: fade music when text-to-speech is active ───
  useEffect(() => {
    const g = gainRef.current
    const ctx = ctxRef.current
    const onTTSStart = () => {
      if (!g || !ctx) return
      try {
        g.gain.cancelScheduledValues(ctx.currentTime)
        // Smooth fade to 10% over 0.8 seconds
        g.gain.setTargetAtTime(0.1, ctx.currentTime, 0.25)
      } catch { }
    }
    const onTTSStop = () => {
      if (!g || !ctx) return
      try {
        g.gain.cancelScheduledValues(ctx.currentTime)
        // Restore to 100% over 0.6 seconds
        g.gain.setTargetAtTime(1.0, ctx.currentTime, 0.18)
      } catch { }
    }
    window.addEventListener('tts-start', onTTSStart)
    window.addEventListener('tts-stop', onTTSStop)
    return () => {
      window.removeEventListener('tts-start', onTTSStart)
      window.removeEventListener('tts-stop', onTTSStop)
    }
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
      // Worklet-based scratch no necesita buffer invertido — el processor
      // maneja rate negativo leyendo el mismo buffer en reversa.
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
      srcRef.current?.stop(0)
      srcRef.current?.disconnect()
    } catch { }
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
        el.play().catch(() => { })
      } catch { }
      return
    }
    const ctx = ctxRef.current
    const g = gainRef.current
    const buf = bufferRef.current
    if (!ctx || !g || !buf) return

    // Worklet-based: no stop/start, no gap, no direction switching.
    // Una sola instancia persistente por track; rate signado maneja todo.
    const s = new ScratchAudioNode(ctx)
    s.setBuffer(buf)
    const filterNode = filterRef.current
    s.connect(filterNode || g)
    const eps = 0.001
    const offs = Math.max(0, Math.min(buf.duration - eps, seconds))

    // Stop previous node (si existe) — con worklet no hay zombies/onended fantasma.
    pauseWA()

    s.start(0, offs)
    currentPlaybackRateRef.current = 1

    try {
      s.onended = () => {
        if (stoppingRef.current) { stoppingRef.current = false; return }
        if (switchingRef.current) return
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
    } catch { }
    srcRef.current = s
    stoppingRef.current = false
  }

  function updateSpeed(rate, reversed, seconds, isDragging = false) {
    if (current && fallbackSetRef.current.has(current.src)) return
    const ctx = ctxRef.current
    if (!ctx) return
    const s = srcRef.current
    if (!s) return

    const lp = filterRef.current
    const eggActive = typeof window !== 'undefined' && window.__eggActiveGlobal
    // User-toggled "half BPM" OR the cheat-code easter egg both drop to 0.5x.
    const slowActive = eggActive || slowBpmRef.current
    const eggSlow = slowActive ? 0.5 : 1

    if (!isDragging) {
      // Salida de scratch o playback normal.
      const normalRate = slowActive ? 0.5 : 1
      if (wasScratchingRef.current) {
        wasScratchingRef.current = false
        // El worklet interpolará suavemente del rate actual al target (inercia).
        try { s.setScratching(false, normalRate) } catch { }
        currentPlaybackRateRef.current = normalRate
        // Sincroniza el angle con la posición real del worklet para evitar drift.
        try {
          const workletSecs = s.getCurrentTime()
          if (workletSecs > 0) {
            const v = 0.75
            angleRef.current = Math.max(0, Math.min(
              workletSecs * v * Math.PI * 2,
              maxAngleRef.current,
            ))
          }
        } catch { }
        // Filter smooth ramp back a transparente.
        if (lp) {
          try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch { }
          lp.frequency.setTargetAtTime(22050, ctx.currentTime, 0.06)
        }
        return
      }
      // Durante playback normal, solo actualizamos rate si el easter egg cambió.
      if (Math.abs(currentPlaybackRateRef.current - normalRate) > 0.01) {
        try { s.playbackRate(normalRate) } catch { }
        currentPlaybackRateRef.current = normalRate
      }
      return
    }

    // --- Scratch activo ---
    // `rate` ya viene signado desde el RAF loop (positivo = forward, neg = reverse).
    wasScratchingRef.current = true
    const sign = rate < 0 ? -1 : 1
    const clampedRate = sign * Math.max(0, Math.min(4, Math.abs(rate) * eggSlow))

    // Filter tracking — vinyl físico: HF caen con |rate|.
    if (lp) {
      const absRate = Math.abs(clampedRate)
      const filterFreq = Math.max(300, Math.min(22050, 300 + Math.pow(absRate, 0.6) * 21750))
      try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch { }
      lp.frequency.setTargetAtTime(filterFreq, ctx.currentTime, 0.015)
    }

    // Enviar rate directo al worklet — sin debounce ni threshold.
    // El worklet smooth-ea per-sample, así que cada mensaje se aplica limpio.
    try {
      s.setScratching(true, clampedRate)
      currentPlaybackRateRef.current = clampedRate
    } catch { }
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
            try { fallbackSetRef.current.add(first.src) } catch { }
            try {
              const el = audioRef.current
              if (el) {
                el.src = resolveUrl(first.src)
                el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch { } }
                resetDiscAndTime()
                setIndex(idx)
                el.play().then(() => { setIsPlaying(true); autoplayedRef.current = true }).catch(() => { })
              }
            } catch { }
          }
          return
        }
        await ensureCoverLoaded(first)
        resetDiscAndTime()
        if (idx >= 0) setIndex(idx)
        try { await ctxRef.current?.resume() } catch { }
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
    try { el.setPointerCapture?.(e.pointerId) } catch { }
    e.preventDefault()
  }
  function onMove(e) {
    if (!isDraggingRef.current) return
    const n = {
      x: (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0),
      y: (e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0),
    }
    const cx = centerRef.current.x
    const cy = centerRef.current.y
    // Near-center guard: cerca del centro, un píxel de movimiento equivale
    // a un salto de ángulo enorme (atan2 explota), que se siente como "jumps".
    // Usamos ~15% del radio del disco como zona muerta.
    const r = discElRef.current?.getBoundingClientRect()?.width ?? 200
    const deadRadius = r * 0.15
    const dNew = Math.hypot(n.x - cx, n.y - cy)
    const dPrev = Math.hypot(draggingFromRef.current.x - cx, draggingFromRef.current.y - cy)
    if (dNew < deadRadius || dPrev < deadRadius) {
      // Mantener el previous point sincronizado para no acumular un delta gigante
      // cuando el puntero vuelva a salir de la zona muerta.
      draggingFromRef.current = { ...n }
      e.preventDefault()
      return
    }
    const o = Math.atan2(n.y - cy, n.x - cx)
    const a = Math.atan2(draggingFromRef.current.y - cy, draggingFromRef.current.x - cx)
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
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { }
    // Tap detection (mobile): short tap with small movement toggles expanded disc
    const nx = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? draggingFromRef.current.x
    const ny = e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY) ?? draggingFromRef.current.y
    const dx = nx - tapStartRef.current.x
    const dy = ny - tapStartRef.current.y
    const dt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tapStartRef.current.t
    // On mobile don't toggle growth on click; growth is only while pressing
    if (isMobile) setIsPressing(false)

    // Worklet: no hay que reiniciar el source — sigue vivo. El RAF loop en el
    // siguiente frame llamará updateSpeed(…, false) que dispara la inercia
    // suave del worklet y el ramp del low-pass.
    if (wasDragging && isPlaying && !switchingRef.current) {
      playbackSpeedRef.current = 1
      lastScratchTsRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now())
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
    const loop = () => {
      if (pageHidden) { return } // stop advancing when page hidden
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      // Non-drag: avanzar el ángulo a velocidad de playback normal.
      if (!isDraggingRef.current && isPlaying) {
        const t = now - tsPrevRef.current
        const advance = clamp(b * t, 0, b * 32) // seguro contra frames largos
        angleRef.current = clamp(angleRef.current + advance, 0, maxAngleRef.current)
      }
      const t = now - tsPrevRef.current
      const angleDelta = angleRef.current - anglePrevRef.current
      // Rate instantáneo, signado (positivo = forward, negativo = reverse).
      // Sin moving average — el worklet smooth-ea per-sample.
      const expected = (M * 0.001) * t
      const instantRate = expected > 0 ? angleDelta / expected : 0
      const rateSigned = clamp(instantRate, -4, 4)
      playbackSpeedRef.current = rateSigned
      anglePrevRef.current = angleRef.current
      tsPrevRef.current = now

      // Direct DOM mutation for disc rotation — avoids React re-render
      setDiscRotation((angleRef.current * 180) / Math.PI)

      const secondsPlayed = (angleRef.current / TWO_PI) / v
      // Pasamos rate signado directo; updateSpeed ya no necesita flag reversed.
      updateSpeed(rateSigned, false, secondsPlayed, isDraggingRef.current)

      // Always keep the accurate time ref up to date
      currentTimeRef.current = secondsPlayed
      // Throttle React state updates to ~4fps — time display doesn't need 60fps
      if (now - lastTimeUpdateRef.current > 250) {
        setCurrentTime(secondsPlayed)
        lastTimeUpdateRef.current = now
      }

      // (Worklet sustituye el "safety net" de restart: el AudioWorkletNode
      // nunca muere entre cambios de dirección, así que needsRestartRef ya no existe.)

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
      ; (async () => {
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
              el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch { } }
              resetDiscAndTime()
              if (isPlaying) el.play().catch(() => { })
              switchAttemptsRef.current = 0
              switchingRef.current = false
              return
            }
          } catch { }
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
          try { fallbackSetRef.current.add(t.src) } catch { }
          try {
            const el = audioRef.current
            if (el) {
              el.src = resolveUrl(t.src)
              el.onloadedmetadata = () => { try { setDuration(el.duration || 0) } catch { } }
              resetDiscAndTime()
              if (isPlaying) el.play().catch(() => { })
              switchAttemptsRef.current = 0
              switchingRef.current = false
              return
            }
          } catch { }
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
    if (!t) return () => { }
    if (!fallbackSetRef.current.has(t.src)) return () => { }
    const el = audioRef.current
    if (!el) return () => { }
    const onTime = () => { try { setCurrentTime(el.currentTime || 0) } catch { } }
    const onEnd = () => { try { setIsPlaying(false) } catch { } }
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
            el.play().catch(() => { })
          }
        } catch { }
        return
      }
      try { if (ctxRef.current?.state === 'suspended') ctxRef.current.resume().catch(() => { }) } catch { }
      // Use the accurate ref instead of (potentially stale) React state
      const secondsPlayed = currentTimeRef.current
      playFrom(secondsPlayed)
    } else {
      if (fallbackSetRef.current.has(current.src)) {
        try { audioRef.current?.pause() } catch { }
      } else {
        pauseWA()
      }
    }
  }, [isPlaying, current])

  const scratchGuardActive = () => ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS

  // Crate scroll controller (simple horizontal strip — replaces the heavy infinite-scroll version)
  const crateScrollRef = useRef(null)
  const scrollCrateBy = (dir) => {
    const el = crateScrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }
  // Auto-center active case when index changes or crate opens
  useEffect(() => {
    if (!crateOpen) return
    const el = crateScrollRef.current
    if (!el) return
    const child = el.children[index]
    if (!child) return
    const elRect = el.getBoundingClientRect()
    const childRect = child.getBoundingClientRect()
    const childCenter = (childRect.left - elRect.left) + el.scrollLeft + childRect.width / 2
    el.scrollTo({ left: childCenter - el.clientWidth / 2, behavior: 'smooth' })
  }, [index, crateOpen])

  return (
    <div className="dj-deck" data-skin={skin}>
      {/* Babosa de slime oculta (#5). position inline → gana sobre `.dj-deck > *`.
          Esquina inferior-izquierda, sobre el chasis. Reto: no se anuncia. */}
      <SlimeSlugDOM id="music" size={26} style={{ position: 'absolute', left: '7px', bottom: '6px', zIndex: 6 }} />
      {/* Top strip: brand + skin selector */}
      <div className="dj-deck__top">
        <div className="dj-deck__brand">
          <span className="dj-deck__led" data-on={isPlaying ? 'true' : 'false'} />
          <span className="dj-deck__brand-text">SR-1200 · DIRECT DRIVE</span>
        </div>
        <div className="dj-deck__top-right">
          <button
            type="button"
            className="dj-deck__skin-btn"
            onClick={cycleSkin}
            aria-label="Change skin"
            title="Change skin"
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
          >
            {DECK_SKINS.map((s) => (
              <span key={s} className="dj-deck__skin-dot" data-skin={s} data-active={s === skin ? 'true' : 'false'} />
            ))}
          </button>
          {onClose && (
            <button
              type="button"
              className="dj-deck__close"
              onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; onClose() }}
              onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
              aria-label="Close"
              title="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Platter area */}
      <div className="dj-deck__platter-area">
        <div className="dj-deck__speed">
          <span className="dj-deck__led-sm" data-on={isPlaying ? 'true' : 'false'} aria-hidden="true">
            {slowBpm ? '16⅔' : '33⅓'}
          </span>
          <span className="dj-deck__led-sm" data-on={shuffle ? 'true' : 'false'} aria-hidden="true">SHFL</span>
          <button
            type="button"
            className="dj-deck__led-sm dj-deck__led-sm--btn"
            data-on={slowBpm ? 'true' : 'false'}
            onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
            onClick={() => {
              try { playSfx('click', { volume: 1.0 }) } catch { }
              setSlowBpm((v) => {
                const next = !v
                try { localStorage.setItem('musicSlowBpm', next ? '1' : '0') } catch { }
                return next
              })
            }}
            aria-label={slowBpm ? t('music.slowBpmOn') : t('music.slowBpmOff')}
            title={slowBpm ? t('music.slowBpmOn') : t('music.slowBpmOff')}
          >
            ½×
          </button>
        </div>

        <div
          className="dj-deck__disc-wrap"
          style={getVinylStyle(current?.vinylColor)}
        >
          <div ref={discElRef} id="disc" className="disc dj-deck__disc">
            {current?.cover ? (
              <img src={resolveUrl(current.cover)} alt={t('music.coverAlt')} className="disc__label" />
            ) : (
              <CoverFromMeta src={current?.src} className="disc__label" alt={t('music.coverAlt')} />
            )}
            <div className="disc__middle" />
            <span className="disc__cue-dot" aria-hidden="true" />
          </div>
          <div className="disc__glare" />
          <div
            className="dj-deck__disc-hit"
            style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onTouchStart={() => { }}
          />
        </div>

      </div>

      {/* LCD readout */}
      <div className="dj-deck__readout">
        <div className="dj-deck__title-strip">
          <div className="dj-deck__title-track">
            {/* 8 copies × 2-halves keeps the strip filled regardless of title length.
                Animation translates -50% so halves 1-4 match halves 5-8 for seamless loop. */}
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i}>
                {current ? (current.title || t('music.unknownTitle')) : t('music.noTracks')}
                {current?.artist ? `  ·  ${current.artist}` : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="dj-deck__progress">
          <div
            className="dj-deck__progress-fill"
            style={{ width: `${Math.max(0, Math.min(100, (duration ? (currentTime / duration) * 100 : 0)))}%` }}
          />
        </div>
        <div className="dj-deck__time">
          <span>{formatTime(currentTime)}</span>
          <span className="dj-deck__time-sep">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control pads */}
      <div className="dj-deck__pads">
        <button
          type="button"
          className={`dj-deck__pad ${shuffle ? 'dj-deck__pad--active' : ''}`}
          disabled={!hasTracks}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setShuffle((v) => !v) }}
          aria-label={shuffle ? t('music.shuffleOn') : t('music.shuffleOff')}
          title={shuffle ? t('music.shuffleOn') : t('music.shuffleOff')}
        >
          <ArrowsRightLeftIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          className="dj-deck__pad"
          disabled={!hasTracks || switchingRef.current || isDraggingRef.current || scratchGuardActive()}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onClick={() => {
            try { playSfx('click', { volume: 1.0 }) } catch { }
            if (!hasTracks) return
            if (switchingRef.current) return
            if (isDraggingRef.current) return
            if (scratchGuardActive()) return
            stoppingRef.current = true
            pauseWA()
            switchingRef.current = true
            setIndex((i) => (i - 1 + tracks.length) % tracks.length)
            setIsPlaying(true)
          }}
          aria-label={t('music.previous')}
        >
          <BackwardIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          className="dj-deck__pad dj-deck__pad--primary"
          disabled={!hasTracks}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setIsPlaying((v) => !v) }}
          aria-label={isPlaying ? t('music.pause') : t('music.play')}
        >
          {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
        </button>

        <button
          type="button"
          className="dj-deck__pad"
          disabled={!hasTracks || switchingRef.current || isDraggingRef.current || scratchGuardActive()}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onClick={() => {
            try { playSfx('click', { volume: 1.0 }) } catch { }
            if (!hasTracks) return
            if (switchingRef.current) return
            if (isDraggingRef.current) return
            if (scratchGuardActive()) return
            stoppingRef.current = true
            pauseWA()
            switchingRef.current = true
            setIndex((i) => getNextIndex(i))
            setIsPlaying(true)
          }}
          aria-label={t('music.next')}
        >
          <ForwardIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          className={`dj-deck__pad ${repeatOne ? 'dj-deck__pad--active' : ''}`}
          disabled={!hasTracks}
          onMouseEnter={() => { try { playSfx('hover', { volume: 0.9 }) } catch { } }}
          onClick={() => { try { playSfx('click', { volume: 1.0 }) } catch { }; setRepeatOne((v) => !v) }}
          aria-label={repeatOne ? t('music.repeatOn') : t('music.repeatOff')}
          title={repeatOne ? t('music.repeatOn') : t('music.repeatOff')}
        >
          <ArrowPathIcon className="w-5 h-5" />
          {repeatOne && <span className="dj-deck__pad-badge">1</span>}
        </button>
      </div>

      {/* Footer: CRATE toggle + DOWNLOAD */}
      <div className="dj-deck__footer">
        {hasTracks && tracks.length > 1 && (
          <button
            type="button"
            className={`dj-deck__footer-btn ${crateOpen ? 'dj-deck__footer-btn--active' : ''}`}
            onClick={() => { try { playSfx('click', { volume: 0.9 }) } catch { }; setCrateOpen((o) => !o) }}
            aria-expanded={crateOpen}
            aria-label={crateOpen ? 'Hide crate' : 'Show crate'}
          >
            <SquaresPlusIcon className="w-4 h-4" />
            <span>CRATE</span>
          </button>
        )}
        <a
          href={resolveUrl(current?.src) || '#'}
          download
          onClick={handleDownloadCurrentTrack}
          className="dj-deck__footer-btn"
          title={current?.title ? t('music.downloadTitle', { title: current.title }) : t('music.downloadThisTrack')}
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>DOWNLOAD</span>
        </a>
      </div>

      {/* Crate slide-up: simple horizontal strip (lightweight — no infinite scroll, no teleport) */}
      {hasTracks && tracks.length > 1 && crateOpen && (
        <div className="dj-deck__crate">
          <button
            type="button"
            className="dj-deck__crate-arrow"
            onClick={() => scrollCrateBy(-1)}
            aria-label="Scroll left"
          >
            <ChevronUpIcon style={{ width: 14, height: 14, transform: 'rotate(-90deg)' }} />
          </button>
          <div ref={crateScrollRef} className="dj-deck__crate-scroll">
            {tracks.map((track, i) => (
              <button
                key={i}
                type="button"
                className={`dj-deck__crate-case ${i === index ? 'dj-deck__crate-case--active' : ''}`}
                onClick={() => selectTrack(i)}
                onMouseEnter={() => { try { playSfx('hover', { volume: 0.5 }) } catch { } }}
                aria-label={track.title || `Track ${i + 1}`}
                title={track.title ? `${track.title}${track.artist ? ` — ${track.artist}` : ''}` : undefined}
              >
                <SmallCover
                  src={track.src}
                  vinylColor={track.vinylColor}
                  className="dj-deck__crate-case-cover"
                  alt={track.title || ''}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="dj-deck__crate-arrow"
            onClick={() => scrollCrateBy(1)}
            aria-label="Scroll right"
          >
            <ChevronDownIcon style={{ width: 14, height: 14, transform: 'rotate(-90deg)' }} />
          </button>
        </div>
      )}

      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}

// --- Vinyl cases column with infinite scroll + auto-center on active ---
const INFINITE_COPIES = 5 // render N copies of tracks for seamless infinite loop

function VinylCasesColumn({ tracks, index, caseRotations, selectTrack, playSfx, horizontal = false }) {
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
    if (horizontal) {
      const copyWidth = el.scrollWidth / INFINITE_COPIES
      if (el.scrollLeft < copyWidth * 0.8) {
        teleportingRef.current = true
        el.scrollLeft += copyWidth
        requestAnimationFrame(() => { teleportingRef.current = false })
      } else if (el.scrollLeft > copyWidth * (INFINITE_COPIES - 1.8)) {
        teleportingRef.current = true
        el.scrollLeft -= copyWidth
        requestAnimationFrame(() => { teleportingRef.current = false })
      }
      return
    }
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
  }, [total, horizontal])

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
    if (horizontal) {
      const childCenterInContent = (childRect.left - elRect.left) + el.scrollLeft + childRect.width / 2
      const containerCenter = el.clientWidth / 2
      const targetScroll = childCenterInContent - containerCenter
      if (behavior === 'instant') {
        teleportingRef.current = true
        el.scrollLeft = targetScroll
        requestAnimationFrame(() => { teleportingRef.current = false })
      } else {
        el.scrollTo({ left: targetScroll, behavior: 'smooth' })
      }
      return
    }
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
  }, [index, visible, total, centerCopy, horizontal])

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
    if (horizontal) el.scrollBy({ left: dir * 120, behavior: 'smooth' })
    else el.scrollBy({ top: dir * 120, behavior: 'smooth' })
  }

  // Stagger animation duration
  const totalStaggerMs = tracks.length * 60 + 380

  const toggleCases = () => {
    try { playSfx('click', { volume: 0.8 }) } catch { }
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
    const palette = VINYL_COLORS[track.vinylColor] || (
      track.vinylColor && track.vinylColor.startsWith('#') && track.vinylColor.length === 7
        ? (() => { const r = parseInt(track.vinylColor.slice(1, 3), 16), g = parseInt(track.vinylColor.slice(3, 5), 16), b = parseInt(track.vinylColor.slice(5, 7), 16); return { c1: track.vinylColor, c2: `rgb(${Math.round(r * .8)},${Math.round(g * .8)},${Math.round(b * .8)})`, c3: `rgb(${Math.round(r * .45)},${Math.round(g * .45)},${Math.round(b * .45)})`, hl: `rgba(${r},${g},${b},0.18)` } })()
        : VINYL_COLORS.red
    )
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
        onMouseEnter={() => { try { playSfx('hover', { volume: 0.6 }) } catch { } }}
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

  const wrapperClass = horizontal
    ? 'vinyl-cases-wrapper vinyl-cases-wrapper--horizontal flex flex-row items-center pointer-events-auto'
    : 'vinyl-cases-wrapper hidden min-[540px]:flex pointer-events-auto'
  const innerClass = horizontal
    ? `vinyl-cases-inner flex flex-row items-center ${visible ? 'vinyl-cases-inner--visible' : 'vinyl-cases-inner--hidden'}`
    : `vinyl-cases-inner flex flex-col items-center ${visible ? 'vinyl-cases-inner--visible' : 'vinyl-cases-inner--hidden'}`
  const stackClass = [
    horizontal ? 'vinyl-cases-stack vinyl-cases-stack--horizontal vinyl-cases-stack--infinite flex flex-row items-center' : 'vinyl-cases-stack vinyl-cases-stack--infinite flex flex-col items-center',
    animClass === 'entering' ? 'vinyl-cases-stack--entering' : '',
    animClass === 'leaving' ? 'vinyl-cases-stack--leaving' : '',
  ].join(' ')
  const innerStyle = horizontal
    ? { maxWidth: visible ? 'min(92vw, 420px)' : undefined, maxHeight: undefined }
    : { maxHeight: visible ? '480px' : undefined }

  return (
    <div className={wrapperClass}>
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
      <div className={innerClass} style={innerStyle}>
        {/* Prev arrow */}
        <button
          type="button"
          className={`vinyl-arrow ${horizontal ? 'vinyl-arrow--left' : 'vinyl-arrow--up'} ${visible ? 'vinyl-arrow--visible' : ''}`}
          onClick={() => scrollByAmount(-1)}
          aria-label={horizontal ? 'Scroll left' : 'Scroll up'}
        >
          {horizontal ? <ChevronUpIcon style={{ transform: 'rotate(-90deg)' }} /> : <ChevronUpIcon />}
        </button>

        {/* Scrollable infinite cases */}
        <div ref={scrollRef} className={stackClass}>
          {Array.from({ length: INFINITE_COPIES }, (_, copy) =>
            tracks.map((track, i) => renderCase(track, i, copy * total + i))
          )}
        </div>

        {/* Next arrow */}
        <button
          type="button"
          className={`vinyl-arrow ${horizontal ? 'vinyl-arrow--right' : 'vinyl-arrow--down'} ${visible ? 'vinyl-arrow--visible' : ''}`}
          onClick={() => scrollByAmount(1)}
          aria-label={horizontal ? 'Scroll right' : 'Scroll down'}
        >
          {horizontal ? <ChevronDownIcon style={{ transform: 'rotate(-90deg)' }} /> : <ChevronDownIcon />}
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
      ; (async () => {
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
            onError: () => { },
          })
        } catch { }
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
    ; (async () => {
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
