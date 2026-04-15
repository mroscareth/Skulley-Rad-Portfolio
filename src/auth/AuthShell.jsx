import React from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import PrivyBridge from './PrivyBridge.jsx'

// Shell lazy-loaded que contiene TODA la dependencia de @privy-io.
// Vite emite este archivo como chunk separado; Privy y Solana wallet connectors
// NO entran al bundle inicial — se descargan sólo cuando el usuario interactúa
// con un botón de login (o algún flujo proactivo llama a `mountAuth()`).

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
})

export default function AuthShell({ onState, autoTriggerLogin }) {
  return (
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
      <PrivyBridge onState={onState} autoTriggerLogin={autoTriggerLogin} />
    </PrivyProvider>
  )
}
