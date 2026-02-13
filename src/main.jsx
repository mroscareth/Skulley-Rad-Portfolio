import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { GameToastProvider } from './components/GameToast.jsx'
import './index.css'
import * as THREE from 'three'

// Global patch: some browsers/drivers don't support WEBGL_lose_context.
// three logs a warning if someone calls renderer.forceContextLoss().
// We convert it to a no-op if the extension is missing, to avoid noise and side-effects.
try {
  const proto = THREE?.WebGLRenderer?.prototype
  // @ts-ignore
  if (proto && !proto.__patchedLoseContextSafe) {
    // @ts-ignore
    proto.__patchedLoseContextSafe = true
    // Save original reference WITHOUT bind (we need the real renderer as `this`)
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
  // NOTE: StrictMode in DEV mounts/unmounts twice, which with R3F increases
  // the risk of Context Lost significantly (and triggers forceContextLoss in cleanup).
  <LanguageProvider>
    <GameToastProvider>
      <App />
    </GameToastProvider>
  </LanguageProvider>,
)