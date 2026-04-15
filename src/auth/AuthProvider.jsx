import React, { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react'
import { AuthContext } from './authContext.js'

// AuthShell (lazy) trae toda la dependencia de @privy-io/react-auth y sus
// Solana wallet connectors. Vite lo parte en un chunk separado del bundle
// inicial — se descarga sólo cuando realmente se necesita login.
const AuthShell = lazy(() => import('./AuthShell.jsx'))

// AuthProvider mantiene un estado local (stub) hasta que el usuario
// solicita login. En ese momento se monta AuthShell (dynamic import de Privy)
// y PrivyBridge empuja el estado real hacia este provider.
export default function AuthProvider({ children }) {
  const [shellMounted, setShellMounted] = useState(false)
  const [realState, setRealState] = useState(null)
  const [autoLogin, setAutoLogin] = useState(false)

  // Queue de la login request si se llamó antes de que el shell estuviera ready.
  const pendingLoginRef = useRef(false)

  const mountAuth = useCallback(() => {
    if (!shellMounted) setShellMounted(true)
  }, [shellMounted])

  const handleShellState = useCallback((s) => {
    setRealState(s)
    // Si había un login pendiente y ya el bridge publicó login real, dispararlo.
    if (pendingLoginRef.current && s?.ready && !s?.authenticated) {
      pendingLoginRef.current = false
      try { s.login?.() } catch { /* ignore */ }
    }
  }, [])

  const stubLogin = useCallback(() => {
    // Si el shell aún no se monta, lo montamos y pedimos auto-trigger.
    if (!shellMounted) {
      pendingLoginRef.current = true
      setAutoLogin(true)
      setShellMounted(true)
      return
    }
    // Shell montado pero bridge aún no publicó: quede pendiente.
    if (!realState?.login) {
      pendingLoginRef.current = true
      return
    }
    try { realState.login() } catch { /* ignore */ }
  }, [shellMounted, realState])

  const stubLogout = useCallback(() => {
    if (realState?.logout) {
      try { realState.logout() } catch { /* ignore */ }
    }
  }, [realState])

  // Cuando el bridge publica estado real, úsalo; si no, stub.
  const value = useMemo(() => {
    if (realState) {
      return {
        ready: realState.ready,
        authenticated: realState.authenticated,
        user: realState.user,
        login: realState.login || stubLogin,
        logout: realState.logout || stubLogout,
        mountAuth,
      }
    }
    return {
      ready: false,
      authenticated: false,
      user: null,
      login: stubLogin,
      logout: stubLogout,
      mountAuth,
    }
  }, [realState, stubLogin, stubLogout, mountAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {shellMounted && (
        <Suspense fallback={null}>
          <AuthShell onState={handleShellState} autoTriggerLogin={autoLogin} />
        </Suspense>
      )}
    </AuthContext.Provider>
  )
}
