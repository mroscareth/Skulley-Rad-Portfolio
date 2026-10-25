/**
 * Analytics Dashboard — textos
 *
 * El CMS va en español mexicano (DESIGN.md §15.6), así que el dashboard ya no
 * tiene selector de idioma. Se conserva el contexto con `t(key)` para que los
 * componentes no cambien; `lang` queda fijo en 'es' y `setLang` no hace nada.
 * Antes la elección vivía en localStorage (`analytics_lang`): se deja de leer
 * para que nadie se quede atorado en inglés sin forma de regresar.
 */

import React, { createContext, useContext, useCallback, useMemo } from 'react'

// ── Diccionario ─────────────────────────────────────────────────
const es = {
  // Encabezado
  title: 'Estadísticas',
  subtitle: 'Quién visita el sitio, de dónde llega y con qué navega.',
  refreshing: 'Actualizando…',
  loading: 'Cargando estadísticas…',
  error_title: 'No se pudieron cargar las estadísticas',
  error_load: 'Algo salió mal. Intenta de nuevo.',
  error_connection: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.',
  retry: 'Reintentar',
  export: 'Exportar CSV',
  refresh: 'Actualizar',
  period_label: 'Periodo',
  period_7d: '7 días',
  period_30d: '30 días',
  period_90d: '90 días',

  // KPIs
  kpi_today: 'Visitas hoy',
  kpi_unique: 'Visitantes únicos hoy',
  kpi_unique_sub_db: 'Contados por IP',
  kpi_unique_sub_ga4: 'Según Google Analytics',
  kpi_total: 'Total histórico',
  kpi_week: 'Últimos 7 días',
  kpi_unique_ips: 'IPs distintas',
  vs_yesterday: 'vs. ayer',
  vs_last_week: 'vs. los 7 anteriores',
  kpi_help_db: 'Una visita es una página vista: si alguien recarga la misma página antes de 5 minutos, cuenta una sola vez. Los visitantes únicos son direcciones IP distintas, así que una casa u oficina con la misma red cuenta como una.',
  kpi_help_ga4: 'Hoy y los últimos 7 días vienen de Google Analytics; el total histórico, del contador propio del sitio.',
  online_one: 'visitante en los últimos 5 minutos',
  online_many: 'visitantes en los últimos 5 minutos',

  // Pestañas
  tabs_label: 'Secciones de estadísticas',
  tab_overview: 'Resumen',
  tab_geo: 'Ubicación',
  tab_tech: 'Tecnología',
  tab_live: 'Recientes',
  tab_network: 'Registro',

  // Paneles
  panel_dwell: 'Tiempo por sección',
  help_dwell: 'El sitio mide el tiempo en tramos de hasta 30 segundos, así que el promedio es por tramo, no por visita completa. El tiempo total sí suma todo.',
  panel_traffic: 'Visitas por día',
  panel_hourly: 'Visitas por hora',
  help_hourly: 'Siempre de los últimos 7 días, sin importar el periodo.',
  panel_pages: 'Páginas más vistas',
  panel_referrers: 'De dónde llegan',
  help_referrers: 'Sitios con un enlace que trajo gente. Las visitas directas no aparecen aquí.',
  panel_countries: 'Visitas por país',
  panel_top_ips: 'IPs con más visitas',
  panel_browsers: 'Navegadores',
  panel_os: 'Sistemas operativos',
  panel_devices: 'Tipo de dispositivo',
  panel_screens: 'Tamaños de pantalla',
  panel_isps: 'Proveedores de internet',
  panel_live: 'Últimas 20 visitas',
  panel_log: 'Registro de visitas',

  // Encabezados de tabla
  th_ip: 'IP',
  th_visits: 'Visitas',
  th_location: 'Ubicación',
  th_browser: 'Navegador',
  th_os: 'Sistema',
  th_last_seen: 'Última visita',
  th_time: 'Hora',
  th_country: 'País',
  th_agent: 'Navegador / sistema',
  th_device: 'Dispositivo',
  th_page: 'Página',
  th_lang: 'Idioma',
  th_prefs: 'Preferencias',
  th_section: 'Sección',
  th_avg_time: 'Tiempo prom.',
  th_date: 'Día',
  th_views_uniques: 'Visitas / únicas',

  // Gráficas
  engagement: 'Tiempo total',
  total: 'Total',
  peak: 'Hora pico',
  quiet_one: 'hora sin visitas',
  quiet_many: 'horas sin visitas',
  now: 'Ahora',
  unique_one: 'única',
  unique_many: 'únicas',
  visit_one: 'visita',
  visit_many: 'visitas',
  sample_one: 'muestra',
  sample_many: 'muestras',

  // Dispositivos
  device_desktop: 'Escritorio',
  device_mobile: 'Celular',
  device_tablet: 'Tableta',
  device_bot: 'Bot',
  dark_mode: 'Modo oscuro',
  light_mode: 'Modo claro',
  touch: 'Pantalla táctil',
  mouse: 'Mouse',

  // Estados vacíos
  empty_dwell: 'Todavía no hay datos de tiempo por sección.',
  empty_period: 'No hay visitas en este periodo.',
  empty_pages: 'Todavía no hay datos de páginas.',
  empty_geo: 'Todavía no hay datos de ubicación.',
  empty_ips: 'Todavía no hay datos de IPs.',
  empty_browsers: 'Todavía no hay datos de navegadores.',
  empty_os: 'Todavía no hay datos de sistemas operativos.',
  empty_devices: 'Todavía no hay datos de dispositivos.',
  empty_screens: 'Todavía no hay datos de pantallas.',
  empty_live: 'Todavía no hay visitas registradas.',
  empty_log: 'Todavía no hay visitas registradas.',

  // Varios
  isp_unit: 'visitas',
  querying: 'Cargando visitas…',
  entries: 'registros',
  footer: 'Los datos se actualizan solos cada 30 segundos. El CSV trae todas las visitas registradas, no solo las del periodo.',
  open_ga: 'Abrir Google Analytics',
  breakdown: 'Desglose por sección',
  sections_label: 'secciones',
  live_status: 'Se actualiza cada 30 s',
  page: 'Página',
  of: 'de',
  prev: 'Anterior',
  next: 'Siguiente',

  // Candado del dueño
  lock_on: 'Tus visitas no se cuentan',
  lock_off: 'Tus visitas sí se están contando',
  lock_on_sub: 'Lo que navegues desde este navegador no entra en estas estadísticas ni en Google Analytics.',
  lock_off_sub: 'Todo lo que navegues desde aquí infla los números.',
  lock_enable: 'No contarme',
  lock_disable: 'Volver a contarme',
  lock_devices: 'En tu celular o iPad, abre esto una vez:',
  lock_copy_label: 'Copiar el enlace para no contar tu celular o iPad',
  lock_copied: 'Copiado',
}

// ── Contexto ────────────────────────────────────────────────────
const LANG = 'es'

const AnalyticsLangContext = createContext(null)

export function AnalyticsLangProvider({ children }) {
  const setLang = useCallback(() => {}, [])
  const t = useCallback((key) => es[key] ?? key, [])
  const value = useMemo(() => ({ lang: LANG, setLang, t }), [setLang, t])

  return (
    <AnalyticsLangContext.Provider value={value}>
      {children}
    </AnalyticsLangContext.Provider>
  )
}

export function useAnalyticsLang() {
  const ctx = useContext(AnalyticsLangContext)
  if (!ctx) {
    throw new Error('useAnalyticsLang must be used within <AnalyticsLangProvider>')
  }
  return ctx
}
