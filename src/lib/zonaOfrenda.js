// Dónde está Skulley respecto a la ofrenda (el portal de SKULLEYGLYPH, al
// final del camino escondido). Lo escribe ZonaOfrenda en la escena del home
// cada cuadro y lo lee la canción rota (cancionOfrenda.js), que cruza la
// música del reproductor con la suya según qué tan cerca está. Sin three.
//
// Distancias desde el portal (0, -120): la plaza se camina hasta 16.5 y el
// camino empieza en el claro, a ~92.
export const ZONA_OFRENDA = {
  centro: [0, -120],
  // Aquí ya solo suena la ofrenda, y aquí empieza el cruce con la música.
  llena: 22,
  empieza: 40,
  // Desde aquí se oye de lejos, bajita y apagada, como si saliera del bosque.
  presencia: 72,
  // Aquí se baja la canción, para que llegue antes que Skulley.
  carga: 88,
}

const estado = { d: Infinity, activa: false, forzada: null }

export function ponerZonaOfrenda(x, z, activa) {
  estado.d = Math.hypot(x - ZONA_OFRENDA.centro[0], z - ZONA_OFRENDA.centro[1])
  estado.activa = Boolean(activa)
}

export function salirDeZonaOfrenda() {
  estado.activa = false
}

// La distancia que cuenta: fuera del home no hay ofrenda.
export function distanciaOfrenda() {
  if (estado.forzada != null) return estado.forzada
  return estado.activa ? estado.d : Infinity
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // window.__zonaOfrenda(10) hace como si Skulley estuviera a 10 del portal;
  // window.__zonaOfrenda(null) lo regresa a donde está de verdad.
  window.__zonaOfrenda = (d) => {
    if (d === undefined) return { ...estado, cuenta: distanciaOfrenda() }
    estado.forzada = d == null ? null : Number(d)
    return distanciaOfrenda()
  }
}
