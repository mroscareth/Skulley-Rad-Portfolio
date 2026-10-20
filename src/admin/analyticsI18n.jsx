/**
 * Analytics Dashboard — Lightweight i18n (EN/ES)
 *
 * Provides a React context with a `t(key)` helper to translate
 * all visible labels. Language choice persists in localStorage.
 */

import React, { createContext, useContext, useState, useCallback } from 'react'

// ── Translation dictionary ──────────────────────────────────────
const translations = {
  en: {
    // Header
    title: 'Analytics',
    subtitle: 'Who visits the site, where they come from and what they browse with.',
    refreshing: 'Refreshing data…',
    loading: 'Loading analytics…',
    error_title: "Couldn't load analytics",
    retry: 'Try again',
    export: 'Export CSV',
    refresh: 'Refresh',
    period_label: 'Period',
    period_7d: '7 days',
    period_30d: '30 days',
    period_90d: '90 days',
    lang_label: 'Language',

    // KPI Cards
    kpi_today: "Today's visits",
    kpi_unique: 'Unique visitors',
    kpi_total: 'All-time total',
    kpi_week: 'Weekly traffic',
    kpi_today_sub: 'Distinct IPs today',
    kpi_unique_ips: 'unique IPs',

    // Tabs
    tab_overview: 'Overview',
    tab_geo: 'Geography',
    tab_tech: 'Technology',
    tab_live: 'Live feed',
    tab_network: 'Log',

    // Panel titles
    panel_dwell: 'Time per section',
    panel_traffic: 'Traffic history',
    panel_hourly: 'Activity by hour',
    panel_pages: 'Top pages',
    panel_referrers: 'Traffic sources',
    panel_countries: 'Visitors by country',
    panel_top_ips: 'Returning visitors',
    panel_browsers: 'Browsers',
    panel_os: 'Operating systems',
    panel_devices: 'Device types',
    panel_screens: 'Screen resolutions',
    panel_isps: 'Internet providers',
    panel_live: 'Real-time visits',
    panel_log: 'Visit log',

    // Table headers
    th_ip: 'IP address',
    th_visits: 'Visits',
    th_location: 'Location',
    th_browser: 'Browser',
    th_os: 'OS',
    th_last_seen: 'Last visit',
    th_time: 'Time',
    th_country: 'Country',
    th_agent: 'Browser / OS',
    th_device: 'Device',
    th_page: 'Page',
    th_lang: 'Language',
    th_prefs: 'Preferences',
    th_section: 'Section',
    th_avg_time: 'Avg. time',
    th_date: 'Date',
    th_views_uniques: 'Views / unique',

    // Charts
    engagement: 'Total time',
    total: 'Total',
    peak: 'Peak',
    quiet: 'h with no visits',
    now: 'Now',
    unique: 'unique',
    visit_one: 'visit',
    visit_many: 'visits',

    // Devices
    device_desktop: 'Desktop',
    device_mobile: 'Mobile',
    device_tablet: 'Tablet',
    device_bot: 'Bot',
    dark_mode: 'Dark mode',
    light_mode: 'Light mode',
    touch: 'Touch screen',
    mouse: 'Mouse',

    // Empty states
    empty_dwell: 'No time-per-section data yet.',
    empty_period: 'No visits in this period.',
    empty_pages: 'No page data yet.',
    empty_geo: 'No location data yet.',
    empty_ips: 'No IP data yet.',
    empty_browsers: 'No browser data yet.',
    empty_os: 'No operating system data yet.',
    empty_devices: 'No device data yet.',
    empty_screens: 'No screen data yet.',
    empty_live: 'Nobody on the site right now.',
    empty_log: 'No visits recorded yet.',

    // Misc
    isp_unit: 'visits',
    querying: 'Loading visits…',
    entries: 'entries',
    footer: 'Tracking active. Data refreshes every 30 seconds.',
    open_ga: 'Open Google Analytics',
    breakdown: 'Breakdown by section',
    vs_yesterday: 'vs yesterday',
    vs_last_week: 'vs last week',
    connections_detected: 'online now',
    sections_label: 'sections',
    samples_label: 'samples',
    live_status: 'Live · refreshes every 30 s',
    page: 'Page',
    of: 'of',
    prev: 'Previous',
    next: 'Next',

    // Owner opt-out
    lock_on: 'Your visits are not being counted',
    lock_off: 'Your visits are being counted',
    lock_on_sub: 'This browser is excluded from the tracker and from GA4.',
    lock_off_sub: 'Everything you browse from here is inflating the numbers.',
    lock_enable: 'Exclude me',
    lock_disable: 'Count me',
    lock_devices: 'On your phone or iPad, open this once:',
    lock_copied: 'Copied',
  },
  es: {
    // Header
    title: 'Analítica',
    subtitle: 'Quién visita el sitio, de dónde llega y con qué navega.',
    refreshing: 'Actualizando datos…',
    loading: 'Cargando analítica…',
    error_title: 'No se pudo cargar la analítica',
    retry: 'Reintentar',
    export: 'Exportar CSV',
    refresh: 'Actualizar',
    period_label: 'Periodo',
    period_7d: '7 días',
    period_30d: '30 días',
    period_90d: '90 días',
    lang_label: 'Idioma',

    // KPI Cards
    kpi_today: 'Visitas hoy',
    kpi_unique: 'Visitantes únicos',
    kpi_total: 'Total histórico',
    kpi_week: 'Tráfico semanal',
    kpi_today_sub: 'IPs distintas hoy',
    kpi_unique_ips: 'IPs únicas',

    // Tabs
    tab_overview: 'Resumen',
    tab_geo: 'Geografía',
    tab_tech: 'Tecnología',
    tab_live: 'En vivo',
    tab_network: 'Registro',

    // Panel titles
    panel_dwell: 'Tiempo por sección',
    panel_traffic: 'Historial de tráfico',
    panel_hourly: 'Actividad por hora',
    panel_pages: 'Páginas más visitadas',
    panel_referrers: 'Fuentes de tráfico',
    panel_countries: 'Visitantes por país',
    panel_top_ips: 'Visitantes recurrentes',
    panel_browsers: 'Navegadores',
    panel_os: 'Sistemas operativos',
    panel_devices: 'Tipo de dispositivo',
    panel_screens: 'Resoluciones de pantalla',
    panel_isps: 'Proveedores de internet',
    panel_live: 'Visitas en tiempo real',
    panel_log: 'Registro de visitas',

    // Table headers
    th_ip: 'Dirección IP',
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
    th_date: 'Fecha',
    th_views_uniques: 'Vistas / únicas',

    // Gráficas
    engagement: 'Tiempo total',
    total: 'Total',
    peak: 'Pico',
    quiet: 'h sin visitas',
    now: 'Ahora',
    unique: 'únicas',
    visit_one: 'visita',
    visit_many: 'visitas',

    // Dispositivos
    device_desktop: 'Escritorio',
    device_mobile: 'Móvil',
    device_tablet: 'Tableta',
    device_bot: 'Bot',
    dark_mode: 'Modo oscuro',
    light_mode: 'Modo claro',
    touch: 'Pantalla táctil',
    mouse: 'Mouse',

    // Estados vacíos
    empty_dwell: 'Aún no hay datos de tiempo por sección.',
    empty_period: 'No hay visitas en este periodo.',
    empty_pages: 'Aún no hay datos de páginas.',
    empty_geo: 'Aún no hay datos de ubicación.',
    empty_ips: 'Aún no hay datos de IPs.',
    empty_browsers: 'Aún no hay datos de navegadores.',
    empty_os: 'Aún no hay datos de sistemas operativos.',
    empty_devices: 'Aún no hay datos de dispositivos.',
    empty_screens: 'Aún no hay datos de pantallas.',
    empty_live: 'No hay nadie en el sitio ahora mismo.',
    empty_log: 'Aún no hay visitas registradas.',

    // Misc
    isp_unit: 'visitas',
    querying: 'Cargando visitas…',
    entries: 'entradas',
    footer: 'Tracking activo. Los datos se actualizan cada 30 segundos.',
    open_ga: 'Abrir Google Analytics',
    breakdown: 'Desglose por sección',
    vs_yesterday: 'vs ayer',
    vs_last_week: 'vs semana anterior',
    connections_detected: 'en línea ahora',
    sections_label: 'secciones',
    samples_label: 'muestras',
    live_status: 'En vivo · se actualiza cada 30 s',
    page: 'Página',
    of: 'de',
    prev: 'Anterior',
    next: 'Siguiente',

    // Opt-out del dueño
    lock_on: 'Tus visitas no se están contando',
    lock_off: 'Tus visitas sí se están contando',
    lock_on_sub: 'Este navegador está excluido del tracker y de GA4.',
    lock_off_sub: 'Todo lo que navegues desde aquí está inflando los números.',
    lock_enable: 'Excluirme',
    lock_disable: 'Contarme',
    lock_devices: 'En tu celular o iPad, abre esto una vez:',
    lock_copied: 'Copiado',
  },
}

// ── React Context ───────────────────────────────────────────────
const STORAGE_KEY = 'analytics_lang'

const AnalyticsLangContext = createContext(null)

export function AnalyticsLangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'en'
    } catch {
      return 'en'
    }
  })

  const setLang = useCallback((newLang) => {
    setLangState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {
      // localStorage unavailable — silently fail
    }
  }, [])

  const t = useCallback(
    (key) => translations[lang]?.[key] ?? translations.en?.[key] ?? key,
    [lang]
  )

  return (
    <AnalyticsLangContext.Provider value={{ lang, setLang, t }}>
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
