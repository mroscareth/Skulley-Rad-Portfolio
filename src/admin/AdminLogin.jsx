/**
 * Login screen with Google OAuth
 */

import React, { useEffect, useState } from 'react'
import { ArrowLeftIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import { useAdminAuth } from './useAdminAuth.jsx'

// Google SVG
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
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
        return 'Esta cuenta no tiene acceso al CMS. Entra con una cuenta autorizada.'
      case 'invalid_state':
        return 'Falló la verificación de seguridad. Intenta de nuevo.'
      case 'token_exchange_failed':
        return 'No se pudo iniciar sesión con Google. Intenta de nuevo.'
      case 'user_info_failed':
        return 'No se pudieron leer los datos de tu cuenta de Google. Intenta de nuevo.'
      case 'connection_error':
        return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'
      default:
        return 'Algo salió mal. Intenta de nuevo.'
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="a-card p-6 sm:p-8 text-center">
          <h1 className="a-title">Skulley Rad</h1>
          <p className="a-subtitle">Inicia sesión para administrar el sitio.</p>

          {displayError && (
            <div className="a-alert a-alert--danger p-4 mt-6 text-left" role="alert">
              <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" aria-hidden />
              <span>{getErrorMessage(displayError)}</span>
            </div>
          )}

          <button
            type="button"
            onClick={login}
            className="a-btn a-btn--primary a-btn--lg w-full mt-6"
          >
            {/* Google's mark needs a white ground; on magenta its colors fight the accent. */}
            <span className="grid place-items-center w-6 h-6 rounded-full bg-white flex-shrink-0">
              <GoogleIcon />
            </span>
            <span>Iniciar sesión con Google</span>
          </button>

          <p className="a-help text-center mt-4">Solo pueden entrar las cuentas autorizadas.</p>
        </div>

        <div className="flex justify-center mt-6">
          <a href="/" className="a-btn a-btn--ghost a-btn--sm min-h-11 sm:min-h-0">
            <ArrowLeftIcon className="w-4 h-4" aria-hidden />
            Volver al sitio
          </a>
        </div>
      </div>
    </main>
  )
}
