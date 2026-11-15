// El juego de esferas: las reglas y el estado de la partida en curso (Oscar,
// 2026-11-15). Sin React ni three, para que el HUD, HomeOrbs, los portales y las
// pruebas en Node lean lo mismo. profile.php repite las reglas del puntaje
// (gameScoreFromEvents) para no creerle al navegador: si cambia un número de
// PUNTOS, RACHA, CARAMBOLA, FUEGO o DORADA, cambia allá también.
//
//   Reloj de arcade: empieza en RELOJ.inicio y cada acierto le suma según el
//   tamaño; un error le quita. En cero se acaba la partida. Corre con el tiempo
//   del juego (se para si se para la escena), no con el del reloj de pared.
//   Racha: aciertos seguidos. Multiplica los puntos (×2 desde 3, ×3 desde 6, ×4
//   desde 10) y un error la rompe.
//   Fiebre: cada FIEBRE.cada aciertos seguidos, FIEBRE.dura segundos con todas
//   las esferas y los portales de un color: cualquier esfera en cualquier portal
//   es acierto. No multiplica nada: el premio es no poder fallar.
//   Carambola: la esfera entró porque otra pateada la golpeó. Vale doble.
//   Portal en llamas: el que toque según el calendario, FUEGO.dura segundos,
//   dobla lo que entre bien en él.
//   Esfera dorada: inestable, se escapa; vale DORADA.puntos fijos en cualquier
//   portal y solo si la metió el jugador.
//
// El calendario de la dorada y del fuego lo decide el servidor al dar el boleto
// (game_start) para poder validar esas capturas; sin servidor se arma aquí con
// la misma receta (armarCalendario).

export const PUNTOS = { chica: 100, mediana: 30, grande: 5 }
export const tamanoDe = (radio) => (radio <= 0.28 ? 'chica' : radio <= 0.42 ? 'mediana' : 'grande')

export const RELOJ = {
  inicio: 60,
  tope: 99,
  bono: { chica: 8, mediana: 6, grande: 4, dorada: 10 },
  castigo: 5,
  // Desde aquí el reloj se pone rojo y suena cada segundo.
  urgente: 10,
}

// [aciertos seguidos, multiplicador], de mayor a menor.
export const RACHA = [[10, 4], [6, 3], [3, 2]]
export const multiplicadorDe = (racha) => {
  for (const [desde, mult] of RACHA) if (racha >= desde) return mult
  return 1
}

export const FIEBRE = { cada: 10, dura: 5, color: '#f5ff00' }
// Oleadas (Oscar, 2026-11-15): la partida arranca con `inicio` esferas y cada
// `cada` aciertos caen `mas` del cielo, hasta `tope`. Fuera del juego hay `libre`.
// HomeOrbs monta `tope` desde el principio y oculta las que no tocan, para no
// montar ni compilar nada a media partida. La corrupta vive entre las primeras.
export const OLEADA = { inicio: 6, cada: 5, mas: 2, tope: 14, libre: 10 }
export const CARAMBOLA = 2
export const FUEGO = { mult: 2, dura: 10 }
// `vida` en segundos: igual a GAME_GOLD_LIFE_MS de profile.php (valida la ventana).
export const DORADA = { puntos: 500, vida: 15, aviso: 3, radio: 0.24, color: '#ffc21a' }

// Banderas de cada captura en la bitácora (gameSession → profile.php).
export const BANDERA = { carambola: 1, fuego: 2 }

// Puntos de una captura. `base` es lo que vale la esfera por tamaño (negativo si
// fue al portal equivocado) o DORADA.puntos; `racha` es la de antes de esta
// captura. Devuelve los puntos y la racha que queda.
export function puntuar(base, banderas, racha) {
  if (base < 0) return { puntos: base, racha: 0, mult: 1 }
  const nueva = racha + 1
  if (base === DORADA.puntos) return { puntos: base, racha: nueva, mult: 1 }
  const mult = multiplicadorDe(nueva)
  let puntos = base * mult
  if (banderas & BANDERA.carambola) puntos *= CARAMBOLA
  if (banderas & BANDERA.fuego) puntos *= FUEGO.mult
  return { puntos, racha: nueva, mult }
}

// El puntaje de una bitácora completa ([ms, base, banderas?] en orden). Es lo que
// recalcula el servidor; aquí sirve para las pruebas y el fin de partida.
export function puntajeDe(eventos) {
  let total = 0
  let racha = 0
  let mejorRacha = 0
  let carambolas = 0
  let aciertos = 0
  let errores = 0
  for (const e of eventos) {
    const base = e[1]
    const banderas = e[2] || 0
    const r = puntuar(base, banderas, racha)
    total += r.puntos
    racha = r.racha
    mejorRacha = Math.max(mejorRacha, racha)
    if (base > 0) aciertos += 1
    else errores += 1
    if (base > 0 && (banderas & BANDERA.carambola)) carambolas += 1
  }
  return { total, mejorRacha, carambolas, aciertos, errores, capturas: eventos.length }
}

// ¿Esta captura dispara la fiebre? Al llegar a 10, 20, 30… seguidos.
export const disparaFiebre = (racha) => racha > 0 && racha % FIEBRE.cada === 0

// Calendario de eventos de una partida, en ms desde el inicio. La misma receta
// que gameSchedule() de profile.php. `azar` = () => [0, 1).
export const PORTALES_JUEGO = ['section1', 'section2', 'section3', 'section4', 'section5']
export function armarCalendario(azar = Math.random, largoMs = 30 * 60 * 1000) {
  const entre = (a, b) => Math.round((a + (b - a) * azar()) * 1000)
  const eventos = []
  for (let t = entre(20, 30); t < largoMs; t += entre(30, 45)) eventos.push({ k: 'oro', t })
  for (let t = entre(40, 50); t < largoMs; t += entre(35, 50)) {
    eventos.push({ k: 'fuego', t, p: PORTALES_JUEGO[Math.floor(azar() * PORTALES_JUEGO.length)] })
  }
  return eventos.sort((a, b) => a.t - b.t)
}

