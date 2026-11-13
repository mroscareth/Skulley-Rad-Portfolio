// La canción del lobby (la pantalla principal) y el paso de la música entre el
// lobby y las experiencias (Oscar): al picar un botón que cambia de pantalla,
// la que suena se va con fundido (`despedirMusica`); en la pantalla de carga ya
// hay silencio, y la de llegada entra con fundido cuando se abre el iris
// (`esperarDestape`). Igual de ida que de regreso:
//   - lobby → experiencia: el lobby baja desde el clic y el reproductor del
//     sitio sube su primera canción al abrirse la experiencia;
//   - experiencia → lobby (Volver al inicio, el atrás del navegador) y de una
//     versión a otra: el reproductor baja antes de la cortinilla, y en el
//     lobby la canción sube al abrirse si se venía con sonido
//     (`llegaConSonido`; la bocina arranca encendida).
// La del lobby es la misma canción del tracklist (songs/, la del servidor).
import { irisTapando } from './irisTransition.js'

export const LOBBY_SRC = 'songs/MADRE (Lobby Remix).mp3'
const VOLUMEN = 0.5
const LLAVE = 'skulley_sonido'
const BASE = import.meta.env.BASE_URL || '/'
// Lo que tarda en irse la música al cambiar de pantalla, y en entrar la de la
// pantalla nueva (s).
export const FUNDIDO_SALIDA_S = 0.9
export const FUNDIDO_ENTRADA_S = 2.5

let audio = null
let silencioEn = 0
const rafs = new WeakMap()

// Si la página anterior venía con música, leído una sola vez al cargar (se
// puede preguntar las veces que sea: en desarrollo React corre dos veces los
// inicializadores de estado).
const llegoConSonido = (() => {
  try {
    const v = sessionStorage.getItem(LLAVE)
    sessionStorage.removeItem(LLAVE)
    return v === '1'
  } catch { return false }
})()

export const llegaConSonido = () => llegoConSonido

// El volumen de un <audio> de `a.volume` a `hasta` en `segundos`.
export function fundir(a, hasta, segundos, alAcabar) {
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

// Sin gesto en esta página (llegando de otra), el navegador puede no dejarla
// sonar: lo intenta otra vez con el primer clic o tecla.
let esperandoGesto = false
function tocar() {
  audio.play().catch(() => {
    if (esperandoGesto) return
    esperandoGesto = true
    const reintentar = () => {
      esperandoGesto = false
      window.removeEventListener('pointerdown', reintentar, true)
      window.removeEventListener('keydown', reintentar, true)
      if (audio && audio.paused && audio.volume > 0) audio.play().catch(() => { })
    }
    window.addEventListener('pointerdown', reintentar, true)
    window.addEventListener('keydown', reintentar, true)
  })
}

// Con fundido: entra (`suena`) o se va y se pausa.
export function sonarLobby(suena, segundos = 1) {
  if (!audio) {
    if (!suena) return
    audio = new Audio(`${BASE}${encodeURI(LOBBY_SRC)}`)
    audio.loop = true
    audio.volume = 0
  }
  if (suena && audio.paused) tocar()
  fundir(audio, suena ? VOLUMEN : 0, segundos, suena ? null : () => audio?.pause())
}

export function lobbySuena() {
  return Boolean(audio && !audio.paused && audio.volume > 0.01)
}

// Al picar un botón que cambia de pantalla: la música que suene (el lobby, o
// el reproductor del sitio, que escucha `musica-despedir`) se va en
// FUNDIDO_SALIDA_S, y la página siguiente sabe si se venía con sonido. Da
// cuándo queda el silencio; si ya se estaba yendo, el mismo momento.
export function despedirMusica() {
  const ahora = performance.now()
  if (silencioEn > ahora) return silencioEn
  const aviso = { segundos: FUNDIDO_SALIDA_S, sonaba: false }
  try { window.dispatchEvent(new CustomEvent('musica-despedir', { detail: aviso })) } catch { }
  const sonaba = aviso.sonaba || lobbySuena()
  if (lobbySuena()) sonarLobby(false, FUNDIDO_SALIDA_S)
  try {
    if (sonaba) sessionStorage.setItem(LLAVE, '1')
    else sessionStorage.removeItem(LLAVE)
  } catch { /* sin storage: el lobby llega con la bocina apagada */ }
  silencioEn = ahora + (sonaba ? FUNDIDO_SALIDA_S * 1000 : 0)
  return silencioEn
}

// Hasta que la música se fue (despedirMusica).
export function esperarSilencio() {
  const falta = silencioEn - performance.now()
  return falta > 0 ? new Promise((r) => setTimeout(r, falta)) : Promise.resolve()
}

// Hasta que el iris deja ver la pantalla (o al tope): la música de llegada no
// suena con la pantalla de carga.
export function esperarDestape(topeMs = 20000) {
  return new Promise((listo) => {
    const t0 = performance.now()
    const revisa = () => {
      if (!irisTapando() || performance.now() - t0 > topeMs) listo()
      else setTimeout(revisa, 100)
    }
    revisa()
  })
}
