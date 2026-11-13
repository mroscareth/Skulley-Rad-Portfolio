// La canción del lobby (la pantalla principal). Vive aquí y no en el preloader
// para que no se corte al entrar a una versión (Oscar: un fundido de la del
// lobby a la del sitio, la primera del tracklist del CMS):
//   - a la experiencia completa (no recarga) sigue sonando hasta que el
//     reproductor arranca la canción del sitio, y ahí se cruzan: la del lobby
//     baja mientras la otra sube (`recibirLobby`);
//   - a la versión simple (recarga) baja con fundido antes de irse
//     (`despedirLobby`) y del otro lado la del sitio entra con fundido.
// Es la misma canción del tracklist (songs/, la del servidor).
export const LOBBY_SRC = 'songs/MADRE (Lobby Remix).mp3'
const VOLUMEN = 0.5
const LLAVE = 'skulley_lobby'

let audio = null
let raf = 0
let tope = 0

// Si la página anterior venía sonando el lobby (versión simple), leído una
// sola vez al cargar.
let llegoDelLobby = (() => {
  try {
    const v = sessionStorage.getItem(LLAVE)
    sessionStorage.removeItem(LLAVE)
    return v === '1'
  } catch { return false }
})()

function fundir(hasta, segundos, alAcabar) {
  const a = audio
  if (!a) return
  cancelAnimationFrame(raf)
  const desde = a.volume
  const t0 = performance.now()
  const dura = segundos * 1000
  const paso = (ahora) => {
    const u = dura > 0 ? Math.min(1, (ahora - t0) / dura) : 1
    a.volume = desde + (hasta - desde) * u
    if (u < 1) raf = requestAnimationFrame(paso)
    else alAcabar?.()
  }
  raf = requestAnimationFrame(paso)
}

function soltar() {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio = null
}

// Con fundido: entra (`suena`) o se va y se pausa.
export function sonarLobby(suena, segundos = 1) {
  if (!audio) {
    if (!suena) return
    audio = new Audio(`${import.meta.env.BASE_URL}${encodeURI(LOBBY_SRC)}`)
    audio.loop = true
    audio.volume = 0
  }
  clearTimeout(tope)
  if (suena && audio.paused) audio.play().catch(() => { })
  fundir(suena ? VOLUMEN : 0, segundos, suena ? null : () => audio?.pause())
}

export function lobbySuena() {
  return Boolean(audio && !audio.paused && audio.volume > 0.01)
}

// Entrando a la completa: sigue sonando hasta que el reproductor la releve; si
// nadie la releva en `topeMs`, se va sola.
export function esperarRelevo(topeMs = 20000) {
  clearTimeout(tope)
  tope = setTimeout(() => sonarLobby(false, 1.5), topeMs)
}

export function relevoPendiente() {
  return lobbySuena()
}

// El reproductor arranca la canción del sitio: si venía sonando el lobby
// (aquí, o antes de recargar), la del lobby baja en `segundos` y el
// reproductor sube la suya en el mismo tiempo. Dice si hubo relevo.
export function recibirLobby(segundos) {
  if (lobbySuena()) {
    clearTimeout(tope)
    fundir(0, segundos, soltar)
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
  fundir(0, segundos, () => audio?.pause())
}
