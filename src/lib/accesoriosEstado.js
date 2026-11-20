// Cuáles props lleva Skulley (Customize → Props) y dónde están sus archivos.
// Sin three a propósito: CharacterCustomizer va en el chunk de entrada y no
// puede arrastrar la librería (presupuesto de scripts/check-entry-budget.mjs).
// Lo que arma las mallas vive en accesorios.js.

export const URL_LENTES = `${import.meta.env.BASE_URL}props/lentes.glb`
export const URL_BOXERS = `${import.meta.env.BASE_URL}props/boxers.glb`
export const URL_CHAMARRA = `${import.meta.env.BASE_URL}props/chamarra.glb`
export const URL_HOODIE = `${import.meta.env.BASE_URL}props/hoodie.glb`
export const URL_TENIS = `${import.meta.env.BASE_URL}props/tenis.glb`
export const URL_INFLADA = `${import.meta.env.BASE_URL}props/inflada.glb`
export const URL_BOTAS = `${import.meta.env.BASE_URL}props/botas.glb`
export const URL_PANTALONES = `${import.meta.env.BASE_URL}props/pantalones.glb`
export const URL_MUNEQUERAS = `${import.meta.env.BASE_URL}props/munequeras.glb`
// ?v= con la huella del archivo: los .glb de public/ salen sin Cache-Control y, con el mismo nombre, el navegador
// seguía enseñando el beanie de antes después del deploy (Oscar, 2026-11-18). Cambiarla al re-exportarlo
export const URL_BEANIE = `${import.meta.env.BASE_URL}props/beanie.glb?v=8f70b39a`
// Los lentes 3D de cartón (scripts/skulley-anim/lentes3d.py). Con su huella, como el beanie: cambiarla al re-exportarlos
export const URL_LENTES3D = `${import.meta.env.BASE_URL}props/lentes3d.glb?v=40ff4c8f`
// Clips nuevos del mismo .blend (scripts/skulley-anim/exportar_animaciones.py)
export const URL_CORRER = `${import.meta.env.BASE_URL}animaciones/correr.glb`
// El idle con el pie izquierdo corregido (2026-11-18): se llama igual que el de character.glb y solo trae
// las pistas que cambian (la pierna izquierda), que van encima de las suyas
export const URL_IDLE = `${import.meta.env.BASE_URL}animaciones/idle.glb`

/** Los clips de character.glb con los del .blend: uno con el nombre de un clip de character.glb pone sus
 *  pistas encima de las de ese clip (las demás se quedan); uno nuevo se agrega. */
export function conClipsDelBlend(base, ...gltfs) {
  const nuevos = gltfs.flatMap((g) => g?.animations || [])
  const porNombre = new Map(nuevos.map((c) => [c.name, c]))
  const out = (base || []).map((c) => {
    const n = porNombre.get(c.name)
    if (!n) return c
    porNombre.delete(c.name)
    const encima = new Set(n.tracks.map((t) => t.name))
    const mezcla = c.clone()
    mezcla.tracks = [...c.tracks.filter((t) => !encima.has(t.name)), ...n.tracks.map((t) => t.clone())]
    return mezcla
  })
  return [...out, ...porNombre.values()]
}

