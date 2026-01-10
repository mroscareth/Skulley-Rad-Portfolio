import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import './index.css'
import * as THREE from 'three'

// Patch global: algunos navegadores/drivers no soportan WEBGL_lose_context.
// three loguea warning si alguien llama renderer.forceContextLoss().
// Lo convertimos en no-op si no existe la extensión, para evitar ruido y side-effects.
try {
  const proto = THREE?.WebGLRenderer?.prototype
  // @ts-ignore
  if (proto && !proto.__patchedLoseContextSafe) {
    // @ts-ignore
    proto.__patchedLoseContextSafe = true
    // Guardar referencia original SIN bind (necesitamos el renderer real como `this`)
    const origForceLoss = proto.forceContextLoss
    const origForceRestore = proto.forceContextRestore
    proto.forceContextLoss = function () {
      try {
        const ctx = this?.getContext?.()
        const ext = ctx?.getExtension?.('WEBGL_lose_context')
        if (!ext?.loseContext) return
      } catch {
        return
      }
      try { return typeof origForceLoss === 'function' ? origForceLoss.call(this) : undefined } catch { return }
    }
    proto.forceContextRestore = function () {
      try {
        const ctx = this?.getContext?.()
        const ext = ctx?.getExtension?.('WEBGL_lose_context')
        if (!ext?.restoreContext) return
      } catch {
        return
      }
      try { return typeof origForceRestore === 'function' ? origForceRestore.call(this) : undefined } catch { return }
    }
  }
} catch {}

// Bootstrap the React application.  React 19 uses createRoot from react-dom/client.
ReactDOM.createRoot(document.getElementById('root')).render(
  // OJO: StrictMode en DEV monta/desmonta dos veces, lo cual con R3F incrementa
  // mucho el riesgo de Context Lost (y dispara forceContextLoss en cleanup).
  <LanguageProvider>
    <App />
  </LanguageProvider>,
)