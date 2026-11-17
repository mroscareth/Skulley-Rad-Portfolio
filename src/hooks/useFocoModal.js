import { useLayoutEffect } from 'react'

// El foco de un modal hecho a mano (div con role="dialog"): al abrir entra al
// modal, Tab y Shift+Tab dan la vuelta adentro y al cerrar regresa a lo que lo
// abrió. Es lo que <dialog> con showModal() da solo; aquí no lo usamos porque la
// capa superior le gana a cualquier z-index: quedaría encima del iris de las
// transiciones y del login de Privy, que se abre sobre algunos modales. El
// patrón es el del reproductor (MusicPlayer), que ya lo hacía a mano.
//
// La raíz necesita tabIndex={-1} y outline-none: si nada de adentro tiene el
// foco, se lo lleva ella, y así el lector de pantalla anuncia el diálogo.

// Modales abiertos, el último encima: solo ese atrapa el Tab. Mi cuenta sobre el
// carrito no debe pelear con él por el foco.
const pila = []

const ENFOCABLES = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'audio[controls]', 'video[controls]',
  '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])',
].join(',')

function visible(el) {
  if (el.tabIndex < 0 || el.closest('[inert]')) return false
  if (typeof el.checkVisibility === 'function') {
    return el.checkVisibility({ checkVisibilityCSS: true, visibilityProperty: true })
  }
  return el.getClientRects().length > 0
}

// El botón que abre y cierra el modal desde afuera (aria-controls con su id,
// como la hamburguesa del menú) entra a la vuelta, al final: si no, con Tab no
// se llegaría a la X que se ve encima.
function controles(raiz) {
  if (!raiz.id) return []
  return [...document.querySelectorAll(`[aria-controls="${CSS.escape(raiz.id)}"]`)]
    .filter((el) => !raiz.contains(el) && visible(el))
}

function enfocables(raiz) {
  return [...raiz.querySelectorAll(ENFOCABLES)].filter(visible).concat(controles(raiz))
}

function enfocar(el) {
  try { el?.focus({ preventScroll: true }) } catch { }
}

// Layout y no efecto normal: corre antes de los useEffect del modal, así guarda
// lo que lo abrió aunque el modal mueva el foco a una caja suya en su efecto.
export default function useFocoModal(ref, activo) {
  useLayoutEffect(() => {
    if (!activo) return undefined
    const raiz = ref.current
    if (!raiz) return undefined
    const antes = document.activeElement
    const previo = antes && antes !== document.body && !raiz.contains(antes) ? antes : null
    const yo = { raiz }
    pila.push(yo)
    if (!raiz.contains(document.activeElement)) enfocar(raiz)

    const onKey = (e) => {
      if (e.key !== 'Tab' || e.defaultPrevented || pila[pila.length - 1] !== yo) return
      const ahora = document.activeElement
      // Otro diálogo que no es de la pila (el login de Privy, el reproductor)
      // está encima con el foco: es suyo.
      if (ahora && !raiz.contains(ahora) && ahora.closest?.('[role="dialog"], dialog, [aria-modal="true"]')) return
      // El orden lo lleva la lista y no el navegador: el botón de afuera no es
      // el siguiente en el documento, y sin esto el Tab se escapaba antes de él.
      e.preventDefault()
      const lista = enfocables(raiz)
      if (!lista.length) { enfocar(raiz); return }
      const i = lista.indexOf(ahora)
      const paso = e.shiftKey ? -1 : 1
      const sig = i < 0 ? (e.shiftKey ? lista.length - 1 : 0) : (i + paso + lista.length) % lista.length
      enfocar(lista[sig])
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      const i = pila.indexOf(yo)
      if (i >= 0) pila.splice(i, 1)
      // Después del commit y no dentro de él: al terminar, React le regresa el
      // foco a lo que lo tenía antes (la raíz del modal) y deshacía este. Solo
      // si el foco sigue en el modal o se perdió: si el cierre ya lo mandó a
      // otro lado (otro modal que se abrió en su lugar), se respeta.
      queueMicrotask(() => {
        if (pila.some((m) => m.raiz === raiz)) return
        const ahora = document.activeElement
        const perdido = !ahora || ahora === document.body || raiz.contains(ahora)
        if (perdido && previo?.isConnected) enfocar(previo)
      })
    }
  }, [activo, ref])
}
