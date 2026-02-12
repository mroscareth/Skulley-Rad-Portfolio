/**
 * Login screen with Google OAuth
 * Terminal CRT theme
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
        return 'ERROR: Tu cuenta no tiene acceso a este panel.'
      case 'invalid_state':
        return 'ERROR: Error de seguridad. Por favor intenta de nuevo.'
      case 'token_exchange_failed':
        return 'ERROR: Error al autenticar con Google.'
      case 'user_info_failed':
        return 'ERROR: No se pudo obtener tu información.'
      case 'connection_error':
        return 'ERROR: Error de conexión. Verifica tu internet.'
      default:
        return 'ERROR: Ocurrió un error. Por favor intenta de nuevo.'
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: '#0a0f0a',
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
      }}
    >
      {/* CRT Scanlines */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* CRT Glow */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          boxShadow: 'inset 0 0 120px rgba(59, 130, 246, 0.06), inset 0 0 60px rgba(59, 130, 246, 0.03)',
        }}
      />
      {/* Vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Login card */}
      <div className="relative w-full max-w-md z-20">
        {/* Terminal window */}
        <div
          className="relative rounded-sm overflow-hidden"
          style={{
            border: '1px solid rgba(59, 130, 246, 0.25)',
            boxShadow: '0 0 40px rgba(59, 130, 246, 0.08), inset 0 0 40px rgba(59, 130, 246, 0.03)',
          }}
        >
          {/* Terminal header bar */}
          <div
            className="flex items-center px-4 h-9 border-b"
            style={{
              backgroundColor: 'rgba(0, 10, 30, 0.85)',
              borderColor: 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <div className="flex gap-1.5 mr-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500/80" />
            </div>
            <span className="text-blue-500/60 text-xs">admin@skulley-rad:~/login</span>
          </div>

          {/* Terminal body */}
          <div
            className="p-8"
            style={{ backgroundColor: 'rgba(0, 10, 20, 0.6)' }}
          >
            {/* ASCII Header */}
            <div className="text-center mb-8">
              <pre
                className="text-blue-400 text-[0.4rem] sm:text-[0.5rem] leading-tight font-bold inline-block mb-4"
                style={{
                  textShadow: '0 0 15px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.3)',
                }}
              >
{`███████╗██╗  ██╗██╗   ██╗██╗     ██╗     ███████╗██╗   ██╗
██╔════╝██║ ██╔╝██║   ██║██║     ██║     ██╔════╝╚██╗ ██╔╝
███████╗█████╔╝ ██║   ██║██║     ██║     █████╗   ╚████╔╝ 
╚════██║██╔═██╗ ██║   ██║██║     ██║     ██╔══╝    ╚██╔╝  
███████║██║  ██╗╚██████╔╝███████╗███████╗███████╗   ██║   
╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝   ╚═╝`}
              </pre>

              <p
                className="text-sm text-blue-500/80 tracking-wider mb-1"
                style={{ textShadow: '0 0 8px rgba(59, 130, 246, 0.3)' }}
              >
                [ ADMIN PANEL v1.0 ]
              </p>
              <p className="text-blue-600/40 text-xs">
                // Authentication required to proceed
              </p>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="mb-6 p-3 rounded admin-error text-sm">
                <span className="opacity-70">&gt; </span>
                {getErrorMessage(displayError)}
              </div>
            )}

            {/* Login button */}
            <button
              onClick={login}
              className="
                w-full flex items-center justify-center gap-3
                px-6 py-4 rounded
                font-bold text-sm uppercase tracking-wider
                transition-all duration-200
                active:scale-[0.98]
              "
              style={{
                backgroundColor: '#3b82f6',
                color: '#000',
                border: '1px solid #60a5fa',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)',
              }}
            >
              <GoogleIcon />
              <span>&gt; authenticate_with_google</span>
            </button>

            {/* Footer */}
            <p className="mt-6 text-center text-blue-600/30 text-xs">
              // Only authorized users can access this terminal
            </p>
          </div>
        </div>

        {/* Back to site link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-blue-600/40 hover:text-blue-400 text-xs transition-colors"
          >
            &lt;-- cd ../site
          </a>
        </div>
      </div>
    </div>
  )
}
