// La canción del lobby (la pantalla principal). Vive aquí y no en el preloader
// para que no se corte al entrar a una versión (Oscar: un fundido de la del
// lobby a la del sitio, la primera del tracklist del CMS, desde el clic):
//   - a la experiencia completa (no recarga): desde el clic en su botón aquí
//     mismo arranca la canción del sitio y se cruzan (`cruzarASitio`); cuando
//     el reproductor se monta (con Skulley ya en la home) la toma en el mismo
//     segundo (`tomarSitio`). Si algo falla, la del
//     lobby sigue y el reproductor la releva al arrancar (`recibirLobby`);
//   - a la versión simple (recarga): baja con fundido antes de irse
//     (`despedirLobby`) y del otro lado la del sitio entra con fundido.
// La del lobby es la misma canción del tracklist (songs/, la del servidor).
export const LOBBY_SRC = 'songs/MADRE (Lobby Remix).mp3'
const VOLUMEN = 0.5
const LLAVE = 'skulley_lobby'
const BASE = import.meta.env.BASE_URL || '/'

let audio = null
let tope = 0
let sitio = null // { audio, src }
let topeSitio = 0
let manifiesto = null
const rafs = new WeakMap()

// Si la página anterior venía sonando el lobby (versión simple), leído una
// sola vez al cargar.
let llegoDelLobby = (() => {
  try {
    const v = sessionStorage.getItem(LLAVE)
    sessionStorage.removeItem(LLAVE)
    return v === '1'
  } catch { return false }
})()

function fundir(a, hasta, segundos, alAcabar) {
  if (!a) return
  cancelAnimationFrame(rafs.get(a) || 0)
  const desde = a.volume
  const t0 = performance.now()
  const dura = segundos * 1000
  // Con performance.now() y no con la hora del cuadro: esa puede ser de antes
  // de t0 (un clic atendido antes de dibujar el cuadro), el volumen salía
  // negativo, el navegador lanzaba un error y el fundido se quedaba en 0: la
  // canción del lobby corría muda.
  const paso = () => {
    const u = dura > 0 ? Math.min(1, Math.max(0, (performance.now() - t0) / dura)) : 1
    a.volume = Math.min(1, Math.max(0, desde + (hasta - desde) * u))
    if (u < 1) rafs.set(a, requestAnimationFrame(paso))
    else alAcabar?.()
  }
  rafs.set(a, requestAnimationFrame(paso))
}

function apagar(a) {
  if (!a) return
  a.pause()
  a.removeAttribute('src')
}

function soltar() {
  apagar(audio)
  audio = null
}

// Con fundido: entra (`suena`) o se va y se pausa.
export function sonarLobby(suena, segundos = 1) {
  if (!audio) {
    if (!suena) return
    audio = new Audio(`${BASE}${encodeURI(LOBBY_SRC)}`)
    audio.loop = true
    audio.volume = 0
  }
  clearTimeout(tope)
  if (suena && audio.paused) audio.play().catch(() => { })
  if (suena) prepararSitio()
  fundir(audio, suena ? VOLUMEN : 0, segundos, suena ? null : () => audio?.pause())
}

export function lobbySuena() {
  return Boolean(audio && !audio.paused && audio.volume > 0.01)
}

// Entrando a la completa: sigue sonando hasta que la releven; si nadie la
// releva en `topeMs`, se va sola.
export function esperarRelevo(topeMs = 20000) {
  clearTimeout(tope)
  tope = setTimeout(() => sonarLobby(false, 1.5), topeMs)
}

export function relevoPendiente() {
  return lobbySuena() || Boolean(sitio)
}

// La canción de entrada del sitio: la primera del tracklist del CMS.
function prepararSitio() {
  if (!manifiesto) {
    manifiesto = fetch(`${BASE}songs/manifest.json`, { cache: 'no-cache' })
      .then((r) => r.json())
      .then((t) => (Array.isArray(t) && typeof t[0]?.src === 'string' ? t[0].src : null))
      .catch(() => null)
  }
  return manifiesto
}

// Al entrar a la completa: arranca la canción del sitio y se cruza con la del
// lobby en `segundos`. Dice si se pudo.
export async function cruzarASitio(segundos = 2.5) {
  if (!lobbySuena() || sitio) return false
  const src = await prepararSitio()
  if (!src || !lobbySuena()) return false
  const a = new Audio(`${BASE}${encodeURI(src)}`)
  a.volume = 0
  try { await a.play() } catch { return false }
  sitio = { audio: a, src }
  fundir(a, VOLUMEN, segundos)
  clearTimeout(tope)
  fundir(audio, 0, segundos, soltar)
  // Si el reproductor no la toma (no se montó), se va sola.
  clearTimeout(topeSitio)
  topeSitio = setTimeout(() => {
    const s = sitio
    sitio = null
    if (s) fundir(s.audio, 0, 2, () => apagar(s.audio))
  }, 60000)
  return true
}

// El reproductor arranca `src`: si es la que ya suena desde el preloader, da
// en qué segundo va y esa se apaga en un instante (el reproductor sigue desde
// ahí, sin que se note el relevo).
export function tomarSitio(src) {
  const s = sitio
  if (!s || s.src !== src || s.audio.paused) return null
  sitio = null
  clearTimeout(topeSitio)
  const tiempo = s.audio.currentTime
  fundir(s.audio, 0, 0.15, () => apagar(s.audio))
  return { tiempo }
}

// El reproductor arranca la canción del sitio sin relevo del preloader: si
// venía sonando el lobby (aquí, o antes de recargar), la del lobby baja en
// `segundos` y el reproductor sube la suya en el mismo tiempo. Dice si hubo.
export function recibirLobby(segundos) {
  if (lobbySuena()) {
    clearTimeout(tope)
    fundir(audio, 0, segundos, soltar)
    return true
  }
  if (llegoDelLobby) {
    llegoDelLobby = false
    return true
  }
  return false
}

// Antes de recargar (versión simple): baja con fundido y deja dicho que venía
// sonando, para que del otro lado la canción del sitio entre con fundido.
export function despedirLobby(segundos = 0.6) {
  if (!lobbySuena()) return
  try { sessionStorage.setItem(LLAVE, '1') } catch { /* sin storage: entra sin fundido */ }
  fundir(audio, 0, segundos, () => audio?.pause())
}
