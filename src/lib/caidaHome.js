// De una sección al home, Skulley cae en cuanto se pica salir, pero el iris tapa
// hasta que la home pintó (useTransitionSystem). Medido el 2026-11-23: con la home
// caliente el iris se abría con media caída hecha, y si la home tardaba (sale la
// mascota) la caída entera pasaba debajo (Oscar: "no se ve la animación de caída").
// La transición la retiene arriba mientras tapa y la suelta al abrir el iris; Player
// no la baja mientras esté retenida. El tope es por si algo se rompe a medias: nunca
// se queda colgada en el cielo.
const TOPE_MS = 7000

let retenidaHasta = 0

export function retenerCaida(on) {
  retenidaHasta = on ? performance.now() + TOPE_MS : 0
}

export function caidaRetenida() {
  return retenidaHasta > 0 && performance.now() < retenidaHasta
}
