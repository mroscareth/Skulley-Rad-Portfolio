// El turno de palabra de los globos de la home (Oscar, 2026-11-25: "que no se pueda interrumpir los
// diálogos cuando activamos otros… se quitan muy rápido o se sienten muy acelerados"). Skulley, Argus
// y M.A.D.R.E. piden turno antes de hablar:
//   · nadie corta a nadie: una frase que empezó se escribe y se lee completa;
//   · hablan uno a la vez: el siguiente hace fila y entra `entre` después de que se va el globo;
//   · la fila es corta y caduca: cada frase dice cuánto puede esperar (`espera`) y lo viejo se tira, para
//     que nada salga fuera de contexto; si alguien ya tenía frase en la fila, la nueva la reemplaza;
//   · mientras hay una charla abierta (las barras de cine) la fila se pausa y se vacía;
//   · un susto sí corta (Oscar, 2026-11-25: "eso sí debería ser un shock moment que corte los
//     diálogos"): un rayo que le pega a alguien sin guion o el despiece de Skulley llaman `choque()`:
//     todos se callan de golpe, la fila se vacía y hay un respiro (`silencioChoque`) antes de que
//     alguien reaccione (las burlas y las escenas que provoca el susto se piden después y sí salen).
// El tiempo de cada globo sale de una sola fórmula (`tiempoLinea`): se escribe a `letras` por segundo y,
// ya completo, se queda lo que se tarda en leerlo. Sin three: lo usan Player, ZoidianNPC y DroneNPC.

export const TURNO = {
  letras: 20,        // letras por segundo al escribirse
  base: 1.2,         // ya completo: base + porPalabra por palabra, entre minLeer y maxLeer (s)
  porPalabra: 0.3,
  minLeer: 2.5,
  maxLeer: 8,
  entre: 0.5,        // entre un globo y el siguiente (s)
  esperaDef: 8,      // cuánto puede esperar en la fila una frase (s); lo que dura una frase larga
  abreTras: 0.9,     // si picas a alguien para platicar con otro a media frase: la frase se completa
                     // de golpe y la charla abre después de esto (s)
  silencioChoque: 0.6, // después de un susto, nadie habla en este rato (s)
}

export function tiempoLinea(texto) {
  const t = String(texto || '')
  const palabras = t.trim() ? t.trim().split(/\s+/).length : 0
  const escribe = t.length / TURNO.letras
  const leer = Math.min(TURNO.maxLeer, Math.max(TURNO.minLeer, TURNO.base + palabras * TURNO.porPalabra))
  return { escribe, leer, total: escribe + leer }
}

const ahora = () => performance.now() / 1000

const st = {
  habla: null,      // { quien, hasta, texto }
  libreEn: 0,
  fila: [],         // { quien, texto, iniciar, d, caduca, prioridad }
  pausa: false,
  vigia: 0,
}
const completadores = new Set()
const calladores = new Map()
const oyentesChoque = new Set()

function puede() {
  const t = ahora()
  return !st.pausa && (!st.habla || t >= st.habla.hasta) && t >= st.libreEn
}

function arrancar(p) {
  const t = ahora()
  st.habla = { quien: p.quien, hasta: t + p.d.total, texto: p.texto }
  st.libreEn = st.habla.hasta + TURNO.entre
  try { p.iniciar(p.d) } catch (e) { console.warn('[turno] no arrancó', e) }
}

function vigilar() {
  if (st.vigia) return
  st.vigia = setInterval(() => {
    const t = ahora()
    st.fila = st.fila.filter((p) => p.caduca > t)
    if (st.fila.length && puede()) arrancar(st.fila.shift())
    if (!st.fila.length) { clearInterval(st.vigia); st.vigia = 0 }
  }, 100)
}

/**
 * Pide turno para decir `texto`. `iniciar(d)` se llama cuando le toca (enseguida si nadie habla), con
 * los tiempos de la línea (d.escribe, d.leer, d.total en segundos). Regresa true si arrancó enseguida.
 * `prioridad` ordena la fila (lo que provocó el jugador va antes; los trozos de una misma frase, más).
 */
export function pedirTurno({ quien, texto, iniciar, espera = TURNO.esperaDef, prioridad = 0 }) {
  const d = tiempoLinea(texto)
  const p = { quien, texto, iniciar, d, caduca: ahora() + espera, prioridad }
  if (!st.fila.length && puede()) { arrancar(p); return true }
  st.fila = st.fila.filter((q) => q.quien !== quien)
  st.fila.push(p)
  st.fila.sort((a, b) => b.prioridad - a.prioridad)
  vigilar()
  return false
}

