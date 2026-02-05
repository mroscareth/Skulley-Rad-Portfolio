/**
 * Login screen with Google OAuth
 * Futuristic design with glassmorphism
 */

import React, { useEffect, useState } from 'react'
import { useAdminAuth } from './useAdminAuth.jsx'

// Google SVG
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

export default function AdminLogin() {
  const { login, error } = useAdminAuth()
  const [urlError, setUrlError] = useState(null)

  // Check for errors in URL (from OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      setUrlError(errorParam)
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const displayError = urlError || error

  const getErrorMessage = (err) => {
    switch (err) {
      case 'unauthorized':
        return 'Tu cuenta no tiene acceso a este panel.'
      case 'invalid_state':
        return 'Error de seguridad. Por favor intenta de nuevo.'
      case 'token_exchange_failed':
        return 'Error al autenticar con Google.'
      case 'user_info_failed':
        return 'No se pudo obtener tu información.'
      case 'connection_error':
        return 'Error de conexión. Verifica tu internet.'
      default:
        return 'Ocurrió un error. Por favor intenta de nuevo.'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-purple-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md">
        {/* Glassmorphism card */}
        <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
          {/* RGB border effect */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div
              className="absolute inset-0 opacity-50"
              style={{
                background: 'linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                backgroundSize: '400% 100%',
                animation: 'rgbShift 6s linear infinite',
                mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                maskComposite: 'xor',
                padding: '1px',
              }}
            />
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h1 
              className="text-2xl text-white mb-2"
              style={{ fontFamily: "'Luckiest Guy', 'Archivo Black', system-ui, sans-serif" }}
            >
              Panel de Administración
            </h1>
            <p className="text-white/50 text-sm">
              Inicia sesión para gestionar tu portfolio
            </p>
          </div>

          {/* Error message */}
          {displayError && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm text-center">
                {getErrorMessage(displayError)}
              </p>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={login}
            className="
              w-full flex items-center justify-center gap-3
              px-6 py-4 rounded-xl
              bg-white text-slate-900
              font-semibold text-base
              hover:bg-white/90 active:scale-[0.98]
              transition-all duration-200
              shadow-lg shadow-white/10
            "
          >
            <GoogleIcon />
            <span>Continuar con Google</span>
          </button>

          {/* Footer */}
          <p className="mt-6 text-center text-white/30 text-xs">
            Solo usuarios autorizados pueden acceder
          </p>
        </div>

        {/* Back to site link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            ← Volver al sitio
          </a>
        </div>
      </div>
    </div>
  )
}
