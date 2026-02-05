/**
 * Hook de autenticación para el admin
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Verificar sesión al cargar
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth.php?action=me', {
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.user) {
          setUser(data.user)
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      setUser(null)
      setError('connection_error')
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(() => {
    // Redirige al servidor para OAuth
    window.location.href = '/api/auth.php?action=login'
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth.php?action=logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setUser(null)
    }
  }, [])

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AuthProvider')
  }
  return context
}

export default useAdminAuth
