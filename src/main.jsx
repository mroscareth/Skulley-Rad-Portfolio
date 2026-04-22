import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { GameToastProvider } from './components/GameToast.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import { ShopCartProvider } from './lib/shopCartContext.jsx'
import { ShopDataProvider } from './lib/shopDataContext.jsx'
import './index.css'

// The `three.js` lose-context patch was moved to src/lib/patchThreeLoseContext.js
// and is applied from HomeCanvas on mount. This keeps `three` out of the
// eager vendor chunk.

// Bootstrap the React application.
// AuthProvider renders a lightweight stub context on first paint and
// dynamically imports @privy-io + Solana wallet connectors only when the
// user triggers a login (or a component calls `mountAuth()` proactively).
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <LanguageProvider>
      <GameToastProvider>
        <ShopDataProvider>
          <ShopCartProvider>
            <App />
          </ShopCartProvider>
        </ShopDataProvider>
      </GameToastProvider>
    </LanguageProvider>
  </AuthProvider>
)
