/**
 * Analytics Dashboard
 *
 * Visitor data, traffic charts, geography, tech breakdown, live feed and
 * the raw visit log. Visual system in admin.css (DESIGN.md §15); charts use
 * the section palette with magenta as the main series.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import TerminalWorldMap from './TerminalWorldMap'
import { AnalyticsLangProvider, useAnalyticsLang } from './analyticsI18n.jsx'
import {
    ChartBarIcon,
    GlobeAltIcon,
    ComputerDesktopIcon,
    DevicePhoneMobileIcon,
    DeviceTabletIcon,
    SignalIcon,
    ClockIcon,
    ArrowPathIcon,
    EyeIcon,
    UserGroupIcon,
    ServerIcon,
    WifiIcon,
    MapPinIcon,
    CpuChipIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ArrowDownTrayIcon,
    ArrowTopRightOnSquareIcon,
    ShieldCheckIcon,
    ExclamationTriangleIcon,
    CheckIcon,
    LinkIcon,
    QueueListIcon,
    MoonIcon,
    SunIcon,
    HandRaisedIcon,
    CursorArrowRaysIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/solid'
import { isOptedOut, setOptedOut, optOutUrl } from '../lib/analyticsOptOut.js'

// Section palette (DESIGN.md §1.1 / §15.4). Magenta is always the main series.
const PALETTE = {
    magenta: '#e600ff',
    cyan: '#00bfff',
    green: '#39ff14',
    orange: '#ff6b00',
    yellow: '#f5ff00',
}
const ACCENT = PALETTE.magenta
const accentAlpha = (a) => `rgba(230, 0, 255, ${a})`
const NEUTRAL = 'rgba(255, 255, 255, 0.55)'

// ── Candado del dueño ────────────────────────────────────────────
// Ni tabla ni endpoint: la cookie es legible desde JS, así que el toggle la
// escribe directo (ver src/lib/analyticsOptOut.js). Entrar al CMS ya la pone
// sola por dos años; esto existe para poder APAGARLA cuando quieras ver si el
// tracking sigue vivo, y para pasarle la URL a tus otros aparatos.
function TrackingLock({ t }) {
    const [excluded, setExcluded] = useState(() => isOptedOut())
    const [copied, setCopied] = useState(false)
    const url = optOutUrl()

    const toggle = () => {
        const next = !excluded
        setOptedOut(next)
        setExcluded(next)
    }

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
        } catch { }
    }

    return (
        <div className={`a-alert ${excluded ? 'a-alert--success' : 'a-alert--warning'} mb-6 flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-3`}>
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                {excluded
                    ? <ShieldCheckIcon className="w-[1.125rem] h-[1.125rem] shrink-0 mt-px" aria-hidden />
                    : <ExclamationTriangleIcon className="w-[1.125rem] h-[1.125rem] shrink-0 mt-px" aria-hidden />}
                <div className="min-w-0">
                    <p className="font-semibold">
                        {excluded ? t('lock_on') : t('lock_off')}
                    </p>
                    <p className="text-[0.8125rem] text-white/55 mt-0.5">
                        {excluded ? t('lock_on_sub') : t('lock_off_sub')}
                    </p>
                </div>
            </div>

            {/* URL para el celular: solo tiene sentido mostrarla si el candado
                está puesto acá — si no, lo primero es arreglar ESTE navegador. */}
            {excluded && (
                <button
                    type="button"
                    onClick={copy}
                    className="a-btn a-btn--ghost a-btn--sm self-start sm:self-auto min-w-0 max-w-full"
                    title={url}
                >
                    {copied
                        ? <CheckIcon className="w-4 h-4 shrink-0" aria-hidden />
                        : <LinkIcon className="w-4 h-4 shrink-0" aria-hidden />}
                    <span className="hidden lg:inline">{t('lock_devices')}</span>
                    {copied
                        ? <span>{t('lock_copied')}</span>
                        : <span className="a-code truncate min-w-0">{url.replace(/^https?:\/\//, '')}</span>}
                </button>
            )}

            <button
                type="button"
                onClick={toggle}
                className="a-btn a-btn--secondary a-btn--sm shrink-0 self-start sm:self-auto"
            >
                {excluded ? t('lock_disable') : t('lock_enable')}
            </button>
        </div>
    )
}

// ── Utility: format numbers with commas ──
const fmt = (n) => Number(n || 0).toLocaleString()

// ── Utility: relative time ──
const timeAgo = (dateStr) => {
    const now = new Date()
    const then = new Date(dateStr)
    const diff = Math.floor((now - then) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
}

// ── Device icon component ──
const DeviceIcon = ({ type, className = 'w-4 h-4' }) => {
    switch (type) {
        case 'mobile': return <DevicePhoneMobileIcon className={className} aria-hidden />
        case 'tablet': return <DeviceTabletIcon className={className} aria-hidden />
        case 'bot': return <CpuChipIcon className={className} aria-hidden />
        default: return <ComputerDesktopIcon className={className} aria-hidden />
    }
}

// Unknown device types fall back to the raw value instead of the i18n key.
const deviceLabel = (t, type) => {
    const key = `device_${type}`
    const label = t(key)
    return label === key ? (type || '—') : label
}

// ── Country flag emoji from country code ──
const countryFlag = (code) => {
    if (!code || code.length !== 2) return '🌐'
    const c = code.toUpperCase()
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

export default function AnalyticsDashboard() {
    return (
        <AnalyticsLangProvider>
            <AnalyticsDashboardInner />
        </AnalyticsLangProvider>
    )
}

function AnalyticsDashboardInner() {
    const { lang, setLang, t } = useAnalyticsLang()
    const [data, setData] = useState(null)
    const [live, setLive] = useState([])
    const [initialLoad, setInitialLoad] = useState(true) // first-time boot only
    const [refreshing, setRefreshing] = useState(false)  // period change overlay
    const [error, setError] = useState(null)
    const [period, setPeriod] = useState('7d')
    const [activeTab, setActiveTab] = useState('overview')
    const liveRef = useRef(null)

    // ── Fetch dashboard data ──
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/analytics.php?action=dashboard&period=${period}`, {
                credentials: 'include',
            })
            const json = await res.json()
            if (json.ok) {
                setData(json)
                setError(null)
            } else {
                setError(json.error || 'Failed to load analytics')
            }
        } catch (err) {
            setError('Connection error')
        } finally {
            setInitialLoad(false)
            setRefreshing(false)
        }
    }, [period])

    // ── Fetch live feed ──
    const fetchLive = useCallback(async () => {
        try {
            const res = await fetch('/api/analytics.php?action=live', { credentials: 'include' })
            const json = await res.json()
            if (json.ok) setLive(json.visitors || [])
        } catch { }
    }, [])

    useEffect(() => {
        fetchData()
        fetchLive()
        // Auto-refresh every 30s
        const interval = setInterval(() => {
            fetchData()
            fetchLive()
        }, 30000)
        return () => clearInterval(interval)
    }, [fetchData, fetchLive])

    // ── Percentage change helpers ──
    const todayVsYesterday = data
        ? data.yesterday_views > 0
            ? Math.round(((data.today.views - data.yesterday_views) / data.yesterday_views) * 100)
            : data.today.views > 0 ? 100 : 0
        : 0

    const weekVsWeek = data
        ? data.last_week > 0
            ? Math.round(((data.this_week - data.last_week) / data.last_week) * 100)
            : data.this_week > 0 ? 100 : 0
        : 0

    if (initialLoad) {
        return (
            <div className="w-full">
                <LoadingState t={t} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="w-full py-16">
                <div className="a-alert a-alert--danger max-w-lg mx-auto px-4 py-3" role="alert">
                    <ExclamationTriangleIcon className="w-[1.125rem] h-[1.125rem] shrink-0 mt-px" aria-hidden />
                    <div className="min-w-0">
                        <p className="font-semibold">{t('error_title')}</p>
                        <p className="text-[0.8125rem] text-white/55 mt-0.5">{error}</p>
                    </div>
                </div>
                <div className="flex justify-center mt-4">
                    <button
                        type="button"
                        onClick={() => { setInitialLoad(true); fetchData() }}
                        className="a-btn a-btn--secondary"
                    >
                        <ArrowPathIcon className="w-4 h-4" aria-hidden />
                        {t('retry')}
                    </button>
                </div>
            </div>
        )
    }

    const tabs = [
        { id: 'overview', label: t('tab_overview'), Icon: ChartBarIcon },
        { id: 'geo', label: t('tab_geo'), Icon: GlobeAltIcon },
        { id: 'tech', label: t('tab_tech'), Icon: CpuChipIcon },
        { id: 'live', label: t('tab_live'), Icon: SignalIcon },
        { id: 'network', label: t('tab_network'), Icon: QueueListIcon },
    ]

    return (
        <div className="w-full a-fade-in relative">
            {/* Refreshing overlay (period change) */}
            {refreshing && (
                <div
                    className="absolute inset-0 z-50 flex items-start justify-center rounded-[var(--a-radius)]"
                    style={{ background: 'rgba(10, 5, 16, 0.7)' }}
                    role="status"
                    aria-live="polite"
                >
                    <div className="a-inset sticky top-24 mt-24 flex items-center gap-3 px-4 py-3">
                        <div className="a-spinner a-spinner--sm" aria-hidden />
                        <span className="text-sm text-white/70">{t('refreshing')}</span>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
                <div className="min-w-0">
                    <h1 className="a-title">{t('title')}</h1>
                    <p className="a-subtitle">{t('subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('period_label')}>
                        {['7d', '30d', '90d'].map((p) => (
                            <button
                                key={p}
                                type="button"
                                aria-pressed={period === p}
                                onClick={() => { if (p !== period) { setPeriod(p); setRefreshing(true) } }}
                                className="a-chip"
                            >
                                {t(`period_${p}`)}
                            </button>
                        ))}
                    </div>

                    <span className="hidden sm:block w-0.5 h-5 bg-white/10 mx-1" aria-hidden />

                    <div className="flex gap-1.5" role="group" aria-label={t('lang_label')}>
                        {['en', 'es'].map((l) => (
                            <button
                                key={l}
                                type="button"
                                aria-pressed={lang === l}
                                onClick={() => setLang(l)}
                                className="a-chip uppercase"
                                title={l === 'en' ? 'English' : 'Español'}
                            >
                                {l}
                            </button>
                        ))}
                    </div>

                    <span className="hidden sm:block w-0.5 h-5 bg-white/10 mx-1" aria-hidden />

                    <button
                        type="button"
                        onClick={() => {
                            window.open('/api/analytics.php?action=export', '_blank')
                        }}
                        className="a-btn a-btn--secondary a-btn--sm"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" aria-hidden />
                        {t('export')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { fetchData(); fetchLive() }}
                        className="a-icon-btn"
                        aria-label={t('refresh')}
                        title={t('refresh')}
                    >
                        <ArrowPathIcon className="w-[1.125rem] h-[1.125rem]" />
                    </button>
                </div>
            </header>

            {/* ── Candado del dueño ── */}
            <TrackingLock t={t} />

            {/* ── Online now ── */}
            {data?.online_now > 0 && (
                <div className="mb-6">
                    <span className="a-badge a-badge--success">
                        <span className="a-dot bg-green-400" aria-hidden />
                        {data.online_now} {t('connections_detected')}
                    </span>
                </div>
            )}

            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <KpiCard
                    label={t('kpi_today')}
                    value={fmt(data?.today?.views)}
                    sub={`${todayVsYesterday >= 0 ? '+' : ''}${todayVsYesterday}% ${t('vs_yesterday')}`}
                    trend={todayVsYesterday}
                    icon={<EyeIcon className="w-4 h-4" aria-hidden />}
                />
                <KpiCard
                    label={t('kpi_unique')}
                    value={fmt(data?.today?.unique_ips)}
                    sub={t('kpi_today_sub')}
                    icon={<UserGroupIcon className="w-4 h-4" aria-hidden />}
                />
                <KpiCard
                    label={t('kpi_total')}
                    value={fmt(data?.all_time?.views)}
                    sub={`${fmt(data?.all_time?.unique_ips)} ${t('kpi_unique_ips')}`}
                    icon={<ServerIcon className="w-4 h-4" aria-hidden />}
                />
                <KpiCard
                    label={t('kpi_week')}
                    value={fmt(data?.this_week)}
                    sub={`${weekVsWeek >= 0 ? '+' : ''}${weekVsWeek}% ${t('vs_last_week')}`}
                    trend={weekVsWeek}
                    icon={<ChartBarIcon className="w-4 h-4" aria-hidden />}
                />
            </div>

            {/* ── Tabs ── */}
            <div className="a-tabs mb-6" role="tablist" aria-label={t('title')}>
                {tabs.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        id={`analytics-tab-${id}`}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === id}
                        aria-controls="analytics-tabpanel"
                        onClick={() => setActiveTab(id)}
                        className="a-tab"
                    >
                        <Icon className="w-4 h-4" aria-hidden />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Tab content ── */}
            <div id="analytics-tabpanel" role="tabpanel" aria-labelledby={`analytics-tab-${activeTab}`}>
                {activeTab === 'overview' && <OverviewTab data={data} t={t} />}
                {activeTab === 'geo' && <GeoTab data={data} t={t} />}
                {activeTab === 'tech' && <TechTab data={data} t={t} />}
                {activeTab === 'live' && <LiveTab visitors={live} onRefresh={fetchLive} t={t} />}
                {activeTab === 'network' && <NetworkTab data={data} t={t} />}
            </div>

            {/* ── Footer ── */}
            <footer className="mt-10 pt-5 border-t-2 border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="a-help">{t('footer')}</p>
                <a
                    href="https://analytics.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="a-btn a-btn--ghost a-btn--sm self-start sm:self-auto"
                >
                    {t('open_ga')}
                    <ArrowTopRightOnSquareIcon className="w-4 h-4" aria-hidden />
                </a>
            </footer>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────────

// `phase` goes 0→4 during the minimum boot time (~2.5s); it's drawn as
// progress so the wait doesn't look stuck.
function LoadingState({ t }) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="a-spinner" role="status" aria-label={t('loading')} />
            <p className="text-sm text-white/55">{t('loading')}</p>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// SHARED PIECES
// ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, trend, icon }) {
    const hasTrend = trend !== undefined
    const subColor = hasTrend ? (trend >= 0 ? 'text-green-300' : 'text-red-300') : 'text-white/45'

    return (
        <div className="a-card p-4 sm:p-5 min-w-0">
            <div className="flex items-center gap-2 text-white/50">
                {icon}
                <span className="text-[0.8125rem] font-semibold leading-tight text-white/70">{label}</span>
            </div>
            <p className="mt-3 text-2xl sm:text-3xl font-bold leading-none text-white a-num">
                {value}
            </p>
            {sub && (
                <p className={`mt-2 text-xs flex items-center gap-1 ${subColor}`}>
                    {hasTrend && (
                        trend >= 0
                            ? <ArrowTrendingUpIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                            : <ArrowTrendingDownIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">{sub}</span>
                </p>
            )}
        </div>
    )
}

function Panel({ title, icon: Icon, actions, children, className = '' }) {
    return (
        <section className={`a-card p-5 sm:p-6 min-w-0 ${className}`}>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-5">
                <h2 className="a-section-title flex items-center gap-2 min-w-0">
                    {Icon && <Icon className="w-[1.125rem] h-[1.125rem] text-white/50 shrink-0" aria-hidden />}
                    {title}
                </h2>
                {actions}
            </div>
            {children}
        </section>
    )
}

function Empty({ children }) {
    return <p className="a-empty py-8 text-sm">{children}</p>
}

// Label and value on top, full-width bar underneath: fits 375px without
// squeezing the bar between fixed-width columns.
function BarRow({ label, value, detail, pct, color = ACCENT, leading }) {
    const width = Math.max(Math.min(Number(pct) || 0, 100), 0)
    return (
        <li className="min-w-0">
            <div className="flex items-baseline gap-3 text-sm">
                {leading}
                <span className="flex-1 min-w-0 truncate text-white/80">{label}</span>
                <span className="shrink-0 font-semibold text-white a-num">{value}</span>
                {detail != null && <span className="shrink-0 a-meta">{detail}</span>}
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
            </div>
        </li>
    )
}

// ─────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────

function OverviewTab({ data, t }) {
    if (!data) return null

    const maxReferrer = Math.max(...(data.referrers || []).map(r => parseInt(r.total) || 0), 1)

    return (
        <div className="space-y-6">
            {/* Section Dwell Times — top of overview */}
            {data.section_times?.length > 0 && (
                <Panel title={t('panel_dwell')} icon={ClockIcon}>
                    <SectionDwellChart sections={data.section_times} t={t} />
                </Panel>
            )}

            <Panel title={t('panel_traffic')} icon={ChartBarIcon}>
                <TrafficChart daily={data.daily || []} />
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title={t('panel_hourly')} icon={ClockIcon}>
                    <HourlyHeatmap hourly={data.hourly || []} />
                </Panel>

                <Panel title={t('panel_pages')} icon={EyeIcon}>
                    <TopPages pages={data.pages || []} />
                </Panel>
            </div>

            {data.referrers?.length > 0 && (
                <Panel title={t('panel_referrers')} icon={SignalIcon}>
                    <ul className="space-y-3">
                        {data.referrers.map((r, i) => (
                            <BarRow
                                key={i}
                                label={<span className="a-code">{r.referrer}</span>}
                                value={fmt(r.total)}
                                pct={((parseInt(r.total) || 0) / maxReferrer) * 100}
                            />
                        ))}
                    </ul>
                </Panel>
            )}
        </div>
    )
}

// ── Section Dwell Time — radial chart ──
function SectionDwellChart({ sections, t }) {
    const [animated, setAnimated] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 200)
        return () => clearTimeout(timer)
    }, [])

    if (!sections.length) {
        return <Empty>{t('empty_dwell')}</Empty>
    }

    // Same colors as each section's portal on the site
    const sectionMeta = {
        'home': { label: 'Home', color: NEUTRAL },
        'work': { label: 'Work', color: PALETTE.cyan },
        'about': { label: 'About', color: PALETTE.green },
        'store': { label: 'Store', color: PALETTE.magenta },
        'contact': { label: 'Contact', color: PALETTE.yellow },
        'blog': { label: 'Blog', color: PALETTE.orange },
        'section1': { label: 'Work', color: PALETTE.cyan },
        'section2': { label: 'About', color: PALETTE.green },
        'section3': { label: 'Store', color: PALETTE.magenta },
        'section4': { label: 'Contact', color: PALETTE.yellow },
        'section5': { label: 'Blog', color: PALETTE.orange },
    }
    const metaFor = (section) => sectionMeta[section] || {
        label: section ? section.charAt(0).toUpperCase() + section.slice(1) : '—',
        color: NEUTRAL,
    }

    const maxAvg = Math.max(...sections.map(s => parseFloat(s.avg_seconds) || 0), 1)
    const totalEngagement = sections.reduce((a, s) => a + parseFloat(s.total_seconds || 0), 0)

    const formatTime = (s) => {
        const sec = parseFloat(s) || 0
        if (sec < 60) return `${sec.toFixed(1)}s`
        const m = Math.floor(sec / 60)
        const r = Math.round(sec % 60)
        return `${m}m ${r}s`
    }

    // SVG config
    const size = 280
    const cx = size / 2
    const cy = size / 2
    const ringWidth = 14
    const ringGap = 6
    const startRadius = 38

    // Sort by avg_seconds descending (biggest ring = innermost for visual impact)
    const sorted = [...sections].sort((a, b) => (parseFloat(b.avg_seconds) || 0) - (parseFloat(a.avg_seconds) || 0))

    return (
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
            {/* Radial chart */}
            <div className="w-full max-w-[280px] shrink-0">
                <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="w-full h-auto"
                    role="img"
                    aria-label={`${t('engagement')}: ${formatTime(totalEngagement)}`}
                >
                    {/* Background rings (track) */}
                    {sorted.map((s, i) => {
                        const r = startRadius + i * (ringWidth + ringGap)
                        return (
                            <circle
                                key={`bg-${s.section}`}
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                stroke="rgba(255, 255, 255, 0.06)"
                                strokeWidth={ringWidth}
                            />
                        )
                    })}

                    {/* Tick marks on rings */}
                    {sorted.map((s, i) => {
                        const r = startRadius + i * (ringWidth + ringGap)
                        return [0, 90, 180, 270].map((angle) => {
                            const rad = (angle - 90) * Math.PI / 180
                            const innerR = r - ringWidth / 2
                            const outerR = r + ringWidth / 2
                            return (
                                <line
                                    key={`tick-${s.section}-${angle}`}
                                    x1={cx + innerR * Math.cos(rad)}
                                    y1={cy + innerR * Math.sin(rad)}
                                    x2={cx + outerR * Math.cos(rad)}
                                    y2={cy + outerR * Math.sin(rad)}
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth="1"
                                />
                            )
                        })
                    })}

                    {/* Active arcs */}
                    {sorted.map((s, i) => {
                        const meta = metaFor(s.section)
                        const r = startRadius + i * (ringWidth + ringGap)
                        const pct = Math.max(0.03, (parseFloat(s.avg_seconds) || 0) / maxAvg)
                        const circumference = 2 * Math.PI * r
                        const arcLength = circumference * pct

                        return (
                            <circle
                                key={`arc-${s.section}`}
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                stroke={meta.color}
                                strokeWidth={ringWidth - 2}
                                strokeLinecap="round"
                                strokeDasharray={`${arcLength} ${circumference}`}
                                strokeDashoffset={animated ? 0 : circumference}
                                opacity={animated ? 1 : 0}
                                transform={`rotate(-90 ${cx} ${cy})`}
                                style={{
                                    transition: `stroke-dashoffset 1.5s var(--ease-expo-out) ${i * 150}ms, opacity 0.3s ease ${i * 150}ms`,
                                }}
                            />
                        )
                    })}

                    {/* Center text */}
                    <text x={cx} y={cy - 5} textAnchor="middle" fill="rgba(255, 255, 255, 0.45)" fontSize="9" fontWeight="600">
                        {t('engagement')}
                    </text>
                    <text x={cx} y={cy + 11} textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="700">
                        {formatTime(totalEngagement)}
                    </text>
                </svg>
            </div>

            {/* Legend + stats */}
            <div className="flex-1 w-full min-w-0">
                <ul className="space-y-3" aria-label={t('breakdown')}>
                    {sorted.map((s, i) => {
                        const meta = metaFor(s.section)
                        const pct = Math.round(((parseFloat(s.avg_seconds) || 0) / maxAvg) * 100)

                        return (
                            <li
                                key={s.section}
                                className="min-w-0"
                                style={{
                                    opacity: animated ? 1 : 0,
                                    transform: animated ? 'translateX(0)' : 'translateX(-10px)',
                                    transition: `all 0.5s var(--ease-expo-out) ${200 + i * 100}ms`,
                                }}
                            >
                                <div className="flex items-baseline gap-3 text-sm">
                                    <span className="a-dot self-center" style={{ backgroundColor: meta.color }} aria-hidden />
                                    <span className="flex-1 min-w-0 truncate font-semibold text-white/80">{meta.label}</span>
                                    <span className="shrink-0 font-semibold text-white a-num">{formatTime(s.avg_seconds)}</span>
                                    <span className="shrink-0 a-meta">
                                        {fmt(s.visits)} {parseInt(s.visits) === 1 ? t('visit_one') : t('visit_many')}
                                    </span>
                                </div>
                                <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{
                                            width: animated ? `${Math.max(pct, 4)}%` : '0%',
                                            backgroundColor: meta.color,
                                            transition: `width 1.2s var(--ease-expo-out) ${300 + i * 100}ms`,
                                        }}
                                    />
                                </div>
                            </li>
                        )
                    })}
                </ul>

                <p className="mt-4 pt-3 border-t-2 border-white/10 a-meta">
                    {sections.length} {t('sections_label')} · {fmt(sections.reduce((a, s) => a + parseInt(s.visits || 0), 0))} {t('samples_label')}
                </p>
            </div>
        </div>
    )
}

// ── Traffic Chart (daily bars) ──
function TrafficChart({ daily }) {
    const { t } = useAnalyticsLang()

    if (!daily.length) {
        return <Empty>{t('empty_period')}</Empty>
    }

    const maxViews = Math.max(...daily.map(d => d.views), 1)

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-2 a-kicker">
                <span>{t('th_date')}</span>
                <span>{t('th_views_uniques')}</span>
            </div>

            <ul>
                {daily.map((d, i) => {
                    const pct = (d.views / maxViews) * 100
                    const date = new Date(d.date)
                    const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                    const monthDay = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                    const isToday = new Date().toDateString() === date.toDateString()

                    return (
                        <li key={i} className="flex items-center gap-3 py-1 min-h-[28px]">
                            <span className={`w-20 shrink-0 text-right text-xs a-num ${isToday ? 'font-bold text-white' : 'text-white/55'}`}>
                                {dayName} {monthDay}
                            </span>
                            <div className="flex-1 h-3 rounded-full bg-white/[0.04] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-[width] duration-500 ease-expo-out"
                                    style={{
                                        width: `${Math.max(pct, 2)}%`,
                                        background: isToday ? ACCENT : accentAlpha(0.55),
                                    }}
                                />
                            </div>
                            <span className="w-20 shrink-0 text-right text-xs a-num">
                                <span className="font-semibold text-white">{fmt(d.views)}</span>
                                <span className="text-white/45"> / {fmt(d.uniques)}</span>
                            </span>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

// ── Hourly Activity Histogram ──
function HourlyHeatmap({ hourly }) {
    const { t } = useAnalyticsLang()
    const [hovered, setHovered] = useState(null)

    // Build 24-hour array from API data
    const hours = Array.from({ length: 24 }, (_, i) => {
        const match = hourly.find(h => parseInt(h.hour) === i)
        return { hour: i, total: match ? parseInt(match.total) : 0 }
    })

    const maxHour = Math.max(...hours.map(h => h.total), 1)
    const totalVisits = hours.reduce((sum, h) => sum + h.total, 0)
    const currentHour = new Date().getHours()

    // Find peak and quiet hours
    const peakHour = hours.reduce((best, h) => h.total > best.total ? h : best, hours[0])
    const quietHours = hours.filter(h => h.total === 0).length

    // Bar height calculation (max 80px)
    const BAR_MAX_HEIGHT = 80

    const hh = (n) => n.toString().padStart(2, '0')

    return (
        <div>
            {/* Histogram container */}
            <div className="relative">
                {/* Y-axis scale lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ bottom: '24px' }}>
                    {[1, 0.5, 0].map((level) => (
                        <div key={level} className="flex items-center gap-2">
                            <span className="text-[9px] a-num text-white/40 w-6 text-right shrink-0">
                                {Math.round(maxHour * level)}
                            </span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>
                    ))}
                </div>

                {/* Bars */}
                <div
                    className="flex items-end gap-px pl-8"
                    style={{ height: `${BAR_MAX_HEIGHT + 24}px` }}
                >
                    {hours.map((h) => {
                        const intensity = h.total / maxHour
                        const barHeight = h.total > 0
                            ? Math.max(intensity * BAR_MAX_HEIGHT, 4)
                            : 2
                        const isNow = h.hour === currentHour
                        const isPeak = h.hour === peakHour.hour && peakHour.total > 0
                        const isHovered = hovered === h.hour

                        // Single-hue sequential scale: more visits = more opaque magenta
                        const fill = h.total > 0
                            ? accentAlpha(isHovered ? 1 : 0.25 + intensity * 0.75)
                            : `rgba(255, 255, 255, ${isHovered ? 0.2 : 0.08})`

                        return (
                            <div
                                key={h.hour}
                                className="flex-1 flex flex-col items-center"
                                onMouseEnter={() => setHovered(h.hour)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                {/* Tooltip on hover */}
                                {isHovered && (
                                    <div
                                        className="a-inset absolute z-10 px-2.5 py-1.5 text-center pointer-events-none whitespace-nowrap"
                                        style={{ bottom: `${barHeight + 30}px` }}
                                    >
                                        <div className="text-xs font-bold text-white a-num">
                                            {hh(h.hour)}:00
                                        </div>
                                        <div className="text-[11px] text-white/70">
                                            {h.total} {h.total === 1 ? t('visit_one') : t('visit_many')}
                                        </div>
                                        {totalVisits > 0 && (
                                            <div className="text-[10px] text-white/45 a-num">
                                                {((h.total / totalVisits) * 100).toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bar */}
                                <div
                                    className="w-full rounded-t-[3px] relative cursor-default transition-colors duration-150"
                                    style={{ height: `${barHeight}px`, background: fill }}
                                >
                                    {isPeak && (
                                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                </div>

                                {/* Hour label — every 3h on mobile so they don't collide;
                                    `invisible` (not `hidden`) keeps bar baselines aligned */}
                                <div className={`w-full text-center pt-1 ${isNow ? 'border-t-2 border-section-quests' : 'border-t border-white/10'}`}>
                                    <span
                                        className={`text-[9px] a-num ${isNow ? 'font-bold text-white' : 'text-white/40'} ${h.hour % 3 !== 0 && !isNow ? 'invisible sm:visible' : ''}`}
                                    >
                                        {hh(h.hour)}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* "Now" label */}
                <div
                    className="absolute text-[9px] font-bold text-section-quests"
                    style={{
                        bottom: '-14px',
                        left: `calc(2rem + (100% - 2rem) * ${(currentHour + 0.5) / 24})`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    {t('now')}
                </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-6 pt-3 border-t-2 border-white/10 text-xs text-white/45">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                        {t('total')} <span className="font-semibold text-white a-num">{fmt(totalVisits)}</span>
                    </span>
                    {peakHour.total > 0 && (
                        <span>
                            {t('peak')} <span className="font-semibold text-white a-num">{hh(peakHour.hour)}:00</span>
                            <span className="a-num ml-1">({peakHour.total})</span>
                        </span>
                    )}
                </div>
                {quietHours > 0 && <span>{quietHours} {t('quiet')}</span>}
            </div>
        </div>
    )
}

// ── Top Pages ──
function TopPages({ pages }) {
    const { t } = useAnalyticsLang()

    if (!pages.length) {
        return <Empty>{t('empty_pages')}</Empty>
    }

    const maxViews = Math.max(...pages.map(p => p.views), 1)

    return (
        <ol className="space-y-3">
            {pages.slice(0, 10).map((p, i) => (
                <BarRow
                    key={i}
                    leading={<span className="w-5 shrink-0 text-right a-meta">{i + 1}</span>}
                    label={<span className="a-code">{p.page_url}</span>}
                    value={fmt(p.views)}
                    detail={`${fmt(p.uniques)} ${t('unique')}`}
                    pct={(p.views / maxViews) * 100}
                />
            ))}
        </ol>
    )
}

// ─────────────────────────────────────────────────────────────────
// GEO TAB
// ─────────────────────────────────────────────────────────────────

function GeoTab({ data, t }) {
    if (!data) return null

    return (
        <div className="space-y-6">
            <TerminalWorldMap points={data.map_points || []} />

            <Panel title={t('panel_countries')} icon={GlobeAltIcon}>
                {data.countries?.length > 0 ? (
                    <ul className="space-y-3">
                        {data.countries.map((c, i) => (
                            <BarRow
                                key={i}
                                leading={<span className="w-5 shrink-0 text-center text-base leading-none" aria-hidden>{countryFlag(c.country_code)}</span>}
                                label={c.country}
                                value={`${c.pct}%`}
                                detail={fmt(c.total)}
                                pct={parseFloat(c.pct)}
                            />
                        ))}
                    </ul>
                ) : (
                    <Empty>{t('empty_geo')}</Empty>
                )}
            </Panel>

            <Panel title={t('panel_top_ips')} icon={MapPinIcon}>
                {data.top_ips?.length > 0 ? (
                    <div className="-mx-3 overflow-x-auto a-scroll">
                        <table className="a-table a-table--hover">
                            <thead>
                                <tr>
                                    <th className="text-right">#</th>
                                    <th>{t('th_ip')}</th>
                                    <th className="text-right">{t('th_visits')}</th>
                                    <th>{t('th_location')}</th>
                                    <th>{t('th_browser')}</th>
                                    <th>{t('th_os')}</th>
                                    <th>{t('th_last_seen')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.top_ips.map((ip, i) => (
                                    <tr key={i}>
                                        <td className="text-right a-meta">{i + 1}</td>
                                        <td className="whitespace-nowrap">
                                            <span className="a-code text-white">{ip.ip_address}</span>
                                        </td>
                                        <td className="text-right font-semibold text-white a-num">{fmt(ip.visits)}</td>
                                        <td className="whitespace-nowrap">
                                            {ip.city && ip.country ? `${ip.city}, ${ip.country}` : ip.country || '—'}
                                        </td>
                                        <td className="whitespace-nowrap">{ip.browser || '—'}</td>
                                        <td className="whitespace-nowrap">{ip.os || '—'}</td>
                                        <td className="whitespace-nowrap a-meta">{timeAgo(ip.last_visit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <Empty>{t('empty_ips')}</Empty>
                )}
            </Panel>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// TECH TAB (Browsers, OS, Devices, Screens)
// ─────────────────────────────────────────────────────────────────

function TechTab({ data, t }) {
    if (!data) return null

    const maxIsp = Math.max(...(data.isps || []).map(i => parseInt(i.total) || 0), 1)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title={t('panel_browsers')} icon={CpuChipIcon}>
                    <BrowserList browsers={data.browsers || []} />
                </Panel>

                <Panel title={t('panel_os')} icon={ComputerDesktopIcon}>
                    <OsList oses={data.oses || []} />
                </Panel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Panel title={t('panel_devices')} icon={DevicePhoneMobileIcon}>
                    <DeviceMatrix devices={data.devices || []} />
                </Panel>

                <Panel title={t('panel_screens')} icon={ComputerDesktopIcon}>
                    <ScreenList screens={data.screens || []} />
                </Panel>
            </div>

            {data.isps?.length > 0 && (
                <Panel title={t('panel_isps')} icon={WifiIcon}>
                    <ol className="space-y-3">
                        {data.isps.map((isp, i) => (
                            <BarRow
                                key={i}
                                leading={<span className="w-5 shrink-0 text-right a-meta">{i + 1}</span>}
                                label={isp.isp}
                                value={fmt(isp.total)}
                                detail={t('isp_unit')}
                                pct={((parseInt(isp.total) || 0) / maxIsp) * 100}
                            />
                        ))}
                    </ol>
                </Panel>
            )}
        </div>
    )
}

// ── Browser list ──
function BrowserList({ browsers }) {
    const { t } = useAnalyticsLang()

    if (!browsers.length) {
        return <Empty>{t('empty_browsers')}</Empty>
    }

    return (
        <ul className="space-y-3">
            {browsers.map((b, i) => (
                <BarRow
                    key={i}
                    label={b.browser}
                    value={`${b.pct}%`}
                    detail={fmt(b.total)}
                    pct={parseFloat(b.pct)}
                />
            ))}
        </ul>
    )
}

// ── OS List ──
function OsList({ oses }) {
    const { t } = useAnalyticsLang()

    if (!oses.length) {
        return <Empty>{t('empty_os')}</Empty>
    }

    return (
        <ul className="space-y-3">
            {oses.map((o, i) => (
                <BarRow
                    key={i}
                    label={o.os}
                    value={`${o.pct}%`}
                    detail={fmt(o.total)}
                    pct={parseFloat(o.pct)}
                />
            ))}
        </ul>
    )
}

// ── Device Matrix ──
const DEVICE_COLORS = {
    desktop: PALETTE.magenta,
    mobile: PALETTE.cyan,
    tablet: PALETTE.green,
    bot: PALETTE.orange,
}

function DeviceMatrix({ devices }) {
    const { t } = useAnalyticsLang()

    if (!devices.length) {
        return <Empty>{t('empty_devices')}</Empty>
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            {devices.map((d, i) => {
                const color = DEVICE_COLORS[d.device_type] || DEVICE_COLORS.desktop
                return (
                    <div key={i} className="a-inset p-4 min-w-0">
                        <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-white/70">
                            <span className="shrink-0" style={{ color }}>
                                <DeviceIcon type={d.device_type} />
                            </span>
                            <span className="truncate">{deviceLabel(t, d.device_type)}</span>
                        </div>
                        <p className="mt-2 text-2xl font-bold leading-none text-white a-num">
                            {d.pct}%
                        </p>
                        <p className="mt-1.5 a-meta">
                            {fmt(d.total)} {t('visit_many')}
                        </p>
                        <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${parseFloat(d.pct) || 0}%`, background: color }} />
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Screen Resolutions ──
function ScreenList({ screens }) {
    const { t } = useAnalyticsLang()

    if (!screens.length) {
        return <Empty>{t('empty_screens')}</Empty>
    }

    const max = Math.max(...screens.map(s => s.total), 1)

    return (
        <ul className="space-y-3">
            {screens.map((s, i) => (
                <BarRow
                    key={i}
                    label={<span className="a-num">{s.resolution}</span>}
                    value={fmt(s.total)}
                    pct={(s.total / max) * 100}
                />
            ))}
        </ul>
    )
}

// ─────────────────────────────────────────────────────────────────
// LIVE FEED TAB
// ─────────────────────────────────────────────────────────────────

function LiveTab({ visitors, onRefresh, t }) {
    return (
        <Panel
            title={t('panel_live')}
            icon={SignalIcon}
            actions={
                <div className="flex items-center gap-2">
                    <span className="a-badge a-badge--success">
                        <span className="a-dot bg-green-400" aria-hidden />
                        {t('live_status')}
                    </span>
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="a-icon-btn a-icon-btn--sm"
                        aria-label={t('refresh')}
                        title={t('refresh')}
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                </div>
            }
        >
            {visitors.length === 0 ? (
                <Empty>{t('empty_live')}</Empty>
            ) : (
                <div className="-mx-3 overflow-x-auto max-h-[600px] overflow-y-auto a-scroll">
                    <table className="a-table a-table--hover [&_td]:py-2" style={{ minWidth: '700px' }}>
                        <thead>
                            <tr>
                                <th>{t('th_time')}</th>
                                <th>{t('th_ip')}</th>
                                <th><span className="sr-only">{t('th_country')}</span></th>
                                <th>{t('th_location')}</th>
                                <th>{t('th_agent')}</th>
                                <th><span className="sr-only">{t('th_device')}</span></th>
                                <th>{t('th_page')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visitors.map((v, i) => (
                                <tr key={i}>
                                    <td className="whitespace-nowrap a-meta">
                                        {new Date(v.visited_at).toLocaleTimeString('en', { hour12: false })}
                                    </td>
                                    <td className="whitespace-nowrap" style={{ maxWidth: '160px' }}>
                                        <span className="block truncate a-code text-white">{v.ip_address}</span>
                                    </td>
                                    <td className="whitespace-nowrap text-center" title={v.country || undefined}>
                                        {countryFlag(v.country_code)}
                                    </td>
                                    <td className="whitespace-nowrap" style={{ maxWidth: '140px' }}>
                                        <span className="block truncate">{v.city ? `${v.city}, ${v.country}` : v.country || '—'}</span>
                                    </td>
                                    <td className="whitespace-nowrap text-white/55" style={{ maxWidth: '120px' }}>
                                        <span className="block truncate">{v.browser}/{v.os}</span>
                                    </td>
                                    <td className="whitespace-nowrap text-white/55" title={deviceLabel(t, v.device_type)}>
                                        <DeviceIcon type={v.device_type} />
                                        <span className="sr-only">{deviceLabel(t, v.device_type)}</span>
                                    </td>
                                    <td style={{ maxWidth: '200px' }}>
                                        <span className="block truncate a-code">{v.page_url}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    )
}

// ─────────────────────────────────────────────────────────────────
// VISIT LOG TAB
// ─────────────────────────────────────────────────────────────────

function PrefIcon({ Icon, label }) {
    return (
        <span className="inline-flex" title={label}>
            <Icon className="w-4 h-4" aria-hidden />
            <span className="sr-only">{label}</span>
        </span>
    )
}

function NetworkTab({ data, t }) {
    const [visitors, setVisitors] = useState([])
    const [page, setPage] = useState(1)
    const [meta, setMeta] = useState({ total: 0, pages: 0 })
    const [loading, setLoading] = useState(true)

    const fetchVisitors = useCallback(async (p = 1) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/analytics.php?action=visitors&page=${p}&limit=25`, {
                credentials: 'include',
            })
            const json = await res.json()
            if (json.ok) {
                setVisitors(json.visitors || [])
                setMeta({ total: json.total, pages: json.pages })
                setPage(json.page)
            }
        } catch { }
        setLoading(false)
    }, [])

    useEffect(() => { fetchVisitors(1) }, [fetchVisitors])

    return (
        <Panel
            title={t('panel_log')}
            icon={QueueListIcon}
            actions={<span className="a-meta">{fmt(meta.total)} {t('entries')}</span>}
        >
            {loading ? (
                <div className="flex items-center justify-center gap-3 py-10" role="status">
                    <div className="a-spinner a-spinner--sm" aria-hidden />
                    <span className="text-sm text-white/55">{t('querying')}</span>
                </div>
            ) : visitors.length === 0 ? (
                <Empty>{t('empty_log')}</Empty>
            ) : (
                <>
                    <div className="-mx-3 overflow-x-auto max-h-[500px] overflow-y-auto a-scroll">
                        <table className="a-table a-table--hover whitespace-nowrap [&_td]:py-2">
                            <thead className="sticky top-0 z-[1] [&_th]:bg-[var(--a-surface)]">
                                <tr>
                                    <th>{t('th_time')}</th>
                                    <th>{t('th_ip')}</th>
                                    <th>{t('th_location')}</th>
                                    <th>{t('th_agent')}</th>
                                    <th>{t('th_device')}</th>
                                    <th>{t('th_page')}</th>
                                    <th>{t('th_lang')}</th>
                                    <th>{t('th_prefs')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visitors.map((v) => (
                                    <tr key={v.id}>
                                        <td className="a-meta">
                                            {new Date(v.visited_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </td>
                                        <td>
                                            <span className="a-code text-white">{v.ip_address}</span>
                                        </td>
                                        <td>
                                            <div className="text-white/80">{v.city ? `${v.city}, ${v.country}` : v.country || '—'}</div>
                                            {v.isp && <div className="a-meta truncate max-w-[180px]">{v.isp}</div>}
                                        </td>
                                        <td>
                                            {v.browser}
                                            <span className="text-white/30 mx-1">/</span>
                                            {v.os}
                                        </td>
                                        <td>
                                            <span className={v.device_type === 'bot' ? 'text-red-300' : ''}>
                                                {deviceLabel(t, v.device_type)}
                                            </span>
                                            {v.screen_width > 0 && (
                                                <span className="a-meta ml-1.5">{v.screen_width}×{v.screen_height}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="block truncate max-w-[160px] a-code">{v.page_url}</span>
                                        </td>
                                        <td className="a-meta">{v.language || '—'}</td>
                                        <td>
                                            <span className="inline-flex items-center gap-2 text-white/55">
                                                {v.is_dark_mode
                                                    ? <PrefIcon Icon={MoonIcon} label={t('dark_mode')} />
                                                    : <PrefIcon Icon={SunIcon} label={t('light_mode')} />}
                                                {v.is_touch
                                                    ? <PrefIcon Icon={HandRaisedIcon} label={t('touch')} />
                                                    : <PrefIcon Icon={CursorArrowRaysIcon} label={t('mouse')} />}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta.pages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t-2 border-white/10">
                            <span className="a-meta">
                                {t('page')} {page} {t('of')} {meta.pages} · {fmt(meta.total)} {t('entries')}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchVisitors(page - 1)}
                                    disabled={page <= 1}
                                    className="a-btn a-btn--secondary a-btn--sm"
                                >
                                    <ChevronLeftIcon className="w-4 h-4" aria-hidden />
                                    {t('prev')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fetchVisitors(page + 1)}
                                    disabled={page >= meta.pages}
                                    className="a-btn a-btn--secondary a-btn--sm"
                                >
                                    {t('next')}
                                    <ChevronRightIcon className="w-4 h-4" aria-hidden />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Panel>
    )
}