/** El siguiente trozo de una frase larga: sigue con el turno sin soltarlo ni respiro (el globo no se
 * va entre trozos). Solo para quien está hablando. */
export function seguirTurno({ quien, texto, iniciar }) {
  arrancar({ quien, texto, iniciar, d: tiempoLinea(texto) })
}

/** Quien hablaba ya se calló antes de tiempo (lo cortó una escena, el despiece, etc.). */
export function soltarTurno(quien) {
  if (st.habla?.quien !== quien) return
  st.habla = null
  st.libreEn = Math.min(st.libreEn, ahora() + TURNO.entre)
}

/** Saca de la fila lo que tenga alguien (p. ej. al empezar una escena o al dormirse). */
export function quitarDeFila(quien) {
  st.fila = st.fila.filter((p) => p.quien !== quien)
}

export function hablando() {
  return st.habla && ahora() < st.habla.hasta ? st.habla.quien : null
}

/** Lo que se está diciendo ahora (para quien espera un renglón exacto). */
export function hablandoTexto() {
  return st.habla && ahora() < st.habla.hasta ? st.habla.texto : null
}

/** Las charlas de las barras de cine pausan la fila y la vacían; al cerrarse, siguen los globos. */
export function pausarTurnos(on) {
  st.pausa = Boolean(on)
  if (st.pausa) st.fila = []
  else st.libreEn = Math.max(st.libreEn, ahora() + TURNO.entre)
}

/** Cada globo que escribe letra por letra se registra para completarse de golpe cuando hace falta. */
export function alCompletar(fn) {
  completadores.add(fn)
  return () => completadores.delete(fn)
}

/** Cada quien registra cómo se calla de golpe (esconder su globo ya) para los sustos. */
export function registrarCallar(quien, fn) {
  calladores.set(quien, fn)
  return () => { if (calladores.get(quien) === fn) calladores.delete(quien) }
}

/** Lo que tiene que soltar algo más al susto (p. ej. la escena de Argus y M.A.D.R.E.). */
export function escucharChoque(fn) {
  oyentesChoque.add(fn)
  return () => oyentesChoque.delete(fn)
}

/**
 * Un susto: un rayo que le pega a alguien sin guion, el despiece de Skulley. Todos se callan de golpe,
 * la fila se vacía y nadie habla en `silencio` segundos. `quien` es a quien le pegó (para los oyentes).
 */
export function choque({ quien = null, silencio = TURNO.silencioChoque } = {}) {
  for (const fn of calladores.values()) { try { fn() } catch { } }
  st.habla = null
  st.fila = []
  st.libreEn = ahora() + silencio
  for (const fn of oyentesChoque) { try { fn({ quien }) } catch { } }
}

// Los sustos que avisan por ventana: el despiece de Skulley (rayo, castigo, easter egg, empujón de
// Argus) y el rayo que quema a M.A.D.R.E. (DroneNPC). El de Argus lo llama ZoidianNPC al chamuscarlo.
// Este archivo se carga antes que los personajes, así que el susto calla antes de que reaccionen.
if (typeof window !== 'undefined') {
  for (const [evento, quien] of [
    ['character-disassembled-by-bolt', 'skulley'], ['character-disassembled-by-madre', 'skulley'],
    ['character-disassembled-by-egg', 'skulley'], ['character-disassembled-by-argus', 'skulley'],
    ['madre-quemada', 'madre'],
  ]) window.addEventListener(evento, () => choque({ quien }))
}

/**
 * Abre algo (una charla) sin cortarle la frase a quien está hablando: si alguien está a media frase,
 * se completa de golpe y `abrir` corre `abreTras` después, para que alcance a leerse. Si nadie habla,
 * abre enseguida. Regresa true si abrió enseguida.
 */
let abriendo = 0
export function abrirTrasTurno(abrir) {
  if (abriendo) return false
  if (!hablando()) { abrir(); return true }
  for (const fn of completadores) { try { fn() } catch { } }
  abriendo = setTimeout(() => { abriendo = 0; abrir() }, TURNO.abreTras * 1000)
  return false
}

if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__turnoGlobos = { st, TURNO, tiempoLinea, choque }
