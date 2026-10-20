// Boleto de partida del minigame de esferas.
//
// Al empezar cada partida se pide uno al servidor (profile.php?action=game_start)
// y save_score lo consume. Así el backend sabe cuánto duró la partida y puede
// rechazar un score imposible para ese tiempo — el golden ticket vale dinero.
//
// Se pide aunque el jugador no haya iniciado sesión: mucha gente se loguea
// hasta el game over para guardar su score.

const API = `${import.meta.env.BASE_URL}api/profile.php`

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
