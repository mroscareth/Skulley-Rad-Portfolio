// Opt-out del dueño para los analytics.
//
// Una sola cookie apaga las DOS fuentes de conteo: el beacon propio
// (`analytics.php?action=track`) y GA4. La decisión se toma en el preámbulo
// inline de `index.html`, que corre antes que gtag y antes que el bundle —
// para cuando React monta, GA4 ya habría contado la visita, así que no puede
// vivir acá. Este módulo solo lee y escribe la misma cookie desde el CMS.
//
// Se pone sola al entrar al CMS (ver `handleCallback` en `public/api/auth.php`)
// y en cualquier aparato abriendo `?notrack=1` una vez.
//
// Ojo: NO es control de acceso. Cualquiera puede ponerse la cookie para no ser
// contado. Es un opt-out y para un contador propio con eso basta; el servidor
// vuelve a checarla en `isTrackingExcluded()` solo por si un HTML cacheado se
// salta el corte del cliente.

const COOKIE = 'mroscar_notrack'
const TWO_YEARS_S = 63072000

export function isOptedOut() {
  if (typeof document === 'undefined') return false
  return new RegExp(`(^|;\\s*)${COOKIE}=1`).test(document.cookie)
}

export function setOptedOut(enabled) {
  if (typeof document === 'undefined') return
  document.cookie = enabled
    ? `${COOKIE}=1; path=/; max-age=${TWO_YEARS_S}; samesite=lax`
    : `${COOKIE}=; path=/; max-age=0; samesite=lax`
  // El hook de dwell time lee esta bandera en cada flush, así que el cambio
  // aplica sin recargar. GA4 sí necesita reload — ya está cargado o no.
  if (typeof window !== 'undefined') window.__madreNoTrack = enabled
}

/** URL para excluir otro aparato (celular, iPad) con una sola visita. */
export function optOutUrl() {
  if (typeof window === 'undefined') return '/?notrack=1'
  return `${window.location.origin}/?notrack=1`
}
