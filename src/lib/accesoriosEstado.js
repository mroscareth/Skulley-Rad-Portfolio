// Cuáles props lleva Skulley (Customize → Props) y dónde están sus archivos.
// Sin three a propósito: CharacterCustomizer va en el chunk de entrada y no
// puede arrastrar la librería (presupuesto de scripts/check-entry-budget.mjs).
// Lo que arma las mallas vive en accesorios.js.

export const URL_LENTES = `${import.meta.env.BASE_URL}props/lentes.glb`
// Clips nuevos del mismo .blend (scripts/skulley-anim/exportar_animaciones.py)
export const URL_CORRER = `${import.meta.env.BASE_URL}animaciones/correr.glb`

export const ACCESORIOS = [
  { id: 'lentes', es: 'Lentes', en: 'Sunglasses' },
]
export const ACCESORIOS_EVENT = 'accesorios-cambiaron'
const LLAVE = 'skulley_accesorios'
const PRENDIDOS_DE_INICIO = { lentes: true }

export function getAccesorios() {
  try {
    return { ...PRENDIDOS_DE_INICIO, ...JSON.parse(localStorage.getItem(LLAVE) || '{}') }
  } catch {
    return { ...PRENDIDOS_DE_INICIO }
  }
}

export function setAccesorio(id, prendido) {
  const next = { ...getAccesorios(), [id]: !!prendido }
  try { localStorage.setItem(LLAVE, JSON.stringify(next)) } catch { }
  try { window.dispatchEvent(new CustomEvent(ACCESORIOS_EVENT, { detail: next })) } catch { }
  return next
}

/** Prende o apaga en una escena las mallas de los props (y sus contornos). */
export function mostrarAccesorios(escena, estado = getAccesorios(), extra = true) {
  escena?.traverse?.((o) => {
    const id = o.userData?.accesorio
    if (id) o.visible = !!estado[id] && extra
  })
}
