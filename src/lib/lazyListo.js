import { lazy } from 'react'

// React.lazy que no suspende si el módulo ya llegó. El lazy de React se entera
// del módulo en un .then (un microtask después) aunque la promesa ya esté
// resuelta: suspende de todas formas, monta el fallback y reintenta cuando el
// hilo se desocupa. En la primera pantalla del teléfono ese reintento caía hasta
// 1.6 s después, con el rig ya descargado (rendimiento.md, 2026-11-15). Si el
// módulo ya está, aquí se le da a React un thenable que responde en el acto.
//
// `precargar()` pide el módulo sin renderizar (y guarda el resultado).
export function lazyListo(importar) {
  let modulo = null
  let promesa = null
  const pedir = () => {
    if (!promesa) {
      promesa = importar().then((m) => { modulo = m; return m })
      promesa.catch(() => { promesa = null })
    }
    return promesa
  }
  const Componente = lazy(() => (modulo ? { then: (listo) => listo(modulo) } : pedir()))
  Componente.precargar = pedir
  return Componente
}
