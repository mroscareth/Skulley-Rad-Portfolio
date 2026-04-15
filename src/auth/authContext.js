import { createContext, useContext } from 'react'

// AuthContext provee un estado de auth desacoplado de Privy.
// Hasta que el usuario solicita login (o el shell se monta proactivamente),
// el contexto devuelve un stub con `ready: false`, `authenticated: false`.
// Cuando Privy carga, PrivyBridge pisa el estado con datos reales.
//
// IMPORTANTE: el shape (ready, authenticated, user, login, logout) es
// compatible con el antiguo `usePrivy()` en los puntos donde se usa.
// Si algún componente necesita features adicionales de Privy (e.g. linkWallet),
// agregarlas al bridge y exponerlas aquí.

const defaultValue = {
  ready: false,
  authenticated: false,
  user: null,
  login: () => {},
  logout: () => {},
  // Permite forzar la carga del shell sin disparar login inmediatamente.
  // Útil para warm-up en idle callbacks.
  mountAuth: () => {},
}

export const AuthContext = createContext(defaultValue)

export function useAuth() {
  return useContext(AuthContext)
}
