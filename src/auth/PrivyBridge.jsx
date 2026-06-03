import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'

// Componente invisible que vive dentro de <PrivyProvider> y publica el
// estado real de Privy hacia afuera (al AuthProvider) vía `onState`.
// Cuando `autoTriggerLogin` está activo y Privy queda ready sin sesión,
// dispara `privy.login()` automáticamente.

export default function PrivyBridge({ onState, autoTriggerLogin }) {
  const privy = usePrivy()

  useEffect(() => {
    if (typeof onState !== 'function') return
    onState({
      ready: !!privy.ready,
      authenticated: !!privy.authenticated,
      user: privy.user || null,
      login: privy.login,
      logout: privy.logout,
    })
    // Deps: SOLO valores con significado y estables. privy.login/logout/user (objeto)
    // cambian de referencia cada render → si se incluyen, este effect se dispara en
    // bucle. Leemos esas refs frescas dentro cuando ready/auth/user-id cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy.ready, privy.authenticated, privy.user?.id, onState])

  // Auto-trigger login la primera vez que Privy esté ready si el usuario
  // solicitó login antes de que el shell terminara de cargar.
  useEffect(() => {
    if (!autoTriggerLogin) return
    if (!privy.ready) return
    if (privy.authenticated) return
    try { privy.login?.() } catch { /* ignore */ }
    // Sólo una vez por ciclo ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [privy.ready])

  return null
}
