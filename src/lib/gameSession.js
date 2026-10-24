// Boleto de partida del minigame de esferas.
//
// Al empezar cada partida se pide uno al servidor (profile.php?action=game_start)
// y save_score lo consume — el golden ticket vale dinero.
//
// Se pide aunque el jugador no haya iniciado sesión: se juega libre y el login
// se pide al final, cuando ya ganó algo y registrarse tiene sentido.
//
// Por eso existen más piezas que un simple boleto:
//
//   La bitácora: cada captura se anota con recordCapture() y viaja al servidor
//   en latidos cada BEAT_MS (game_beat). El servidor lleva su propia suma y
//   save_score nunca acepta un score mayor. Las capturas tienen que llegar
//   mientras se juega: una que llega con mucho atraso ya no cuenta, por eso
//   también se manda al ocultar la pestaña.
//
//   endGameSession() manda las últimas capturas y sella en el servidor CUÁNDO
//   terminó la partida; después del sello no entra nada. takeGameToken()
//   espera ese cierre, para que save_score no llegue antes que la suma final.
//
//   El "reclamo pendiente" guarda {token, score, tier} en sessionStorage, no en
//   memoria, porque según el método de login Privy puede recargar la página y
//   una variable se perdería justo con el premio dentro.

const API = `${import.meta.env.BASE_URL}api/profile.php`
const CLAIM_KEY = 'skulley_pending_score'
const BEAT_MS = 5000
// Igual que GAME_MAX_EVENTS_PER_BEAT en profile.php.
const MAX_BATCH = 80

let pending = null // promesa del boleto de la partida en curso
let ending = null // promesa del cierre (últimas capturas + sello)
let run = null // { token, t0, events, acked, timer, sending }

function post(action, body, keepalive = false) {
  return fetch(`${API}?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  }).then(r => r.json())
}

async function send(r, action) {
  const token = await r.token
  if (!token) return
  const batch = r.events.slice(r.acked, r.acked + MAX_BATCH)
  if (action === 'game_beat' && !batch.length) return
  const d = await post(action, { game_token: token, seq: r.acked, events: batch }, action === 'game_end')
  if (d?.ok && Number.isInteger(d.n)) r.acked = d.n
}

function beat(r) {
  if (!r.sending) {
    r.sending = send(r, 'game_beat').catch(() => {}).finally(() => { r.sending = null })
  }
  return r.sending
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && run) beat(run)
  })
}

export function startGameSession() {
  if (run) clearInterval(run.timer)
  ending = null
  pending = post('game_start', {})
    .then(d => (d?.ok ? d.game_token : null))
    .catch(() => null)
  const r = { token: pending, t0: performance.now(), events: [], acked: 0, timer: null, sending: null }
  r.timer = setInterval(() => beat(r), BEAT_MS)
  run = r
  return pending
}

/** Anota una captura de la partida en curso: delta = puntos que sumó o restó. */
export function recordCapture(delta) {
  if (!run) return
  run.events.push([Math.round(performance.now() - run.t0), delta])
}

async function closeRun(r) {
  clearInterval(r.timer)
  const token = await r.token
  if (!token) return null
  if (r.sending) await r.sending
  // Una racha larga puede dejar más de un lote pendiente.
  for (let i = 0; i < 5 && r.events.length - r.acked > MAX_BATCH; i++) {
    await send(r, 'game_beat').catch(() => {})
  }
  for (let i = 0; i < 2; i++) {
    try {
      await send(r, 'game_end')
      break
    } catch {
      // Un reintento. Si tampoco sale, el servidor se queda con lo que ya
      // recibió en latidos y el score se guarda recortado a eso.
    }
  }
  return token
}

// Devuelve el boleto de la partida en curso y lo olvida: un boleto, un score.
export async function takeGameToken() {
  const p = pending
  pending = null
  if (ending) await ending
  return p ? await p : null
}

/**
 * Cierra la partida: manda las últimas capturas, sella el final en el
 * servidor y, si no hay sesión, deja el score apartado para reclamarlo
 * después de iniciarla.
 *
 * Se llama SIEMPRE al terminar, con sesión o sin ella: sin el cierre, el
 * servidor no tendría las últimas capturas.
 */
export async function endGameSession(score, tier, { authenticated = false } = {}) {
  const r = run
  run = null
  if (!r) return null
  // Se asigna antes de cualquier await: takeGameToken() puede llamarse en el
  // mismo tick (el modal de game over guarda el score al abrirse).
  ending = closeRun(r).catch(() => null)
  const token = await ending
  if (!token || authenticated) return token

  // Sin sesión el boleto no se consume todavía: se aparta con el score. Si
  // mientras tanto ya empezó otra partida, su boleto no se toca.
  if (pending === r.token) pending = null
  try {
    sessionStorage.setItem(CLAIM_KEY, JSON.stringify({ token, score, tier: tier || null }))
  } catch {
    // Modo privado o storage lleno: se pierde el reclamo, no la partida.
  }
  return token
}

/** El reclamo apartado, sin consumirlo. */
export function peekPendingClaim() {
  try {
    const raw = sessionStorage.getItem(CLAIM_KEY)
    if (!raw) return null
    const c = JSON.parse(raw)
    return c && c.token && typeof c.score === 'number' ? c : null
  } catch {
    return null
  }
}

export function clearPendingClaim() {
  try { sessionStorage.removeItem(CLAIM_KEY) } catch { /* nada que limpiar */ }
}
