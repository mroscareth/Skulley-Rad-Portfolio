// La ofrenda del Día de los Skulleys (Oscar, 2026-11-24). Alrededor del portal
// de SKULLEYGLYPH se ponen seis objetos importantes para Oscar, como en una
// ofrenda de Día de Muertos, y con cada uno se recompone la canción "Dia de los
// Skulley", que suena rota en ese lugar (cancionOfrenda.js). La almohada va
// al último: atrás del portal, junto a las barricadas, Skulley se duerme en
// ella y ahí arranca la cinemática del final. Con las seis la canción queda
// completa y se desbloquea en el reproductor.
//
// Cada objeto pasa por dos estados: se consigue (una misión llama
// `conseguirOfrenda(id)` y Skulley lo carga flotando sobre la cabeza,
// home/ObjetosOfrenda.jsx) y se pone (al entrar a su corona en la plaza:
// `ponerOfrenda(id)`, y cae con su rayo). Las misiones viven en
// misionesOfrenda.js. En desarrollo: window.__ofrendas.conseguir('ipad'), .poner(id),
// .quitar(id), .todas(), .ninguna(), .cargarTodas().
// Sin three: lo leen el reproductor (chunk del modal) y App.

export const OFRENDAS = [
  { id: 'ipad', es: 'El iPad donde dibuja', en: 'The iPad he draws on' },
  { id: 'leica', es: 'Su cámara', en: 'His camera' },
  { id: 'album', es: 'El álbum de fotos de su gente', en: 'The photo album of his people' },
  { id: 'teclado', es: 'Su teclado MIDI', en: 'His MIDI keyboard' },
  { id: 'cerillos', es: 'La caja de cerillos que le regaló su novia', en: 'The matchbox his girlfriend gave him' },
  { id: 'almohada', es: 'La almohada que lo deja soñar', en: 'The pillow that lets him dream' },
]
export const TOTAL_OFRENDAS = OFRENDAS.length
export const EVENTO_OFRENDAS = 'ofrendas-cambiaron'
// Las misiones (misionesOfrenda.js) abiertas para todos desde el 2026-11-26
// (Oscar). En false nadie gana nada en producción y nada en pantalla dice
// cuántas ofrendas faltan (el reproductor enseña "??" en lugar del 0/6).
export const MISIONES_ABIERTAS = true

const LLAVE = 'skulley_ofrendas'
const VALIDAS = new Set(OFRENDAS.map((o) => o.id))

function leer() {
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE) || '[]')
    if (Array.isArray(g)) return new Set(g.filter((id) => VALIDAS.has(id)))
  } catch { /* sin almacenamiento: empieza vacía */ }
  return new Set()
}

let puestas = leer()

// Las que ya consiguió y todavía carga, en el orden en que llegaron.
const LLAVE_MANO = 'skulley_ofrendas_mano'
function leerMano() {
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE_MANO) || '[]')
    if (Array.isArray(g)) return [...new Set(g)].filter((id) => VALIDAS.has(id) && !puestas.has(id))
  } catch { /* sin almacenamiento: no carga nada */ }
  return []
}
let enMano = leerMano()

function guardar() {
  try {
    localStorage.setItem(LLAVE, JSON.stringify([...puestas]))
    localStorage.setItem(LLAVE_MANO, JSON.stringify(enMano))
  } catch { /* se queda en memoria */ }
  try { window.dispatchEvent(new CustomEvent(EVENTO_OFRENDAS, { detail: { nivel: puestas.size } })) } catch { /* sin window */ }
}

export const ofrendasPuestas = () => new Set(puestas)
export const nivelOfrenda = () => puestas.size
export const ofrendaCompleta = () => puestas.size >= TOTAL_OFRENDAS
export const ofrendaPuesta = (id) => puestas.has(id)
export const ofrendasEnMano = () => enMano.slice()
export const ofrendaEnMano = (id) => enMano.includes(id)

/** Una misión la entrega: Skulley la carga hasta ponerla en su lugar. */
export function conseguirOfrenda(id) {
  if (!VALIDAS.has(id) || puestas.has(id) || enMano.includes(id)) return false
  enMano.push(id)
  guardar()
  return true
}

export function ponerOfrenda(id) {
  if (!VALIDAS.has(id) || puestas.has(id)) return false
  puestas.add(id)
  enMano = enMano.filter((x) => x !== id)
  guardar()
  return true
}

export function quitarOfrenda(id) {
  if (!puestas.delete(id)) return false
  guardar()
  return true
}

export function escucharOfrendas(fn) {
  const alCambiar = () => fn(puestas.size)
  window.addEventListener(EVENTO_OFRENDAS, alCambiar)
  // Otra pestaña del mismo sitio.
  const alGuardar = (e) => {
    if (e.key !== LLAVE && e.key !== LLAVE_MANO) return
    puestas = leer()
    enMano = leerMano()
    fn(puestas.size)
  }
  window.addEventListener('storage', alGuardar)
  return () => {
    window.removeEventListener(EVENTO_OFRENDAS, alCambiar)
    window.removeEventListener('storage', alGuardar)
  }
}

// La canción de la ofrenda: por el título o por el archivo (sin acentos), por
// si el CMS la vuelve a subir con otro nombre.
export function esCancionOfrenda(track) {
  if (!track) return false
  let ruta = String(track.src || '')
  try { ruta = decodeURIComponent(ruta) } catch { /* se queda como venía */ }
  const limpio = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const re = /dia de (los )?skulley/
  return re.test(limpio(track.title)) || re.test(limpio(ruta))
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__ofrendas = {
    lista: OFRENDAS.map((o) => o.id),
    estado: () => ({ nivel: puestas.size, total: TOTAL_OFRENDAS, puestas: [...puestas], enMano: enMano.slice() }),
    conseguir: conseguirOfrenda,
    poner: ponerOfrenda,
    quitar: quitarOfrenda,
    nivel(n) {
      puestas = new Set(OFRENDAS.slice(0, Math.max(0, Math.min(TOTAL_OFRENDAS, n))).map((o) => o.id))
      enMano = enMano.filter((id) => !puestas.has(id))
      guardar()
    },
    todas() { this.nivel(TOTAL_OFRENDAS) },
    ninguna() { enMano = []; this.nivel(0) },
    // todas en mano y ninguna puesta: para probar la cargada y el ponerlas
    cargarTodas() { puestas = new Set(); enMano = OFRENDAS.map((o) => o.id); guardar() },
  }
}
