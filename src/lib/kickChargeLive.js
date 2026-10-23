// Carga de la patada en vivo, compartida entre Player (dentro del Canvas, la
// escribe cada frame) y KickChargeHud (DOM, la lee en su propio rAF).
//
// El valor viaja por un objeto mutable y no por estado: pasarlo por App
// re-renderizaría el árbol entero 60 veces por segundo mientras cargas. Solo
// el inicio y el fin de la carga se avisan con un evento, para que el HUD
// sepa cuándo correr su loop.

export const kickChargeLive = { charge: 0, active: false }

export const KICK_CHARGE_EVENT = 'kick-charge'

export function setKickCharging(active) {
  if (kickChargeLive.active === active) return
  kickChargeLive.active = active
  if (!active) kickChargeLive.charge = 0
  try { window.dispatchEvent(new CustomEvent(KICK_CHARGE_EVENT, { detail: { active } })) } catch { }
}
