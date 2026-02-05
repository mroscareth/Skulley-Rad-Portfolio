// Small utility for playing SFX from /public
// Tries public/fx first, then root of public as fallback

const cache = new Map()
// Simple HTMLAudio instance pool per clip to avoid creating objects on each play
const pool = new Map() // name -> { url, nodes: HTMLAudioElement[], idx: number }
const POOL_SIZE = 4
// WebAudio (better latency, less jank)
let audioCtx = null
let masterGainNode = null
const bufferCache = new Map() // name -> AudioBuffer

function ensureAudioContext() {
  if (typeof window === 'undefined') return null
  if (audioCtx) return audioCtx
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  audioCtx = new Ctor()
  masterGainNode = audioCtx.createGain()
  masterGainNode.gain.value = masterVolume
  masterGainNode.connect(audioCtx.destination)
  return audioCtx
}
let enabled = true
let masterVolume = 0.5 // 50%

// Per-SFX gain (before masterVolume).
// Useful for boosting click/hover volume without affecting other SFX.
const perSfxGain = {
  hover: 1.4,
  click: 1.4,
}

function computeFinalVolume(name, volume) {
  const v = Number.isFinite(volume) ? volume : 1.0
  const g = perSfxGain && Object.prototype.hasOwnProperty.call(perSfxGain, name) ? perSfxGain[name] : 1.0
  return Math.max(0, Math.min(1, v * g * masterVolume))
}

function resolveUrl(name) {
  const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/'
  const candidates = [
    `${base}fx/${name}.wav`,
    `${base}${name}.wav`,
  ]
  return candidates
}

async function ensurePreloaded(name) {
  if (cache.has(name)) return cache.get(name)
  const urls = resolveUrl(name)
  for (const url of urls) {
    try {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.src = url
      // Wait for enough metadata to play quickly
      await new Promise((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve() }
        const onError = () => { cleanup(); reject(new Error('audio error')) }
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay)
          audio.removeEventListener('error', onError)
        }
        audio.addEventListener('canplaythrough', onCanPlay, { once: true })
        audio.addEventListener('error', onError, { once: true })
        // fallback timeout to avoid hanging
        setTimeout(() => { cleanup(); resolve() }, 400)
      })
      cache.set(name, url)
      // Initialize clip pool if not exists
      if (!pool.has(name)) {
        const nodes = Array.from({ length: POOL_SIZE }, () => {
          const a = new Audio(url)
          a.preload = 'auto'
          // Silently advance to 0 for warmup
          try { a.currentTime = 0 } catch {}
          return a
        })
        pool.set(name, { url, nodes, idx: 0 })
      }
      return url
    } catch {
      // try next candidate
    }
  }
  // last resort: save first one even if preload failed
  const fallback = urls[0]
  cache.set(name, fallback)
  if (!pool.has(name)) {
    const nodes = Array.from({ length: POOL_SIZE }, () => {
      const a = new Audio(fallback)
      a.preload = 'auto'
      try { a.currentTime = 0 } catch {}
      return a
    })
    pool.set(name, { url: fallback, nodes, idx: 0 })
  }
  return fallback
}

async function ensureDecodedBuffer(name) {
  if (bufferCache.has(name)) return bufferCache.get(name)
  const ctx = ensureAudioContext()
  if (!ctx) return null
  const url = cache.get(name) || (await ensurePreloaded(name))
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    const arr = await res.arrayBuffer()
    const buf = await ctx.decodeAudioData(arr.slice(0))
    bufferCache.set(name, buf)
    return buf
  } catch {
    return null
  }
}

export async function playSfx(name, opts = {}) {
  if (!enabled) return
  const { volume = 1.0 } = opts
  try {
    const ctx = ensureAudioContext()
    // Try WebAudio first
    if (ctx) {
      const buffer = await ensureDecodedBuffer(name)
      if (buffer) {
        // Resume context if suspended (some platforms)
        try { if (ctx.state === 'suspended') await ctx.resume() } catch {}
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = computeFinalVolume(name, volume)
        src.connect(gain)
        gain.connect(masterGainNode)
        // Basic cleanup
        src.onended = () => {
          try { src.disconnect() } catch {}
          try { gain.disconnect() } catch {}
        }
        src.start(0)
        return
      }
    }
    // Fallback HTMLAudio with pool
    await ensurePreloaded(name)
    const entry = pool.get(name)
    if (entry && entry.nodes && entry.nodes.length) {
      // Round-robin simple
      const startIdx = entry.idx
      let used = null
      for (let i = 0; i < entry.nodes.length; i++) {
        const idx = (startIdx + i) % entry.nodes.length
        const candidate = entry.nodes[idx]
        // Reuse even if playing: resetting to 0 gives minimal "overlap"
        used = candidate
        entry.idx = (idx + 1) % entry.nodes.length
        break
      }
      if (used) {
        used.volume = computeFinalVolume(name, volume)
        try { used.currentTime = 0 } catch {}
        used.play().catch(() => {})
        return
      }
    }
    // Fallback if no pool available
    const url = cache.get(name) || (await ensurePreloaded(name))
    const a = new Audio(url)
    a.volume = computeFinalVolume(name, volume)
    a.play().catch(() => {})
  } catch {
    // silence on error
  }
}

export function setSfxEnabled(v) {
  enabled = !!v
}

export function preloadSfx(names = []) {
  names.forEach((n) => {
    ensurePreloaded(n).catch(() => {})
    // Pre-decode in WebAudio if available
    Promise.resolve().then(() => ensureDecodedBuffer(n)).catch(() => {})
  })
}

export function setSfxMasterVolume(v) {
  const nv = Number(v)
  if (!Number.isFinite(nv)) return
  masterVolume = Math.max(0, Math.min(1, nv))
  if (masterGainNode) {
    try { masterGainNode.gain.value = masterVolume } catch {}
  }
}

export function getSfxMasterVolume() {
  return masterVolume
}


