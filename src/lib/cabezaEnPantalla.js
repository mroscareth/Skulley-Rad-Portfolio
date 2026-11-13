// Dónde está la cabeza de Skulley en la experiencia que se ve (px de ventana,
// { x, y, r }), para cerrar y abrir el iris sobre ella al ir a "Conocer la
// historia" y al volver (App.jsx). La registra quien dibuja a Skulley: la
// escena del home en la completa (HomeScene) y el busto de la versión simple
// (el rig de QuickHome).
let medidor = null

export function registrarCabeza(fn) {
  medidor = fn
  return () => { if (medidor === fn) medidor = null }
}

export function cabezaEnPantalla() {
  try { return medidor?.() || null } catch { return null }
}