// ── La partida en curso ─────────────────────────────────────────────────────
// Un solo objeto mutable: lo escribe HomeOrbs cada cuadro y lo leen el HUD, los
// portales y Argus. Los avisos van por `escuchar` (cambios discretos, nunca por
// cuadro), así el HUD no re-renderiza 60 veces por segundo.

const oyentes = new Set()
export function escuchar(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
function avisar(tipo, datos) {
  for (const fn of oyentes) {
    try { fn(tipo, datos) } catch { /* un oyente roto no tumba el juego */ }
  }
}

export const juego = {
  activo: false,
  // Tiempo de juego en segundos y lo que le queda al reloj.
  t: 0,
  reloj: RELOJ.inicio,
  racha: 0,
  mult: 1,
  fiebreHasta: 0,
  // { portal, hastaMs } con el reloj de pared de la partida.
  fuego: null,
  calendario: [],
  siguiente: 0,
  // Esferas en juego (oleadas) y aciertos de la partida.
  esferas: OLEADA.libre,
  aciertos: 0,
}

export const enFiebre = () => juego.activo && juego.t < juego.fiebreHasta
export const portalEnLlamas = () => (juego.activo && juego.fuego ? juego.fuego.portal : null)

export function iniciarJuego(calendario) {
  Object.assign(juego, {
    activo: true,
    t: 0,
    reloj: RELOJ.inicio,
    racha: 0,
    mult: 1,
    fiebreHasta: 0,
    fuego: null,
    calendario: Array.isArray(calendario) ? calendario : [],
    siguiente: 0,
    esferas: OLEADA.inicio,
    aciertos: 0,
  })
  avisar('inicio', { reloj: juego.reloj })
}

export function detenerJuego() {
  juego.esferas = OLEADA.libre
  if (!juego.activo) return
  juego.activo = false
  juego.fuego = null
  juego.fiebreHasta = 0
  avisar('fin', {})
}

// El calendario llega del servidor cuando ya empezó la partida.
export function ponerCalendario(calendario) {
  if (!Array.isArray(calendario)) return
  juego.calendario = calendario
  juego.siguiente = 0
}

// Un cuadro del juego. `dt` en segundos de juego, `ms` = reloj de pared de la
// partida. Devuelve los eventos del calendario que tocan ahora ({k, t, p}).
export function avanzarJuego(dt, ms) {
  if (!juego.activo) return []
  const antes = Math.ceil(juego.reloj)
  juego.t += dt
  juego.reloj = Math.max(0, juego.reloj - dt)
  const fiebreAntes = juego.fiebreHasta > 0 && juego.t - dt < juego.fiebreHasta
  if (fiebreAntes && juego.t >= juego.fiebreHasta) avisar('fiebre-fin', {})
  if (juego.fuego && ms >= juego.fuego.hastaMs) {
    juego.fuego = null
    avisar('fuego-fin', {})
  }
  const ahora = Math.ceil(juego.reloj)
  if (ahora !== antes) avisar('reloj', { reloj: ahora })
  if (juego.reloj <= 0) {
    avisar('tiempo', {})
    juego.activo = false
    return []
  }
  const tocan = []
  while (juego.siguiente < juego.calendario.length && juego.calendario[juego.siguiente].t <= ms) {
    tocan.push(juego.calendario[juego.siguiente])
    juego.siguiente += 1
  }
  for (const ev of tocan) {
    if (ev.k === 'fuego') {
      juego.fuego = { portal: ev.p, hastaMs: ev.t + FUEGO.dura * 1000 }
      avisar('fuego', { portal: ev.p })
    }
  }
  return tocan
}

// Una captura de la partida. Devuelve lo que hay que pintar y sonar.
export function capturar({ base, banderas = 0, tamano }) {
  const r = puntuar(base, banderas, juego.racha)
  const multAntes = juego.mult
  juego.racha = r.racha
  juego.mult = base > 0 ? multiplicadorDe(r.racha) : 1
  const seg = base < 0
    ? -RELOJ.castigo
    : RELOJ.bono[base === DORADA.puntos ? 'dorada' : tamano] || 0
  juego.reloj = Math.min(RELOJ.tope, Math.max(0, juego.reloj + seg))
  const fiebre = base > 0 && disparaFiebre(r.racha)
  if (fiebre) juego.fiebreHasta = juego.t + FIEBRE.dura
  // Cada OLEADA.cada aciertos caen más esferas (no tienen que ser seguidos).
  let oleada = 0
  if (base > 0) {
    juego.aciertos += 1
    if (juego.aciertos % OLEADA.cada === 0 && juego.esferas < OLEADA.tope) {
      const antes = juego.esferas
      juego.esferas = Math.min(OLEADA.tope, juego.esferas + OLEADA.mas)
      oleada = juego.esferas - antes
    }
  }
  const resultado = {
    oleada,
    esferas: juego.esferas,
    puntos: r.puntos,
    segundos: seg,
    racha: r.racha,
    mult: juego.mult,
    subioMult: juego.mult > multAntes,
    rompioRacha: base < 0 && multAntes > 1,
    fiebre,
    carambola: !!(banderas & BANDERA.carambola),
    fuego: !!(banderas & BANDERA.fuego),
    dorada: base === DORADA.puntos,
  }
  avisar('captura', resultado)
  return resultado
}

// Eventos sueltos para el HUD y Argus (dorada que aparece o se va, doblete).
export const avisoJuego = (tipo, datos = {}) => avisar(tipo, datos)