export const ACCESORIOS = [
  { id: 'lentes', es: 'Lentes', en: 'Sunglasses' },
  { id: 'lentes3d', es: 'Lentes 3D', en: '3D glasses' },
  { id: 'boxers', es: 'Bóxers', en: 'Boxers' },
  { id: 'pantalones', es: 'Pantalones', en: 'Jeans' },
  { id: 'chamarra', es: 'Chamarra', en: 'Jacket' },
  { id: 'hoodie', es: 'Hoodie', en: 'Hoodie' },
  { id: 'inflada', es: 'Inflada', en: 'Puffer' },
  { id: 'tenis', es: 'Tenis', en: 'Sneakers' },
  { id: 'botas', es: 'Botas', en: 'Boots' },
  { id: 'munequeras', es: 'Muñequeras', en: 'Spiked cuffs' },
  { id: 'beanie', es: 'Beanie', en: 'Beanie' },
]
export const ACCESORIOS_EVENT = 'accesorios-cambiaron'
const LLAVE = 'skulley_accesorios'
// Los bóxers son broma: se descubren, no salen puestos
const PRENDIDOS_DE_INICIO = { lentes: true, lentes3d: false, boxers: false, pantalones: false, chamarra: false, hoodie: false, inflada: false, tenis: false, botas: false, munequeras: false, beanie: false }
// La chamarra, el hoodie y la inflada se encimaban (una adentro de la otra): ponerse una quita las otras.
// Igual los tenis y las botas: los dos van en los pies. Y los bóxers y los pantalones: los bóxers son más
// anchos y bajan casi a la rodilla, no caben debajo. Con el hoodie y la inflada, las muñequeras les aprietan
// la manga (accesorios.js, cenirMangas): su puño no cabe en el hueco. Los dos lentes van en la cara.
const SE_EXCLUYEN = {
  lentes: ['lentes3d'], lentes3d: ['lentes'],
  chamarra: ['hoodie', 'inflada'], hoodie: ['chamarra', 'inflada'], inflada: ['chamarra', 'hoodie'],
  tenis: ['botas'], botas: ['tenis'],
  boxers: ['pantalones'], pantalones: ['boxers'],
}

// Props que se ganan con un logro (su llave en achievementsCatalog.js): los lentes 3D, cuando el rayo de la esfera
// corrupta le pega al drone de M.A.D.R.E. (Oscar, 2026-11-19). Sin el logro no se pueden poner y, si ya estaban
// puestos, no se ven: getAccesorios los regresa apagados, así Player, el retrato y el rig no necesitan saber de
// logros. Los logros los pasa App (setLogrosDeProps, de useAchievements); hasta entonces cuentan como no ganados.
export const LOGRO_DE_PROP = { lentes3d: 'prop_lentes3d' }
let logros = new Set()

export function propDesbloqueado(id) {
  const llave = LOGRO_DE_PROP[id]
  return !llave || logros.has(llave)
}

function guardados() {
  try {
    return { ...PRENDIDOS_DE_INICIO, ...JSON.parse(localStorage.getItem(LLAVE) || '{}') }
  } catch {
    return { ...PRENDIDOS_DE_INICIO }
  }
}

function conCandado(estado) {
  for (const id of Object.keys(LOGRO_DE_PROP)) if (!propDesbloqueado(id)) estado[id] = false
  return estado
}

function avisar(estado) {
  try { window.dispatchEvent(new CustomEvent(ACCESORIOS_EVENT, { detail: estado })) } catch { }
}

export function getAccesorios() {
  return conCandado(guardados())
}

/** Los logros del usuario (un Set de llaves); si cambia alguno que desbloquea un prop, avisa como si cambiaran los props. */
export function setLogrosDeProps(lista) {
  const nuevo = new Set(lista || [])
  const cambia = Object.values(LOGRO_DE_PROP).some((l) => nuevo.has(l) !== logros.has(l))
  logros = nuevo
  if (cambia) avisar(getAccesorios())
}

export function setAccesorio(id, prendido) {
  if (prendido && !propDesbloqueado(id)) return getAccesorios()
  const next = { ...guardados(), [id]: !!prendido }
  if (prendido) for (const otro of SE_EXCLUYEN[id] || []) next[otro] = false
  try { localStorage.setItem(LLAVE, JSON.stringify(next)) } catch { }
  const visto = conCandado({ ...next })
  avisar(visto)
  return visto
}

/** Si va puesto lo que tapa a `o` (`userData.ocultaCon`: un id o varios; los pies, con los tenis o con las botas; el pelo, con el beanie). */
export function tapadoPorProp(o, estado) {
  const c = o?.userData?.ocultaCon
  if (!c) return false
  return Array.isArray(c) ? c.some((id) => !!estado[id]) : !!estado[c]
}

/** Prende o apaga en una escena las mallas de los props (y sus contornos). */
export function mostrarAccesorios(escena, estado = getAccesorios(), extra = true) {
  escena?.traverse?.((o) => {
    const id = o.userData?.accesorio
    if (id) o.visible = !!estado[id] && extra
  })
  // con las muñequeras, las mangas del hoodie y la inflada van ceñidas
  escena?.userData?.cenirMangas?.(estado)
}
