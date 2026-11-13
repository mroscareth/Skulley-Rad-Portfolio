import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { BackwardIcon, ForwardIcon, PlayIcon, PauseIcon, ArrowDownTrayIcon, ArrowPathIcon, ArrowsRightLeftIcon, QueueListIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { playSfx } from '../lib/sfx.js'
import { FUNDIDO_ENTRADA_S, esperarDestape, fundir } from '../lib/musicaLobby.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import SlimeSlugDOM from './SlimeSlugDOM.jsx'
// AudioWorklet-based scratch engine. Sustituye al viejo
// ReversibleAudioBufferSourceNode: sin stop/start de sources, sin clicks,
// dirección reversible sample-accurate y latencia ~2.9ms.
import {
  ScratchAudioNode,
  ensureScratchWorkletLoaded,
} from '../lib/ScratchAudioNode.js'

// Un track se pide por tres caminos a la vez: el buffer del worklet de scratch
// y los dos lectores de portada con jsmediatags. Sin compartir la promesa, el
// mismo mp3 (1.2MB el primero) se bajaba una vez por cada uno — medido, 4-5
// descargas idénticas al montar el deck. La promesa se suelta a los 5s: ya
// pasó la ventana en que coinciden y no queremos retener los bytes.
// Volumen de la música de fondo. Antes iba a 1.0 y se sentía alta frente a
// los efectos y a la voz; Oscar la pidió más baja tres veces (0.87 y 0.72 el
// 2026-10-24; 0.5 el 2026-11-05, para que no tape los sonidos del juego). Las
// canciones promedian -16 a -19 dB: a 0.5 las pisadas le asoman unos 5 dB.
const MUSIC_VOLUME = 0.5

// Pausa y play de tornamesa (Oscar, 2026-11-02): al pausar, el plato frena
// hasta 0 en FRENO_S y el sonido baja de tono con él; al darle play arranca
// quieto y llega a sus RPM en ARRANQUE_S. Velocidad lineal en los dos, como
// un motor y su freno de par constante. Mientras frena o arranca, el rate va
// al worklet por el camino del scratch (con su low-pass), como si una mano lo
// llevara. Solo con el worklet: el <audio> de respaldo pausa en seco.
const FRENO_S = 0.6
const ARRANQUE_S = 0.35

const trackBytesInFlight = new Map()
function fetchTrackBytes(url) {
  const running = trackBytesInFlight.get(url)
  if (running) return running
  const p = fetch(url, { cache: 'force-cache' })
    .then((res) => {
      if (!res.ok) throw new Error('fetch-failed')
      return res.arrayBuffer()
    })
  trackBytesInFlight.set(url, p)
  p.catch(() => { }).finally(() => {
    setTimeout(() => trackBytesInFlight.delete(url), 5000)
  })
  return p
}

// Color del vinilo por pista (el CMS guarda la clave o un #hex; ver
// MusicEditor). El disco se pinta en bandas planas: c1 afuera, c2 junto a la
// etiqueta, como el banding del personaje.
const VINYL_COLORS = {
  red: { c1: '#e01b1b', c2: '#b81414', c3: '#6e0a0a' },
  black: { c1: '#555555', c2: '#333333', c3: '#111111' },
  yellow: { c1: '#f5ff00', c2: '#cfd700', c3: '#818600' },
  blue: { c1: '#1a5cff', c2: '#1248d4', c3: '#0a2e8a' },
  purple: { c1: '#9b2aed', c2: '#7b1ec4', c3: '#4c1080' },
  teal: { c1: '#12ccb3', c2: '#0ea894', c3: '#08705e' },
  green: { c1: '#30d418', c2: '#26ac12', c3: '#14700a' },
  orange: { c1: '#f07818', c2: '#cc6212', c3: '#884008' },
  pink: { c1: '#f0289a', c2: '#c81e7e', c3: '#80124e' },
}

function getVinylStyle(colorKey) {
  let palette = VINYL_COLORS[colorKey]
  if (!palette && colorKey && colorKey.startsWith('#') && colorKey.length === 7) {
    const r = parseInt(colorKey.slice(1, 3), 16)
    const g = parseInt(colorKey.slice(3, 5), 16)
    const b = parseInt(colorKey.slice(5, 7), 16)
    const d = (v, f) => Math.round(v * f)
    palette = {
      c1: colorKey,
      c2: `rgb(${d(r, 0.8)},${d(g, 0.8)},${d(b, 0.8)})`,
      c3: `rgb(${d(r, 0.45)},${d(g, 0.45)},${d(b, 0.45)})`,
    }
  }
  if (!palette) palette = VINYL_COLORS.red
  return {
    '--vinyl-c1': palette.c1,
    '--vinyl-c2': palette.c2,
    '--vinyl-c3': palette.c3,
  }
}

// Segmentos de la barra de avance en la pantalla.
const METER_SEGMENTS = 28

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function MusicPlayer({
  tracks = [],
  autoStart = false,
  pageHidden = false,
  // El modal está a la vista: Escape cierra y el foco se queda adentro.
  active = false,
  onClose,
}) {
  const { t } = useLanguage()
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)
  const deckRef = useRef(null)
  const playBtnRef = useRef(null)
  const listBtnRef = useRef(null)
  const listRef = useRef(null)
  const [repeatOne, setRepeatOne] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [slowBpm, setSlowBpm] = useState(() => {
    try { return localStorage.getItem('musicSlowBpm') === '1' } catch { return false }
  })
  const [ctxReady, setCtxReady] = useState(false)
  const fallbackSetRef = useRef(new Set()) // src strings that use HTMLAudio fallback
  const [listOpen, setListOpen] = useState(false)
  const listOpenRef = useRef(listOpen)
  listOpenRef.current = listOpen

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

  // Pista elegida en la lista. La lista se cierra para que se vea el plato.
  function selectTrack(trackIdx) {
    setListOpen(false)
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
  const discElRef = useRef(null) // Direct DOM ref for disc — avoids React re-renders
  const isDraggingRef = useRef(false)
  const centerRef = useRef({ x: 0, y: 0 })
  const draggingFromRef = useRef({ x: 0, y: 0 })
  const angleRef = useRef(0)
  const anglePrevRef = useRef(0)
  const tsPrevRef = useRef((typeof performance !== 'undefined' ? performance.now() : Date.now()))
  const playbackSpeedRef = useRef(1)
  // Velocidad del motor del plato, 0 a 1 (ver FRENO_S); la lleva el loop.
  const motorRef = useRef(0)
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
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx
    const g = ctx.createGain()
    g.gain.value = MUSIC_VOLUME
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

  // En el teléfono no hay ENTER: el gesto que deja sonar el audio es el botón
  // "Con audio" de la home (MobileApp). iOS solo arranca un AudioContext que
  // se reanuda DENTRO de ese tap, y el autoplay de abajo llega después (tras
  // bajar el track), así que el botón avisa con `audio-unlock` y aquí se
  // reanuda en el mismo gesto (dispatchEvent es síncrono).
  useEffect(() => {
    const onUnlock = () => {
      try { if (ctxRef.current && ctxRef.current.state !== 'running') ctxRef.current.resume().catch(() => { }) } catch { }
    }
    window.addEventListener('audio-unlock', onUnlock)
    return () => window.removeEventListener('audio-unlock', onUnlock)
  }, [])

  // ─── "Conocer la historia" desde una experiencia ───
  // Mientras dura, la música se va con fundido y no regresa con el TTS (la
  // voz de M.A.D.R.E. manda tts-start / tts-stop en cada línea); al volver,
  // sube otra vez (App.jsx, evento `musica-silencio` { on, segundos }).
  const silenciadaRef = useRef(false)
  useEffect(() => {
    const onSilencio = (e) => {
      const { on = false, segundos = 0.9 } = e.detail || {}
      silenciadaRef.current = Boolean(on)
      const c = ctxRef.current
      const g = gainRef.current
      if (c && g) {
        try {
          g.gain.cancelScheduledValues(c.currentTime)
          g.gain.setValueAtTime(g.gain.value, c.currentTime)
          g.gain.linearRampToValueAtTime(on ? 0.0001 : MUSIC_VOLUME, c.currentTime + segundos)
        } catch { }
      }
      const el = audioRef.current
      if (el && !el.paused) fundir(el, on ? 0 : MUSIC_VOLUME, segundos)
    }
    window.addEventListener('musica-silencio', onSilencio)
    return () => window.removeEventListener('musica-silencio', onSilencio)
  }, [])

  // ─── TTS ducking: fade music when text-to-speech is active ───
  useEffect(() => {
    const g = gainRef.current
    const ctx = ctxRef.current
    const onTTSStart = () => {
      if (!g || !ctx || silenciadaRef.current) return
      try {
        g.gain.cancelScheduledValues(ctx.currentTime)
        // Smooth fade to 10% over 0.8 seconds
        g.gain.setTargetAtTime(0.1, ctx.currentTime, 0.25)
      } catch { }
    }
    const onTTSStop = () => {
      if (!g || !ctx || silenciadaRef.current) return
      try {
        g.gain.cancelScheduledValues(ctx.currentTime)
        // Back to the normal music level over 0.6 seconds
        g.gain.setTargetAtTime(MUSIC_VOLUME, ctx.currentTime, 0.18)
      } catch { }
    }
    window.addEventListener('tts-start', onTTSStart)
    window.addEventListener('tts-stop', onTTSStop)
    return () => {
      window.removeEventListener('tts-start', onTTSStart)
      window.removeEventListener('tts-stop', onTTSStop)
    }
  }, [])

  // El <audio> de respaldo (cuando una pista no se puede decodificar con
  // WebAudio) suena al mismo volumen que la ruta normal.
  useEffect(() => {
    try { if (audioRef.current) audioRef.current.volume = MUSIC_VOLUME } catch { }
  }, [])

  // Al cambiar de pantalla (Volver al inicio, la otra versión), la música se
  // va con fundido antes de la cortinilla (lib/musicaLobby.js, despedirMusica)
  // y avisa que sonaba. La página se recarga detrás, así que se queda en 0.
  useEffect(() => {
    const onDespedir = (e) => {
      const aviso = e.detail || {}
      const s = aviso.segundos || 0.9
      if (!isPlayingRef.current) return
      aviso.sonaba = true
      const c = ctxRef.current
      const g = gainRef.current
      if (c && g) {
        try {
          g.gain.cancelScheduledValues(c.currentTime)
          g.gain.setValueAtTime(g.gain.value, c.currentTime)
          g.gain.linearRampToValueAtTime(0.0001, c.currentTime + s)
        } catch { }
      }
      const el = audioRef.current
      if (el && !el.paused) fundir(el, 0, s)
    }
    window.addEventListener('musica-despedir', onDespedir)
    return () => window.removeEventListener('musica-despedir', onDespedir)
  }, [])

  // ─── Videos con sonido: la música se pausa mientras suenan ───
  // Cualquier <video>/<audio> de la página que arranque con sonido (no
  // silenciado) pausa la música; cuando todos se detienen o terminan, la
  // música regresa SOLO si fue el video quien la pausó. Los videos mudos de
  // fondo (banners, el de M.A.D.R.E.) no cuentan.
  // `play` no burbujea: se escucha en fase de captura en el documento. La
  // pausa y el fin se escuchan en cada video, porque al cerrar una ficha el
  // video sale del DOM y su `pause` ya no llega al documento.
  const isPlayingRef = useRef(false)
  isPlayingRef.current = isPlaying
  useEffect(() => {
    const playing = new Set()
    const tracked = new WeakSet()
    let pausedByVideo = false
    const isOwn = (el) => el === audioRef.current
    const hasSound = (el) => !el.muted && el.volume > 0
    const release = (el) => {
      if (!playing.delete(el)) return
      if (playing.size === 0 && pausedByVideo) {
        pausedByVideo = false
        setIsPlaying(true)
      }
    }
    const onElementStop = (e) => release(e.currentTarget)
    const onElementVolume = (e) => {
      const el = e.currentTarget
      if (!hasSound(el)) release(el)
    }
    const claim = (el) => {
      if (!tracked.has(el)) {
        tracked.add(el)
        el.addEventListener('pause', onElementStop)
        el.addEventListener('ended', onElementStop)
        el.addEventListener('volumechange', onElementVolume)
      }
      playing.add(el)
      if (isPlayingRef.current) {
        pausedByVideo = true
        setIsPlaying(false)
      }
    }
    const onPlay = (e) => {
      const el = e.target
      if (!(el instanceof HTMLMediaElement) || isOwn(el) || !hasSound(el)) return
      claim(el)
    }
    // Un video mudo que alguien des-silencia mientras corre.
    const onVolume = (e) => {
      const el = e.target
      if (!(el instanceof HTMLMediaElement) || isOwn(el)) return
      if (!el.paused && hasSound(el) && !playing.has(el)) claim(el)
    }
    document.addEventListener('play', onPlay, true)
    document.addEventListener('volumechange', onVolume, true)
    return () => {
      document.removeEventListener('play', onPlay, true)
      document.removeEventListener('volumechange', onVolume, true)
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
      // fetch & decode. El slice(0) es obligatorio: decodeAudioData se queda
      // con el ArrayBuffer (lo "detacha") y estos bytes los comparten los
      // lectores de portada.
      const arr = await fetchTrackBytes(url)
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

  // El plato ya frenó: se para el worklet y el low-pass del frenado vuelve a
  // abierto, para que lo siguiente no suene apagado.
  function pararPlato() {
    pauseWA()
    motorRef.current = 0
    wasScratchingRef.current = false
    const lp = filterRef.current
    const ctx = ctxRef.current
    if (lp && ctx) {
      try { lp.frequency.cancelScheduledValues(ctx.currentTime) } catch { }
      lp.frequency.value = 22050
    }
  }

  // `arranque`: sale con el plato quieto y el loop lo lleva a sus RPM.
  function playFrom(seconds = 0, arranque = false) {
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

    s.start(0, offs, arranque ? 0 : undefined)
    currentPlaybackRateRef.current = arranque ? 0 : 1
    motorRef.current = arranque ? 0 : 1

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

  // Precarga del track actual. loadTrack baja el MP3 COMPLETO —el worklet de
  // scratch necesita el buffer entero decodificado, con streaming no se puede
  // rayar— y las canciones pesan de 1.2 a 6.4 MB. Antes esto corría en cuanto
  // había track, o sea mientras el usuario seguía viendo el preloader: 4 MB
  // bajados antes de que nadie pidiera música, y el modal ni siquiera está
  // montado visible para darle play.
  //
  // autoStart es Enter picado (audioReady en App.jsx). A partir de ahí se
  // comporta igual que antes, incluido el cambio de track, porque autoStart ya
  // quedó en true. El efecto de autoplay de abajo también llama a loadTrack
  // para el primer track; no se duplica la descarga porque fetchTrackBytes
  // deduplica por URL con trackBytesInFlight.
  useEffect(() => {
    if (!current?.src) return
    if (!autoStart) return
    loadTrack(current.src, { activate: true })
  }, [current?.src, autoStart])

  // Autoplay gated by "Enter" button (autoStart prop)
  const autoplayedRef = useRef(false)
  const autoplayRetriesRef = useRef(0)
  const esperandoAudioRef = useRef(false)
  useEffect(() => {
    if (autoplayedRef.current || esperandoAudioRef.current) return
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
                esperarDestape().then(() => {
                  el.volume = 0
                  return el.play().then(() => {
                    fundir(el, MUSIC_VOLUME, FUNDIDO_ENTRADA_S)
                    setIsPlaying(true)
                    autoplayedRef.current = true
                  })
                }).catch(() => { })
              }
            } catch { }
          }
          return
        }
        await ensureCoverLoaded(first)
        // Llegando a /simple o /world desde otra página puede no haber gesto
        // en esta: el navegador deja el audio detenido hasta el primer clic o
        // tecla (App.jsx manda `audio-unlock`). El disco espera a ese momento;
        // si girara antes, la canción arrancaba a medias.
        const ctx = ctxRef.current
        if (ctx && ctx.state !== 'running') {
          esperandoAudioRef.current = true
          try { ctx.resume().catch(() => { }) } catch { }
          await new Promise((listo) => {
            const alCambiar = () => {
              if (ctx.state !== 'running') return
              ctx.removeEventListener('statechange', alCambiar)
              listo()
            }
            ctx.addEventListener('statechange', alCambiar)
            alCambiar()
          })
          esperandoAudioRef.current = false
        }
        // La primera canción entra con fundido cuando se abre la experiencia
        // (Oscar): con la pantalla de carga todavía puesta, silencio.
        await esperarDestape()
        resetDiscAndTime()
        if (idx >= 0) setIndex(idx)
        try { await ctxRef.current?.resume() } catch { }
        const c = ctxRef.current
        const g = gainRef.current
        if (c && g) {
          try {
            g.gain.cancelScheduledValues(c.currentTime)
            g.gain.setValueAtTime(0.0001, c.currentTime)
            g.gain.linearRampToValueAtTime(MUSIC_VOLUME, c.currentTime + FUNDIDO_ENTRADA_S)
          } catch { }
        }
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

  // El LED de scratch y el cursor salen de este atributo: sin re-render.
  function setScratchingFlag(on) {
    if (deckRef.current) deckRef.current.dataset.scratching = on ? 'true' : 'false'
  }

  function onDown(e) {
    isDraggingRef.current = true
    setScratchingFlag(true)
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0
    const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0
    draggingFromRef.current = { x: cx, y: cy }
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
    setScratchingFlag(false)
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { }

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
      // El motor (ver FRENO_S). Sin worklet —cargando, o con el <audio> de
      // respaldo— no hay rampa: gira o no gira.
      const dtS = Math.min(0.05, (now - tsPrevRef.current) / 1000)
      if (!srcRef.current) motorRef.current = isPlaying ? 1 : 0
      else if (isPlaying) motorRef.current = Math.min(1, motorRef.current + dtS / ARRANQUE_S)
      else motorRef.current = Math.max(0, motorRef.current - dtS / FRENO_S)
      const motor = motorRef.current
      // Non-drag: avanzar el ángulo a la velocidad del motor.
      if (!isDraggingRef.current && motor > 0) {
        const t = now - tsPrevRef.current
        const advance = clamp(b * t, 0, b * 32) * motor // seguro contra frames largos
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
      // Frenando o arrancando va por el camino del scratch: el rate es el motor.
      updateSpeed(rateSigned, false, secondsPlayed, isDraggingRef.current || (!!srcRef.current && motor < 1))
      // Ya frenó: ahora sí se para. Con la mano encima espera a que la suelte.
      if (!isPlaying && motor <= 0 && srcRef.current && !isDraggingRef.current) pararPlato()

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
    } else if (srcRef.current && (motorRef.current < 1 || !isPlaying)) {
      // Oculta a media rampa: el loop no corre, así que se termina aquí.
      if (isPlaying) {
        motorRef.current = 1
        updateSpeed(1, false, currentTimeRef.current, false)
      } else {
        pararPlato()
      }
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
      // Todavía frenando: el mismo plato vuelve a acelerar (lo hace el loop).
      if (srcRef.current) return
      // Use the accurate ref instead of (potentially stale) React state
      const secondsPlayed = currentTimeRef.current
      playFrom(secondsPlayed, true)
    } else if (fallbackSetRef.current.has(current.src)) {
      try { audioRef.current?.pause() } catch { }
    }
    // Con el worklet, pausar no lo para aquí: el loop lo frena hasta 0 y
    // entonces lo para (FRENO_S).
  }, [isPlaying, current])

  const scratchGuardActive = () => ((typeof performance !== 'undefined' ? performance.now() : Date.now()) - lastScratchTsRef.current) < SCRATCH_GUARD_MS

  // Anterior / siguiente: mismas guardas que antes — no cambiar de pista a
  // media carga, a medio scratch ni justo después de soltar el disco.
  const stepBlocked = !hasTracks || switchingRef.current || isDraggingRef.current || scratchGuardActive()
  function stepTrack(dir) {
    clickSfx()
    if (!hasTracks) return
    if (switchingRef.current) return
    if (isDraggingRef.current) return
    if (scratchGuardActive()) return
    stoppingRef.current = true
    pauseWA()
    switchingRef.current = true
    setIndex((i) => (dir < 0 ? (i - 1 + tracks.length) % tracks.length : getNextIndex(i)))
    setIsPlaying(true)
  }

  function toggleSlowBpm() {
    clickSfx()
    setSlowBpm((v) => {
      const next = !v
      try { localStorage.setItem('musicSlowBpm', next ? '1' : '0') } catch { }
      return next
    })
  }

  // onClose llega como arrow nueva en cada render de App: por ref, para que
  // el efecto del modal no se re-ejecute (y robe el foco) a cada render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Modal a la vista: el foco entra en play, Tab no se sale del deck y
  // Escape cierra primero la lista y luego el deck. Va en captura y con
  // preventDefault para que el Escape de App (salir de la sección) no lo tome.
  useEffect(() => {
    if (!active) { setListOpen(false); return }
    const prevFocus = document.activeElement
    const raf = requestAnimationFrame(() => {
      try { playBtnRef.current?.focus({ preventScroll: true }) } catch { }
    })
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (listOpenRef.current) {
          setListOpen(false)
          try { listBtnRef.current?.focus({ preventScroll: true }) } catch { }
        } else {
          onCloseRef.current?.()
        }
        return
      }
      if (e.key !== 'Tab') return
      const root = deckRef.current
      if (!root) return
      const items = Array.from(root.querySelectorAll('button:not([disabled]), a[href]'))
        .filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      if (!root.contains(at)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && at === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey, true)
      try { prevFocus?.focus?.({ preventScroll: true }) } catch { }
    }
  }, [active])

  // Al abrir la lista: la pista actual al centro y con el foco.
  useEffect(() => {
    if (!listOpen) return
    const list = listRef.current
    const row = list?.querySelector('[aria-current="true"]')
    if (!list || !row) return
    list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2
    try { row.focus({ preventScroll: true }) } catch { }
  }, [listOpen])

  const trackNo = hasTracks ? String(Math.min(index, tracks.length - 1) + 1).padStart(2, '0') : '00'
  const progress = duration ? Math.max(0, Math.min(1, currentTime / duration)) : 0
  const litSegments = Math.round(progress * METER_SEGMENTS)
  const screenText = current
    ? `${current.title || t('music.unknownTitle')}${current.artist ? `  ·  ${current.artist}` : ''}`
    : t('music.noTracks')

  return (
    <div
      ref={deckRef}
      className="sr-deck"
      data-playing={isPlaying ? 'true' : 'false'}
      style={getVinylStyle(current?.vinylColor)}
    >
      <div className="sr-deck__head">
        <span className="sr-deck__mark" aria-hidden="true">SR-90</span>
        <span className="sr-deck__leds" aria-hidden="true">
          <span className="sr-deck__led sr-deck__led--play" />
          <span className="sr-deck__led sr-deck__led--scratch" />
        </span>
        {/* Babosa de slime oculta (#5), pegada al chasis junto a los LEDs.
            Reto: no se anuncia. */}
        <SlimeSlugDOM id="music" size={26} style={{ position: 'relative', flexShrink: 0 }} />
        <span className="sr-deck__grille" aria-hidden="true" />
        <div className="sr-deck__head-actions">
          {hasTracks && tracks.length > 1 && (
            <button
              ref={listBtnRef}
              type="button"
              className="sr-deck__round"
              aria-expanded={listOpen}
              aria-controls="sr-deck-list"
              aria-label={listOpen ? t('music.hideList') : t('music.showList')}
              data-tip={listOpen ? t('music.hideList') : t('music.showList')}
              data-tip-side="bottom"
              onMouseEnter={() => hoverSfx(0.6)}
              onClick={() => { clickSfx(); setListOpen((o) => !o) }}
            >
              <QueueListIcon className="w-5 h-5" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="sr-deck__round"
              aria-label={t('music.close')}
              data-tip={t('music.close')}
              data-tip-side="bottom"
              onMouseEnter={() => hoverSfx(0.6)}
              onClick={() => { clickSfx(); onClose() }}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="sr-deck__screen">
        <ScreenTitle text={screenText} />
        <div className="sr-deck__readout">
          <span className="sr-deck__time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          {hasTracks && (
            <span className="sr-deck__chip">
              <span aria-hidden="true">{trackNo}</span>
              <span className="sr-only">{t('music.trackOf', { n: Math.min(index, tracks.length - 1) + 1, total: tracks.length })}</span>
            </span>
          )}
        </div>
        <div
          className="sr-deck__meter"
          role="progressbar"
          aria-label={t('music.progress')}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        >
          {Array.from({ length: METER_SEGMENTS }, (_, i) => (
            <span
              key={i}
              data-on={i < litSegments ? 'true' : 'false'}
              data-head={i === litSegments - 1 ? 'true' : undefined}
            />
          ))}
        </div>
      </div>

      <div className="sr-deck__platter">
        <div className="sr-deck__well">
          <div ref={discElRef} className="sr-deck__disc" aria-hidden="true">
            <span className="sr-deck__groove" />
            <span className="sr-deck__band" />
            <span className="sr-deck__axis">
              <span className="sr-deck__print">{slowBpm ? '16⅔' : '33⅓'}</span>
              <span className="sr-deck__print sr-deck__print--b">RPM</span>
            </span>
            <span className="sr-deck__label">
              {current?.cover ? (
                <img src={resolveUrl(current.cover)} alt="" className="sr-deck__cover" draggable={false} />
              ) : (
                <CoverFromMeta src={current?.src} className="sr-deck__cover" alt="" />
              )}
            </span>
            <span className="sr-deck__spindle" />
          </div>
          <div
            className="sr-deck__hit"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

        <button
          type="button"
          className="sr-deck__key sr-deck__key--tl"
          aria-pressed={slowBpm}
          aria-label={t('music.slowBpm')}
          data-tip={t('music.slowBpm')}
          onMouseEnter={() => hoverSfx(0.6)}
          onClick={toggleSlowBpm}
        >
          <span className="sr-deck__key-text">½×</span>
        </button>
        <button
          type="button"
          className="sr-deck__key sr-deck__key--tr"
          disabled={!hasTracks}
          aria-pressed={shuffle}
          aria-label={t('music.shuffle')}
          data-tip={t('music.shuffle')}
          onMouseEnter={() => hoverSfx(0.6)}
          onClick={() => { clickSfx(); setShuffle((v) => !v) }}
        >
          <ArrowsRightLeftIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          className="sr-deck__key sr-deck__key--bl"
          disabled={!hasTracks}
          aria-pressed={repeatOne}
          aria-label={t('music.repeat')}
          data-tip={t('music.repeat')}
          onMouseEnter={() => hoverSfx(0.6)}
          onClick={() => { clickSfx(); setRepeatOne((v) => !v) }}
        >
          <ArrowPathIcon className="w-5 h-5" />
          <span className="sr-deck__key-badge" aria-hidden="true">1</span>
        </button>
        <a
          href={resolveUrl(current?.src) || '#'}
          download
          className="sr-deck__key sr-deck__key--br"
          aria-label={current?.title ? t('music.downloadTitle', { title: current.title }) : t('music.downloadThisTrack')}
          data-tip={t('music.downloadThisTrack')}
          onMouseEnter={() => hoverSfx(0.6)}
          onClick={handleDownloadCurrentTrack}
        >
          <ArrowDownTrayIcon className="w-5 h-5" />
        </a>

        {listOpen && (
          <div id="sr-deck-list" ref={listRef} className="sr-deck__list modal-scroll">
            {tracks.map((track, i) => (
              <button
                key={track.src || i}
                type="button"
                className="sr-deck__row"
                aria-current={i === index ? 'true' : undefined}
                onMouseEnter={() => hoverSfx(0.5)}
                onClick={() => {
                  selectTrack(i)
                  try { listBtnRef.current?.focus({ preventScroll: true }) } catch { }
                }}
              >
                <span className="sr-deck__chip sr-deck__row-no">{String(i + 1).padStart(2, '0')}</span>
                <span className="sr-deck__row-text">
                  <span className="sr-deck__row-title">{track.title || t('music.unknownTitle')}</span>
                  {track.artist && <span className="sr-deck__row-artist">{track.artist}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sr-deck__keys">
        <button
          type="button"
          className="sr-deck__pad"
          disabled={stepBlocked}
          aria-label={t('music.previous')}
          data-tip={t('music.previous')}
          onMouseEnter={() => hoverSfx(0.9)}
          onClick={() => stepTrack(-1)}
        >
          <BackwardIcon className="w-7 h-7" />
        </button>
        <button
          ref={playBtnRef}
          type="button"
          className="sr-deck__pad sr-deck__pad--play"
          disabled={!hasTracks}
          aria-label={isPlaying ? t('music.pause') : t('music.play')}
          data-tip={isPlaying ? t('music.pause') : t('music.play')}
          onMouseEnter={() => hoverSfx(0.9)}
          onClick={() => { clickSfx(); setIsPlaying((v) => !v) }}
        >
          {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
        </button>
        <button
          type="button"
          className="sr-deck__pad"
          disabled={stepBlocked}
          aria-label={t('music.next')}
          data-tip={t('music.next')}
          onMouseEnter={() => hoverSfx(0.9)}
          onClick={() => stepTrack(1)}
        >
          <ForwardIcon className="w-7 h-7" />
        </button>
      </div>

      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}

function hoverSfx(volume) { try { playSfx('hover', { volume }) } catch { } }
function clickSfx() { try { playSfx('click', { volume: 1.0 }) } catch { } }

// Título de la pantalla: quieto si cabe; si no, corre en loop (dos copias +
// marquee-seamless; el padding del track iguala el gap para que la costura no
// brinque). Se mide al cambiar el texto y cuando cambia el ancho del visor o
// el del texto: Doto llega con swap y la primera medida sale con la fuente de
// respaldo, más angosta o más ancha.
function ScreenTitle({ text }) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [scroll, setScroll] = useState(false)
  useLayoutEffect(() => {
    const box = boxRef.current
    const span = textRef.current
    if (!box || !span) return
    const check = () => {
      const w = span.offsetWidth
      const over = w > box.clientWidth + 1
      if (over) box.style.setProperty('--ticker-dur', `${Math.max(6, (w + 60) / 45).toFixed(2)}s`)
      setScroll(over)
    }
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(box)
    // Es flex item (se vuelve bloque), así que el observer sí ve su ancho.
    ro?.observe(span)
    return () => ro?.disconnect()
  }, [text])
  return (
    <div ref={boxRef} className="sr-deck__title" data-scroll={scroll ? 'true' : 'false'}>
      <span className="sr-deck__title-track">
        <span ref={textRef}>{text}</span>
        {scroll && <span aria-hidden="true">{text}</span>}
      </span>
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
    ; (async () => {
      try {
        const url = (() => {
          try {
            const path = src.replace(/^\/+/, '')
            return encodeURI(new URL(path, import.meta.env.BASE_URL).href)
          } catch { return encodeURI(src) }
        })()
        const blob = new Blob([await fetchTrackBytes(url)])
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
