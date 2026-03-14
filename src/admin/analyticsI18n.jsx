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
    title: 'Analytics Monitor',
    subtitle: '// monitoring web traffic — v2.1.0',
    refreshing: '> Refreshing data...',

    // KPI Cards
    kpi_today: "Today's Visits",
    kpi_unique: 'Unique Visitors',
    kpi_total: 'All-Time Total',
    kpi_week: 'Weekly Traffic',
    kpi_today_sub: 'distinct IPs today',
    kpi_unique_ips: 'unique IPs',

    // Tabs
    tab_overview: 'Overview',
    tab_geo: 'Geography',
    tab_tech: 'Technology',
    tab_live: 'Live Feed',
    tab_network: 'Log',

    // Panel titles
    panel_dwell: 'Section Dwell Time',
    panel_traffic: 'Traffic History',
    panel_hourly: 'Hourly Activity',
    panel_pages: 'Top Pages',
    panel_referrers: 'Traffic Sources',
    panel_countries: 'Visitors by Country',
    panel_top_ips: 'Recurring Visitors',
    panel_browsers: 'Browsers',
    panel_os: 'Operating Systems',
    panel_devices: 'Device Types',
    panel_screens: 'Screen Resolutions',
    panel_isps: 'Internet Providers',
    panel_live: 'Real-Time Connections',
    panel_log: 'Visit Log',

    // Table headers
    th_ip: 'IP Address',
    th_visits: 'Visits',
    th_location: 'Location',
    th_browser: 'Browser',
    th_os: 'OS',
    th_last_seen: 'Last Visit',

    // Misc
    isp_unit: 'visits',
    querying: '> Querying database...',
    entries: 'entries',
    footer: '// M.A.D.R.E. Monitor v2.1.0 — Tracking active',
    open_ga: '> Open Google Analytics',
    breakdown: '// Breakdown by section',
    vs_yesterday: 'vs yesterday',
    vs_last_week: 'vs last week',
    connections_detected: 'active connection(s) detected',
    sections_label: 'sections',
    samples_label: 'samples',
  },
  es: {
    // Header
    title: 'Monitor de Analytics',
    subtitle: '// Monitoreo de tráfico web — v2.1.0',
    refreshing: '> Actualizando datos...',

    // KPI Cards
    kpi_today: 'Visitas Hoy',
    kpi_unique: 'Visitantes Únicos',
    kpi_total: 'Total Histórico',
    kpi_week: 'Tráfico Semanal',
    kpi_today_sub: 'IPs distintas hoy',
    kpi_unique_ips: 'IPs únicas',

    // Tabs
    tab_overview: 'Resumen',
    tab_geo: 'Geografía',
    tab_tech: 'Tecnología',
    tab_live: 'En Vivo',
    tab_network: 'Registro',

    // Panel titles
    panel_dwell: 'Tiempo en Secciones',
    panel_traffic: 'Historial de Tráfico',
    panel_hourly: 'Actividad por Hora',
    panel_pages: 'Páginas Más Visitadas',
    panel_referrers: 'Fuentes de Tráfico',
    panel_countries: 'Visitantes por País',
    panel_top_ips: 'Visitantes Recurrentes',
    panel_browsers: 'Navegadores',
    panel_os: 'Sistemas Operativos',
    panel_devices: 'Tipo de Dispositivo',
    panel_screens: 'Resoluciones de Pantalla',
    panel_isps: 'Proveedores de Internet',
    panel_live: 'Conexiones en Tiempo Real',
    panel_log: 'Registro de Visitas',

    // Table headers
    th_ip: 'Dirección IP',
    th_visits: 'Visitas',
    th_location: 'Ubicación',
    th_browser: 'Navegador',
    th_os: 'Sistema',
    th_last_seen: 'Última Visita',

    // Misc
    isp_unit: 'visitas',
    querying: '> Consultando base de datos...',
    entries: 'entradas',
    footer: '// M.A.D.R.E. Monitor v2.1.0 — Tracking activo',
    open_ga: '> Abrir Google Analytics',
    breakdown: '// Desglose por sección',
    vs_yesterday: 'vs ayer',
    vs_last_week: 'vs semana anterior',
    connections_detected: 'conexión(es) activa(s) detectada(s)',
    sections_label: 'secciones',
    samples_label: 'muestras',
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
