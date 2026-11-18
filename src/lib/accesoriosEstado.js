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
// Clips nuevos del mismo .blend (scripts/skulley-anim/exportar_animaciones.py)
export const URL_CORRER = `${import.meta.env.BASE_URL}animaciones/correr.glb`

export const ACCESORIOS = [
  { id: 'lentes', es: 'Lentes', en: 'Sunglasses' },
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
const PRENDIDOS_DE_INICIO = { lentes: true, boxers: false, pantalones: false, chamarra: false, hoodie: false, inflada: false, tenis: false, botas: false, munequeras: false, beanie: false }
// La chamarra, el hoodie y la inflada se encimaban (una adentro de la otra): ponerse una quita las otras.
// Igual los tenis y las botas: los dos van en los pies. Y los bóxers y los pantalones: los bóxers son más
// anchos y bajan casi a la rodilla, no caben debajo. Con el hoodie y la inflada, las muñequeras les aprietan
// la manga (accesorios.js, cenirMangas): su puño no cabe en el hueco.
const SE_EXCLUYEN = {
  chamarra: ['hoodie', 'inflada'], hoodie: ['chamarra', 'inflada'], inflada: ['chamarra', 'hoodie'],
  tenis: ['botas'], botas: ['tenis'],
  boxers: ['pantalones'], pantalones: ['boxers'],
}

export function getAccesorios() {
  try {
    return { ...PRENDIDOS_DE_INICIO, ...JSON.parse(localStorage.getItem(LLAVE) || '{}') }
  } catch {
    return { ...PRENDIDOS_DE_INICIO }
  }
}

export function setAccesorio(id, prendido) {
  const next = { ...getAccesorios(), [id]: !!prendido }
  if (prendido) for (const otro of SE_EXCLUYEN[id] || []) next[otro] = false
  try { localStorage.setItem(LLAVE, JSON.stringify(next)) } catch { }
  try { window.dispatchEvent(new CustomEvent(ACCESORIOS_EVENT, { detail: next })) } catch { }
  return next
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
