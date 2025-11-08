// Pequeño util para reproducir SFX desde /public
// Intenta primero en public/fx y luego en la raíz de public como fallback

const cache = new Map()
// Pool simple de instancias HTMLAudio por clip para evitar crear objetos en cada play
const pool = new Map() // name -> { url, nodes: HTMLAudioElement[], idx: number }
const POOL_SIZE = 4
// WebAudio (mejor latencia y menor jank)
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
      // Esperar metadata suficiente para poder reproducir rápido
      await new Promise((resolve, reject) => {
        const onCanPlay = () => { cleanup(); resolve() }
        const onError = () => { cleanup(); reject(new Error('audio error')) }
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onCanPlay)
          audio.removeEventListener('error', onError)
        }
        audio.addEventListener('canplaythrough', onCanPlay, { once: true })
        audio.addEventListener('error', onError, { once: true })
        // fallback timeout para no colgar
        setTimeout(() => { cleanup(); resolve() }, 400)
      })
      cache.set(name, url)
      // Inicializar pool del clip si no existe
      if (!pool.has(name)) {
        const nodes = Array.from({ length: POOL_SIZE }, () => {
          const a = new Audio(url)
          a.preload = 'auto'
          // Avanzar silenciosamente a 0 para calentar
          try { a.currentTime = 0 } catch {}
          return a
        })
        pool.set(name, { url, nodes, idx: 0 })
      }
      return url
    } catch {
      // probar siguiente candidato
    }
  }
  // último recurso: guardar el primero aun si no se pudo precargar
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
    // Intentar WebAudio primero
    if (ctx) {
      const buffer = await ensureDecodedBuffer(name)
      if (buffer) {
        // Reanudar contexto si está suspendido (algunas plataformas)
        try { if (ctx.state === 'suspended') await ctx.resume() } catch {}
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const gain = ctx.createGain()
        gain.gain.value = Math.max(0, Math.min(1, volume * masterVolume))
        src.connect(gain)
        gain.connect(masterGainNode)
        // Limpieza básica
        src.onended = () => {
          try { src.disconnect() } catch {}
          try { gain.disconnect() } catch {}
        }
        src.start(0)
        return
      }
    }
    // Fallback HTMLAudio con pool
    await ensurePreloaded(name)
    const entry = pool.get(name)
    if (entry && entry.nodes && entry.nodes.length) {
      // Round-robin simple
      const startIdx = entry.idx
      let used = null
      for (let i = 0; i < entry.nodes.length; i++) {
        const idx = (startIdx + i) % entry.nodes.length
        const candidate = entry.nodes[idx]
        // Reutilizar aunque esté reproduciendo: reiniciar desde 0 da "overlap" mínimamente
        used = candidate
        entry.idx = (idx + 1) % entry.nodes.length
        break
      }
      if (used) {
        used.volume = Math.max(0, Math.min(1, volume * masterVolume))
        try { used.currentTime = 0 } catch {}
        used.play().catch(() => {})
        return
      }
    }
    // Fallback si no hay pool disponible
    const url = cache.get(name) || (await ensurePreloaded(name))
    const a = new Audio(url)
    a.volume = Math.max(0, Math.min(1, volume * masterVolume))
    a.play().catch(() => {})
  } catch {
    // silencio en error
  }
}

export function setSfxEnabled(v) {
  enabled = !!v
}

export function preloadSfx(names = []) {
  names.forEach((n) => {
    ensurePreloaded(n).catch(() => {})
    // Predecodificar en WebAudio si está disponible
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


