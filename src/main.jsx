import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { GameToastProvider } from './components/GameToast.jsx'
import './index.css'
import * as THREE from 'three'
import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'

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

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
})

// Bootstrap the React application.
ReactDOM.createRoot(document.getElementById('root')).render(
  <PrivyProvider
    appId={import.meta.env.VITE_PRIVY_APP_ID || 'dummy_id'}
    config={{
      loginMethodsAndOrder: {
        primary: ['google', 'email', 'wallet'],
      },
      appearance: {
        theme: 'dark',
        accentColor: '#3b82f6',
        logo: '/images/skully-logo.png',
        walletChainType: 'ethereum-and-solana',
        walletList: ['metamask', 'phantom', 'rainbow', 'wallet_connect'],
      },
      externalWallets: {
        solana: {
          connectors: solanaConnectors,
        },
      },
    }}
  >
    <LanguageProvider>
      <GameToastProvider>
        <App />
      </GameToastProvider>
    </LanguageProvider>
  </PrivyProvider>
)