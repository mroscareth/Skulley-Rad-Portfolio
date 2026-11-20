import { useSyncExternalStore } from 'react'

// Día y noche del home (Oscar, 2026-11-19): la noche es el azul de siempre y el día
// es morado. De aquí sale el color de la escena (piso, fondo, niebla y las matas
// pintadas, que toman el del piso) y el del pasto fino. Cambiar no recompila nada:
// solo cambian colores de materiales.
// Se elige por la hora de quien visita (Oscar): de día entre HORAS_DIA, en su reloj
// local, y si la hora cruza con la página abierta, cambia solo.
// Sin three: App lo lee y va en el chunk de entrada.
export const PALETAS_HOME = {
  noche: { escena: '#011d8a', pastoFino: '#1202f2' },
  dia: { escena: '#7d3fd9', pastoFino: '#8a3cf5' },
}
// De las 7:00 a antes de las 19:00 es de día.
const HORAS_DIA = [7, 19]
const REVISA_MS = 60_000

const EVENTO = 'momento-home'

function porLaHora(fecha = new Date()) {
  const h = fecha.getHours()
  return h >= HORAS_DIA[0] && h < HORAS_DIA[1] ? 'dia' : 'noche'
}

let actual = typeof window !== 'undefined' ? porLaHora() : 'noche'
// En desarrollo se puede fijar uno a mano; entonces la hora ya no lo cambia.
let fijo = false
let reloj = null

function poner(momento) {
  if (!PALETAS_HOME[momento] || momento === actual) return
  actual = momento
  try { window.dispatchEvent(new CustomEvent(EVENTO, { detail: momento })) } catch { }
}

export function momentoHome() { return actual }

function suscribir(avisar) {
  window.addEventListener(EVENTO, avisar)
  if (!reloj) reloj = setInterval(() => { if (!fijo) poner(porLaHora()) }, REVISA_MS)
  return () => window.removeEventListener(EVENTO, avisar)
}

export function useMomentoHome() {
  return useSyncExternalStore(suscribir, momentoHome, () => 'noche')
}

// En desarrollo: window.__momentoHome('dia' | 'noche') lo fija para verlo;
// window.__momentoHome() lo regresa a la hora.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__momentoHome = (momento) => {
    fijo = Boolean(momento)
    poner(momento || porLaHora())
  }
}
