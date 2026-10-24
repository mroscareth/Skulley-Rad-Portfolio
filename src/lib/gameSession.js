// Boleto de partida del minigame de esferas.
//
// Al empezar cada partida se pide uno al servidor (profile.php?action=game_start)
// y save_score lo consume. Así el backend sabe cuánto duró la partida y puede
// rechazar un score imposible para ese tiempo — el golden ticket vale dinero.
//
// Se pide aunque el jugador no haya iniciado sesión: se juega libre y el login
// se pide al final, cuando ya ganó algo y registrarse tiene sentido.
//
// Por eso existen dos piezas más que un simple boleto:
//
//   endGameSession() sella en el servidor CUÁNDO terminó la partida. Sin ese
//   sello, la verosimilitud del score se mediría contra el momento del envío,
//   y cada minuto que alguien tarde en iniciar sesión le ampliaría el techo de
//   puntos aceptable.
//
//   El "reclamo pendiente" guarda {token, score, tier} en sessionStorage, no en
//   memoria, porque según el método de login Privy puede recargar la página y
//   una variable se perdería justo con el premio dentro.

const API = `${import.meta.env.BASE_URL}api/profile.php`
const CLAIM_KEY = 'skulley_pending_score'

let pending = null

export function startGameSession() {
  pending = fetch(`${API}?action=game_start`, { method: 'POST' })
    .then(r => r.json())
    .then(d => (d?.ok ? d.game_token : null))
    .catch(() => null)
  return pending
}

// Devuelve el boleto de la partida en curso y lo olvida: un boleto, un score.
export async function takeGameToken() {
  const p = pending
  pending = null
  return p ? await p : null
}

/**
 * Cierra la partida: sella el final en el servidor y, si no hay sesión, deja
 * el score apartado para reclamarlo después de iniciarla.
 *
 * Se llama SIEMPRE al terminar, con sesión o sin ella, porque el sello del
 * final es lo que mantiene honesta la validación del score.
 */
export async function endGameSession(score, tier, { authenticated = false } = {}) {
  const token = pending ? await pending : null
  if (!token) return null

  try {
    await fetch(`${API}?action=game_end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_token: token }),
    })
  } catch {
    // Que no se selle no debe tirar la partida; el servidor cae a medir
    // contra el momento del envío, que es lo que hacía antes.
  }

  if (authenticated) return token

  // Sin sesión el boleto no se consume todavía: se aparta con el score.
  pending = null
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
