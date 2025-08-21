// Pequeño util para reproducir SFX desde /public
// Intenta primero en public/fx y luego en la raíz de public como fallback

const cache = new Map()
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
      return url
    } catch {
      // probar siguiente candidato
    }
  }
  // último recurso: guardar el primero aun si no se pudo precargar
  const fallback = urls[0]
  cache.set(name, fallback)
  return fallback
}

export async function playSfx(name, opts = {}) {
  if (!enabled) return
  const { volume = 1.0 } = opts
  try {
    const url = await ensurePreloaded(name)
    const a = new Audio(url)
    a.volume = Math.max(0, Math.min(1, volume * masterVolume))
    // Evitar bloqueo por políticas: se asume que ya hubo una interacción del usuario
    a.play().catch(() => {})
  } catch {
    // silencio en error
  }
}

export function setSfxEnabled(v) {
  enabled = !!v
}

export function preloadSfx(names = []) {
  names.forEach((n) => { ensurePreloaded(n).catch(() => {}) })
}

export function setSfxMasterVolume(v) {
  const nv = Number(v)
  if (!Number.isFinite(nv)) return
  masterVolume = Math.max(0, Math.min(1, nv))
}

export function getSfxMasterVolume() {
  return masterVolume
}


