/**
 * Analytics Dashboard — M.A.D.R.E. Terminal Monitor
 *
 * A full analytics dashboard styled as a retro terminal system monitor.
 * Displays visitor data, traffic charts, geo scan, browser processes,
 * and raw IP logs — all in the CRT terminal aesthetic.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import TerminalWorldMap from './TerminalWorldMap'
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
    CommandLineIcon,
    MapPinIcon,
    CpuChipIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    ArrowDownTrayIcon,
} from '@heroicons/react/24/solid'

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

// ── Utility: ASCII bar ──
const asciiBar = (pct, width = 20) => {
    const filled = Math.round((pct / 100) * width)
    return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ── Device icon component ──
const DeviceIcon = ({ type }) => {
    switch (type) {
        case 'mobile': return <DevicePhoneMobileIcon className="w-3.5 h-3.5" />
        case 'tablet': return <DeviceTabletIcon className="w-3.5 h-3.5" />
        case 'bot': return <CpuChipIcon className="w-3.5 h-3.5" />
        default: return <ComputerDesktopIcon className="w-3.5 h-3.5" />
    }
}

// ── Country flag emoji from country code ──
const countryFlag = (code) => {
    if (!code || code.length !== 2) return '🌐'
    const c = code.toUpperCase()
    return String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState(null)
    const [live, setLive] = useState([])
    const [initialLoad, setInitialLoad] = useState(true) // first-time boot only
    const [refreshing, setRefreshing] = useState(false)  // period change overlay
    const [error, setError] = useState(null)
    const [period, setPeriod] = useState('7d')
    const [activeTab, setActiveTab] = useState('overview')
    const [bootPhase, setBootPhase] = useState(0)
    const liveRef = useRef(null)
    const dataReadyRef = useRef(false)
    const bootDoneRef = useRef(false)

    // Dismiss boot only when BOTH data is loaded AND animation finished
    const tryDismissBoot = useCallback(() => {
        if (dataReadyRef.current && bootDoneRef.current) {
            setInitialLoad(false)
        }
    }, [])

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
            dataReadyRef.current = true
            tryDismissBoot()
            setRefreshing(false)
        }
    }, [period, tryDismissBoot])

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

    // ── Boot animation (min ~2.5s total) ──
    useEffect(() => {
        const phases = [0, 1, 2, 3, 4]
        let i = 0
        const timer = setInterval(() => {
            i++
            if (i < phases.length) {
                setBootPhase(i)
            } else {
                clearInterval(timer)
                // Small extra pause after last phase before dismissing
                setTimeout(() => {
                    bootDoneRef.current = true
                    tryDismissBoot()
                }, 500)
            }
        }, 400) // 400ms per phase × 5 = 2s + 500ms final = 2.5s minimum
        return () => clearInterval(timer)
    }, [tryDismissBoot])

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
            <div className="max-w-7xl mx-auto px-4 py-8">
                <TerminalBoot phase={bootPhase} />
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="text-center py-20">
                    <p className="text-red-400 mb-4 text-sm admin-terminal-font">
                        <span className="opacity-60">&gt; </span>ERROR: {error}
                    </p>
                    <button
                        onClick={() => { setInitialLoad(true); fetchData() }}
                        className="text-blue-400 hover:text-blue-300 text-sm admin-terminal-font transition-colors"
                    >
                        &gt; retry()
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 admin-fade-in relative">
            {/* Refreshing overlay (subtle, no boot animation) */}
            {refreshing && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded" style={{ background: 'rgba(10, 15, 10, 0.7)', backdropFilter: 'blur(2px)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-cyan-400/70 text-xs admin-terminal-font">&gt; refreshing_data_stream...</span>
                    </div>
                </div>
            )}
            {/* """ HEADER """ */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="admin-section-title text-lg flex items-center gap-2">
                        <SignalIcon className="w-5 h-5 text-cyan-400" />
                        M.A.D.R.E. analytics_monitor
                    </h1>
                    <p className="text-blue-600/40 text-xs mt-1 admin-terminal-font">
            // monitoring mausoleum network traffic — v2.1.0
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Period selector */}
                    {['7d', '30d', '90d'].map((p) => (
                        <button
                            key={p}
                            onClick={() => { if (p !== period) { setPeriod(p); setRefreshing(true) } }}
                            className={`px-3 py-1.5 rounded text-xs admin-terminal-font transition-all ${period === p
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : 'text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent'
                                }`}
                        >
                            {p}
                        </button>
                    ))}
                    {/* Export CSV */}
                    <button
                        onClick={() => {
                            window.open('/api/analytics.php?action=export', '_blank')
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs admin-terminal-font text-blue-600 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent transition-all"
                        title="Export CSV"
                    >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        export
                    </button>
                    {/* Refresh */}
                    <button
                        onClick={() => { fetchData(); fetchLive() }}
                        className="p-1.5 rounded hover:bg-blue-500/10 text-blue-600 hover:text-blue-400 transition-colors"
                        title="Refresh"
                    >
                        <ArrowPathIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* """ ONLINE NOW INDICATOR """ */}
            {data?.online_now > 0 && (
                <div className="mb-6 flex items-center gap-2 text-xs admin-terminal-font">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                    </span>
                    <span className="text-green-400">
                        {data.online_now} active connection{data.online_now > 1 ? 's' : ''} detected
                    </span>
                </div>
            )}

            {/* """ KPI CARDS """ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <KpiCard
                    label="today_scans"
                    value={fmt(data?.today?.views)}
                    sub={`${todayVsYesterday >= 0 ? '+' : ''}${todayVsYesterday}% vs yesterday`}
                    trend={todayVsYesterday}
                    icon={<EyeIcon className="w-4 h-4" />}
                />
                <KpiCard
                    label="unique_signals"
                    value={fmt(data?.today?.unique_ips)}
                    sub="distinct IPs today"
                    icon={<UserGroupIcon className="w-4 h-4" />}
                />
                <KpiCard
                    label="total_archive"
                    value={fmt(data?.all_time?.views)}
                    sub={`${fmt(data?.all_time?.unique_ips)} unique IPs`}
                    icon={<ServerIcon className="w-4 h-4" />}
                />
                <KpiCard
                    label="week_traffic"
                    value={fmt(data?.this_week)}
                    sub={`${weekVsWeek >= 0 ? '+' : ''}${weekVsWeek}% vs last week`}
                    trend={weekVsWeek}
                    icon={<ChartBarIcon className="w-4 h-4" />}
                />
            </div>

            {/* """ TAB NAVIGATION """ */}
            <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" style={{ borderBottom: '1px solid rgba(59, 130, 246, 0.15)' }}>
                {[
                    { id: 'overview', label: 'overview', icon: <ChartBarIcon className="w-3.5 h-3.5" /> },
                    { id: 'geo', label: 'geo_scan', icon: <GlobeAltIcon className="w-3.5 h-3.5" /> },
                    { id: 'tech', label: 'sys_processes', icon: <CpuChipIcon className="w-3.5 h-3.5" /> },
                    { id: 'live', label: 'live_feed', icon: <CommandLineIcon className="w-3.5 h-3.5" /> },
                    { id: 'network', label: 'network_log', icon: <WifiIcon className="w-3.5 h-3.5" /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs admin-terminal-font transition-all whitespace-nowrap ${activeTab === tab.id
                            ? 'text-cyan-400 border-b-2 border-cyan-400'
                            : 'text-blue-600 hover:text-blue-400'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* """ TAB CONTENT """ */}
            {activeTab === 'overview' && <OverviewTab data={data} />}
            {activeTab === 'geo' && <GeoTab data={data} />}
            {activeTab === 'tech' && <TechTab data={data} />}
            {activeTab === 'live' && <LiveTab visitors={live} onRefresh={fetchLive} />}
            {activeTab === 'network' && <NetworkTab data={data} />}

            {/* """ FOOTER """ */}
            <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.1)' }}>
                <p className="text-blue-600/30 text-xs admin-terminal-font">
          // M.A.D.R.E. analytics_monitor v2.1.0 — tracking since boot
                </p>
                <a
                    href="https://analytics.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600/40 hover:text-blue-400 text-xs admin-terminal-font mt-1 transition-colors"
                >
                    &gt; open_google_analytics_console
                </a>
            </div>
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// BOOT ANIMATION
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function TerminalBoot({ phase }) {
    const lines = [
        '> BOOTING M.A.D.R.E. ANALYTICS MODULE...',
        '> CONNECTING TO MAUSOLEUM DATA STREAMS...',
        '> INITIALIZING NETWORK SCANNERS...',
        '> DECRYPTING VISITOR SIGNALS...',
        '> RENDERING TERMINAL DISPLAY...',
    ]

    return (
        <div className="py-20 max-w-lg mx-auto">
            <div
                className="rounded p-6"
                style={{
                    background: 'rgba(0, 10, 30, 0.6)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    boxShadow: '0 0 30px rgba(59, 130, 246, 0.1)',
                }}
            >
                {lines.map((line, i) => (
                    <p
                        key={i}
                        className="admin-terminal-font text-xs mb-2 transition-opacity duration-300"
                        style={{
                            color: i <= phase ? '#60a5fa' : 'rgba(59, 130, 246, 0.15)',
                            textShadow: i <= phase ? '0 0 8px rgba(96, 165, 250, 0.3)' : 'none',
                        }}
                    >
                        {line}
                        {i === phase && <span className="admin-cursor-blink ml-1">_</span>}
                        {i < phase && <span className="text-green-400 ml-2">✓</span>}
                    </p>
                ))}
                {phase >= 4 && (
                    <div className="mt-4 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-cyan-400 text-xs admin-terminal-font">Loading dashboard...</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// KPI CARD
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function KpiCard({ label, value, sub, trend, icon }) {
    return (
        <div
            className="rounded p-4 relative overflow-hidden group"
            style={{
                background: 'rgba(0, 10, 30, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.1)'
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.15)'
                e.currentTarget.style.boxShadow = 'none'
            }}
        >
            {/* Scanline effect */}
            <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                    background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(59, 130, 246, 0.03) 2px, rgba(59, 130, 246, 0.03) 4px)',
                }}
            />

            <div className="flex items-center gap-2 mb-2">
                <span className="text-cyan-400/60">{icon}</span>
                <span className="text-blue-600/50 text-xs admin-terminal-font uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <p className="text-blue-300 text-2xl font-bold admin-terminal-font" style={{ textShadow: '0 0 10px rgba(96, 165, 250, 0.3)' }}>
                {value}
            </p>
            {sub && (
                <p className="text-xs admin-terminal-font mt-1 flex items-center gap-1">
                    {trend !== undefined && (
                        trend >= 0
                            ? <ArrowTrendingUpIcon className="w-3 h-3 text-green-400" />
                            : <ArrowTrendingDownIcon className="w-3 h-3 text-red-400" />
                    )}
                    <span style={{ color: trend !== undefined ? (trend >= 0 ? '#4ade80' : '#f87171') : 'rgba(59, 130, 246, 0.4)' }}>
                        {sub}
                    </span>
                </p>
            )}
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// TERMINAL PANEL (reusable wrapper)
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function TerminalPanel({ title, icon, children, className = '' }) {
    return (
        <div
            className={`rounded overflow-hidden ${className}`}
            style={{
                background: 'rgba(0, 10, 30, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
            }}
        >
            {/* Header */}
            <div
                className="px-4 py-2.5 flex items-center gap-2"
                style={{
                    background: 'rgba(0, 10, 30, 0.6)',
                    borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
                }}
            >
                <span className="text-cyan-400/70">{icon}</span>
                <span className="text-cyan-400 text-xs admin-terminal-font uppercase tracking-wider">
                    &gt; {title}
                </span>
            </div>
            {/* Content */}
            <div className="p-4">
                {children}
            </div>
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// OVERVIEW TAB
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function OverviewTab({ data }) {
    if (!data) return null

    return (
        <div className="space-y-6">
            {/* Section Dwell Times — top of overview */}
            {data.section_times?.length > 0 && (
                <TerminalPanel title="section_dwell_analysis" icon={<ClockIcon className="w-4 h-4" />}>
                    <SectionDwellChart sections={data.section_times} />
                </TerminalPanel>
            )}

            {/* Traffic Chart */}
            <TerminalPanel title="traffic_histogram" icon={<ChartBarIcon className="w-4 h-4" />}>
                <TrafficChart daily={data.daily || []} />
            </TerminalPanel>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Heatmap */}
                <TerminalPanel title="hourly_activity" icon={<ClockIcon className="w-4 h-4" />}>
                    <HourlyHeatmap hourly={data.hourly || []} />
                </TerminalPanel>

                {/* Top Pages */}
                <TerminalPanel title="top_pages" icon={<EyeIcon className="w-4 h-4" />}>
                    <TopPages pages={data.pages || []} />
                </TerminalPanel>
            </div>

            {/* Referrers */}
            {data.referrers?.length > 0 && (
                <TerminalPanel title="inbound_signals" icon={<SignalIcon className="w-4 h-4" />}>
                    <div className="space-y-1.5">
                        {data.referrers.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs admin-terminal-font">
                                <span className="text-blue-600/40 w-6 text-right">{fmt(r.total)}</span>
                                <span className="text-blue-400 truncate">{r.referrer}</span>
                            </div>
                        ))}
                    </div>
                </TerminalPanel>
            )}

        </div>
    )
}

// ── Section Dwell Time — Orbital Radial Chart ──
function SectionDwellChart({ sections }) {
    const [animated, setAnimated] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 200)
        return () => clearTimeout(t)
    }, [])

    if (!sections.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No dwell data yet</p>
    }

    // Actual site portal colors
    const sectionMeta = {
        'home': { label: 'HOME', color: '#6b7280' },
        'work': { label: 'WORK', color: '#00bfff' },
        'about': { label: 'ABOUT', color: '#00ff26' },
        'store': { label: 'STORE', color: '#e600ff' },
        'contact': { label: 'CONTACT', color: '#decf00' },
        'blog': { label: 'BLOG', color: '#ff6b00' },
        'section1': { label: 'WORK', color: '#00bfff' },
        'section2': { label: 'ABOUT', color: '#00ff26' },
        'section3': { label: 'STORE', color: '#e600ff' },
        'section4': { label: 'CONTACT', color: '#decf00' },
        'section5': { label: 'BLOG', color: '#ff6b00' },
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
        <div className="flex flex-col lg:flex-row items-center gap-6">
            {/* Radial chart */}
            <div className="relative shrink-0">
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    className="drop-shadow-lg"
                >
                    <defs>
                        {/* Glow filters for each section */}
                        {sorted.map((s) => {
                            const meta = sectionMeta[s.section] || { color: '#60a5fa' }
                            return (
                                <filter key={`glow-${s.section}`} id={`glow-${s.section}`} x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feFlood floodColor={meta.color} floodOpacity="0.6" result="color" />
                                    <feComposite in2="blur" operator="in" result="glow" />
                                    <feMerge>
                                        <feMergeNode in="glow" />
                                        <feMergeNode in="glow" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                            )
                        })}
                    </defs>

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
                                stroke="rgba(59, 130, 246, 0.06)"
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
                                    stroke="rgba(59, 130, 246, 0.08)"
                                    strokeWidth="1"
                                />
                            )
                        })
                    })}

                    {/* Active arcs */}
                    {sorted.map((s, i) => {
                        const meta = sectionMeta[s.section] || { color: '#60a5fa' }
                        const r = startRadius + i * (ringWidth + ringGap)
                        const pct = Math.max(0.03, (parseFloat(s.avg_seconds) || 0) / maxAvg)
                        const circumference = 2 * Math.PI * r
                        const arcLength = circumference * pct
                        const isMax = pct >= 0.99

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
                                filter={isMax ? `url(#glow-${s.section})` : undefined}
                                opacity={animated ? 0.85 : 0}
                                transform={`rotate(-90 ${cx} ${cy})`}
                                style={{
                                    transition: `stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 150}ms, opacity 0.3s ease ${i * 150}ms`,
                                }}
                            />
                        )
                    })}

                    {/* Center core — pulsing dot */}
                    <circle cx={cx} cy={cy} r="6" fill="rgba(59, 130, 246, 0.3)" />
                    <circle cx={cx} cy={cy} r="3" fill="rgba(100, 180, 255, 0.6)">
                        <animate attributeName="r" values="3;4;3" dur="2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
                    </circle>

                    {/* Center text */}
                    <text x={cx} y={cy - 6} textAnchor="middle" fill="rgba(148, 163, 184, 0.5)" fontSize="8" fontFamily="'Cascadia Code', monospace">
                        ENGAGEMENT
                    </text>
                    <text x={cx} y={cy + 8} textAnchor="middle" fill="rgba(96, 165, 250, 0.8)" fontSize="13" fontFamily="'Cascadia Code', monospace" fontWeight="bold">
                        {formatTime(totalEngagement)}
                    </text>
                </svg>

                {/* Scanline overlay on the chart */}
                <div className="absolute inset-0 pointer-events-none rounded-full opacity-10" style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(59,130,246,0.05) 2px, rgba(59,130,246,0.05) 4px)',
                }} />
            </div>

            {/* Legend + Stats */}
            <div className="flex-1 space-y-2 min-w-0">
                <div className="text-[10px] admin-terminal-font text-blue-600/25 uppercase tracking-widest mb-3">
                    // orbital_breakdown
                </div>

                {sorted.map((s, i) => {
                    const meta = sectionMeta[s.section] || { label: s.section.toUpperCase(), color: '#60a5fa' }
                    const pct = Math.round(((parseFloat(s.avg_seconds) || 0) / maxAvg) * 100)
                    const isMax = pct >= 99

                    return (
                        <div
                            key={s.section}
                            className="flex items-center gap-3 py-1 group"
                            style={{
                                opacity: animated ? 1 : 0,
                                transform: animated ? 'translateX(0)' : 'translateX(-10px)',
                                transition: `all 0.5s ease ${200 + i * 100}ms`,
                            }}
                        >
                            {/* Color dot */}
                            <div className="relative shrink-0">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                        backgroundColor: meta.color,
                                        boxShadow: isMax ? `0 0 8px ${meta.color}80, 0 0 16px ${meta.color}40` : `0 0 4px ${meta.color}30`,
                                    }}
                                />
                            </div>

                            {/* Section name */}
                            <span
                                className="text-xs admin-terminal-font font-bold tracking-wide w-20"
                                style={{ color: meta.color }}
                            >
                                {meta.label}
                            </span>

                            {/* Mini bar */}
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(59,130,246,0.06)' }}>
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: animated ? `${Math.max(pct, 4)}%` : '0%',
                                        backgroundColor: meta.color,
                                        opacity: 0.5,
                                        transition: `width 1.2s cubic-bezier(0.16,1,0.3,1) ${300 + i * 100}ms`,
                                    }}
                                />
                            </div>

                            {/* Stats */}
                            <div className="flex gap-4 shrink-0 text-[11px] admin-terminal-font">
                                <span style={{ color: meta.color, opacity: 0.8 }}>{formatTime(s.avg_seconds)}</span>
                                <span className="text-blue-600/30 w-8 text-right">{fmt(s.visits)}</span>
                            </div>
                        </div>
                    )
                })}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 text-[10px] admin-terminal-font" style={{ borderTop: '1px solid rgba(59,130,246,0.08)' }}>
                    <span className="text-blue-600/20">
                        // {sections.length} sections · {fmt(sections.reduce((a, s) => a + parseInt(s.visits || 0), 0))} samples
                    </span>
                </div>
            </div>
        </div>
    )
}

// ── Traffic Chart (ASCII bars) ──
function TrafficChart({ daily }) {
    if (!daily.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No data in this period</p>
    }

    const maxViews = Math.max(...daily.map(d => d.views), 1)

    return (
        <div className="space-y-0">
            {/* Y-axis legend */}
            <div className="flex items-center justify-between mb-3 text-xs admin-terminal-font text-blue-600/30">
                <span>date</span>
                <span>views / uniques</span>
            </div>

            {daily.map((d, i) => {
                const pct = (d.views / maxViews) * 100
                const date = new Date(d.date)
                const dayName = date.toLocaleDateString('en', { weekday: 'short' })
                const monthDay = date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
                const isToday = new Date().toDateString() === date.toDateString()

                return (
                    <div key={i} className="flex items-center gap-3 py-1 group" style={{ minHeight: '28px' }}>
                        {/* Date label */}
                        <div className="w-20 shrink-0 text-right">
                            <span className={`text-xs admin-terminal-font ${isToday ? 'text-cyan-400' : 'text-blue-600/50'}`}>
                                {dayName} {monthDay}
                            </span>
                        </div>
                        {/* Bar */}
                        <div className="flex-1 relative h-5">
                            <div
                                className="h-full rounded-sm transition-all duration-500"
                                style={{
                                    width: `${Math.max(pct, 2)}%`,
                                    background: isToday
                                        ? 'linear-gradient(90deg, rgba(34, 211, 238, 0.6) 0%, rgba(34, 211, 238, 0.3) 100%)'
                                        : 'linear-gradient(90deg, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.2) 100%)',
                                    boxShadow: isToday ? '0 0 8px rgba(34, 211, 238, 0.3)' : 'none',
                                }}
                            />
                        </div>
                        {/* Values */}
                        <div className="w-20 shrink-0 text-right">
                            <span className="text-xs admin-terminal-font text-blue-400">{fmt(d.views)}</span>
                            <span className="text-xs admin-terminal-font text-blue-600/30 ml-1">/ {fmt(d.uniques)}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Hourly Activity Histogram ──
function HourlyHeatmap({ hourly }) {
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

    // Color interpolation: from deep blue (low) → cyan (mid) → bright cyan (peak)
    const getBarColor = (intensity) => {
        if (intensity <= 0) return 'rgba(59, 130, 246, 0.08)'
        if (intensity < 0.3) return `rgba(59, 130, 246, ${0.3 + intensity})`
        if (intensity < 0.7) return `rgba(34, 180, 238, ${0.4 + intensity * 0.5})`
        return `rgba(34, 211, 238, ${0.5 + intensity * 0.4})`
    }

    const getGlow = (intensity) => {
        if (intensity < 0.5) return 'none'
        const spread = Math.round(intensity * 12)
        const alpha = (intensity * 0.4).toFixed(2)
        return `0 0 ${spread}px rgba(34, 211, 238, ${alpha})`
    }

    return (
        <div className="space-y-3">
            {/* Histogram container */}
            <div className="relative">
                {/* Y-axis scale lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ bottom: '24px' }}>
                    {[1, 0.5, 0].map((level) => (
                        <div key={level} className="flex items-center gap-2">
                            <span className="text-[9px] admin-terminal-font text-blue-600/15 w-6 text-right shrink-0">
                                {Math.round(maxHour * level)}
                            </span>
                            <div className="flex-1 h-px" style={{ background: 'rgba(59, 130, 246, 0.06)' }} />
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

                        return (
                            <div
                                key={h.hour}
                                className="flex-1 flex flex-col items-center gap-0"
                                onMouseEnter={() => setHovered(h.hour)}
                                onMouseLeave={() => setHovered(null)}
                            >
                                {/* Tooltip on hover */}
                                {isHovered && (
                                    <div
                                        className="absolute z-10 px-2 py-1 rounded text-center admin-terminal-font pointer-events-none"
                                        style={{
                                            bottom: `${barHeight + 30}px`,
                                            background: 'rgba(6, 6, 20, 0.95)',
                                            border: '1px solid rgba(34, 211, 238, 0.3)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <div className="text-cyan-400 text-[10px] font-bold">
                                            {h.hour.toString().padStart(2, '0')}:00
                                        </div>
                                        <div className="text-blue-300 text-[10px]">
                                            {h.total} visit{h.total !== 1 ? 's' : ''}
                                        </div>
                                        {totalVisits > 0 && (
                                            <div className="text-blue-600/40 text-[9px]">
                                                {((h.total / totalVisits) * 100).toFixed(1)}%
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Bar */}
                                <div
                                    className="w-full rounded-t-sm transition-all duration-300 cursor-default relative"
                                    style={{
                                        height: `${barHeight}px`,
                                        background: h.total > 0
                                            ? `linear-gradient(to top, ${getBarColor(intensity)}, ${getBarColor(Math.min(intensity + 0.2, 1))})`
                                            : 'rgba(59, 130, 246, 0.05)',
                                        boxShadow: isHovered
                                            ? `0 0 14px rgba(34, 211, 238, 0.5), inset 0 0 8px rgba(34, 211, 238, 0.15)`
                                            : getGlow(intensity),
                                        border: h.total > 0
                                            ? `1px solid rgba(34, 211, 238, ${0.1 + intensity * 0.25})`
                                            : '1px solid rgba(59, 130, 246, 0.06)',
                                        borderBottom: 'none',
                                        transform: isHovered ? 'scaleY(1.08)' : 'scaleY(1)',
                                        transformOrigin: 'bottom',
                                    }}
                                >
                                    {/* Peak indicator */}
                                    {isPeak && (
                                        <div
                                            className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400"
                                            style={{ boxShadow: '0 0 6px rgba(34, 211, 238, 0.8)' }}
                                        />
                                    )}
                                </div>

                                {/* Hour label */}
                                <div
                                    className="w-full text-center pt-1"
                                    style={{
                                        borderTop: isNow
                                            ? '2px solid rgba(34, 211, 238, 0.6)'
                                            : '1px solid rgba(59, 130, 246, 0.08)',
                                    }}
                                >
                                    <span
                                        className={`admin-terminal-font ${isNow ? 'text-cyan-400' : 'text-blue-600/25'}`}
                                        style={{ fontSize: '0.45rem' }}
                                    >
                                        {h.hour.toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* "Now" label */}
                <div
                    className="absolute text-[9px] admin-terminal-font text-cyan-400/50"
                    style={{
                        bottom: '-14px',
                        left: `calc(${(currentHour / 24) * 100}% + 32px)`,
                        transform: 'translateX(-50%)',
                    }}
                >
                    now
                </div>
            </div>

            {/* Stats bar */}
            <div
                className="flex items-center justify-between pt-2 text-[10px] admin-terminal-font"
                style={{ borderTop: '1px solid rgba(59, 130, 246, 0.06)' }}
            >
                <div className="flex items-center gap-4">
                    <span className="text-blue-600/25">
                        total: <span className="text-blue-400/50">{fmt(totalVisits)}</span>
                    </span>
                    {peakHour.total > 0 && (
                        <span className="text-blue-600/25">
                            peak: <span className="text-cyan-400/60">{peakHour.hour.toString().padStart(2, '0')}:00</span>
                            <span className="text-blue-400/40 ml-1">({peakHour.total})</span>
                        </span>
                    )}
                </div>
                <span className="text-blue-600/20">
                    {quietHours > 0 && `${quietHours}h quiet`}
                </span>
            </div>
        </div>
    )
}

// ── Top Pages ──
function TopPages({ pages }) {
    if (!pages.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No page data</p>
    }

    const maxViews = Math.max(...pages.map(p => p.views), 1)

    return (
        <div className="space-y-2">
            {pages.slice(0, 10).map((p, i) => {
                const pct = (p.views / maxViews) * 100
                return (
                    <div key={i} className="relative">
                        {/* Background bar */}
                        <div
                            className="absolute inset-0 rounded-sm"
                            style={{
                                width: `${pct}%`,
                                background: 'rgba(59, 130, 246, 0.08)',
                            }}
                        />
                        <div className="relative flex items-center gap-3 px-2 py-1 text-xs admin-terminal-font">
                            <span className="text-blue-600/30 w-4 text-right">{i + 1}.</span>
                            <span className="text-blue-400 flex-1 truncate">{p.page_url}</span>
                            <span className="text-blue-300 shrink-0">{fmt(p.views)}</span>
                            <span className="text-blue-600/30 shrink-0">({fmt(p.uniques)} unique)</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// GEO TAB
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function GeoTab({ data }) {
    if (!data) return null

    return (
        <div className="space-y-6">
            {/* World Map */}
            <TerminalWorldMap points={data.map_points || []} />

            {/* Country breakdown */}
            <TerminalPanel title="geo_scan — country_nodes" icon={<GlobeAltIcon className="w-4 h-4" />}>
                {data.countries?.length > 0 ? (
                    <div className="space-y-2">
                        {data.countries.map((c, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs admin-terminal-font">
                                <span className="w-6 text-center text-lg leading-none">{countryFlag(c.country_code)}</span>
                                <span className="text-blue-400 w-28 truncate">{c.country}</span>
                                <div className="flex-1 h-3 rounded-sm overflow-hidden" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                                    <div
                                        className="h-full rounded-sm transition-all"
                                        style={{
                                            width: `${c.pct}%`,
                                            background: i === 0
                                                ? 'linear-gradient(90deg, rgba(34, 211, 238, 0.6), rgba(34, 211, 238, 0.3))'
                                                : 'linear-gradient(90deg, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.2))',
                                            boxShadow: i === 0 ? '0 0 6px rgba(34, 211, 238, 0.3)' : 'none',
                                        }}
                                    />
                                </div>
                                <span className="text-blue-300 w-10 text-right">{c.pct}%</span>
                                <span className="text-blue-600/30 w-12 text-right">{fmt(c.total)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-blue-600/30 text-xs admin-terminal-font">// No geo data available</p>
                )}
            </TerminalPanel>

            {/* Top IPs — the geek section */}
            <TerminalPanel title="top_ip_nodes — recurring_signals" icon={<MapPinIcon className="w-4 h-4" />}>
                {data.top_ips?.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs admin-terminal-font">
                            <thead>
                                <tr className="text-blue-600/40">
                                    <th className="text-left py-1.5 pr-3">#</th>
                                    <th className="text-left py-1.5 pr-3">IP_ADDR</th>
                                    <th className="text-left py-1.5 pr-3">VISITS</th>
                                    <th className="text-left py-1.5 pr-3">LOCATION</th>
                                    <th className="text-left py-1.5 pr-3">BROWSER</th>
                                    <th className="text-left py-1.5 pr-3">OS</th>
                                    <th className="text-left py-1.5">LAST_SEEN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.top_ips.map((ip, i) => (
                                    <tr
                                        key={i}
                                        className="border-t transition-colors hover:bg-blue-500/5"
                                        style={{ borderColor: 'rgba(59, 130, 246, 0.07)' }}
                                    >
                                        <td className="py-1.5 pr-3 text-blue-600/30">{String(i + 1).padStart(3, '0')}</td>
                                        <td className="py-1.5 pr-3 text-cyan-400 font-bold" style={{ textShadow: '0 0 6px rgba(34, 211, 238, 0.3)' }}>
                                            {ip.ip_address}
                                        </td>
                                        <td className="py-1.5 pr-3 text-blue-300">{fmt(ip.visits)}</td>
                                        <td className="py-1.5 pr-3 text-blue-400">
                                            {ip.city && ip.country ? `${ip.city}, ${ip.country}` : ip.country || '—'}
                                        </td>
                                        <td className="py-1.5 pr-3 text-blue-400/60">{ip.browser || '—'}</td>
                                        <td className="py-1.5 pr-3 text-blue-400/60">{ip.os || '—'}</td>
                                        <td className="py-1.5 text-blue-600/40">{timeAgo(ip.last_visit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-blue-600/30 text-xs admin-terminal-font">// No IP data available</p>
                )}
            </TerminalPanel>
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// TECH TAB (Browsers, OS, Devices, Screens)
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function TechTab({ data }) {
    if (!data) return null

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Browser Processes */}
                <TerminalPanel title="ps_aux — browser_processes" icon={<CpuChipIcon className="w-4 h-4" />}>
                    <BrowserProcessList browsers={data.browsers || []} />
                </TerminalPanel>

                {/* OS Map */}
                <TerminalPanel title="uname_-a — os_distribution" icon={<ComputerDesktopIcon className="w-4 h-4" />}>
                    <OsList oses={data.oses || []} />
                </TerminalPanel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Device Matrix */}
                <TerminalPanel title="device_matrix" icon={<DevicePhoneMobileIcon className="w-4 h-4" />}>
                    <DeviceMatrix devices={data.devices || []} />
                </TerminalPanel>

                {/* Screen Resolutions */}
                <TerminalPanel title="display_modes" icon={<ComputerDesktopIcon className="w-4 h-4" />}>
                    <ScreenList screens={data.screens || []} />
                </TerminalPanel>
            </div>

            {/* ISPs — Geek section */}
            {data.isps?.length > 0 && (
                <TerminalPanel title="traceroute — isp_network_map" icon={<WifiIcon className="w-4 h-4" />}>
                    <div className="space-y-1.5">
                        {data.isps.map((isp, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs admin-terminal-font">
                                <span className="text-blue-600/30 w-6 text-right">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-green-400 w-3">▸</span>
                                <span className="text-blue-400 flex-1 truncate">{isp.isp}</span>
                                <span className="text-blue-300">{fmt(isp.total)} hops</span>
                            </div>
                        ))}
                    </div>
                </TerminalPanel>
            )}
        </div>
    )
}

// ── Browser Process List (styled as ps aux) ──
function BrowserProcessList({ browsers }) {
    if (!browsers.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No browser data</p>
    }

    // Map browsers to fake process names
    const procMap = {
        'Chrome': 'chrome.exe',
        'Safari': 'safari.app',
        'Firefox': 'firefox.bin',
        'Edge': 'msedge.exe',
        'Opera': 'opera.exe',
        'Samsung': 'samsung.apk',
        'Brave': 'brave.exe',
        'Vivaldi': 'vivaldi.exe',
        'Yandex': 'yandex.exe',
        'UC Browser': 'ucbrowser.exe',
        'IE': 'iexplore.exe',
        'Bot': 'crawler.bot',
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs admin-terminal-font">
                <thead>
                    <tr className="text-blue-600/40 uppercase">
                        <th className="text-left py-1 pr-2">PID</th>
                        <th className="text-left py-1 pr-2">PROCESS</th>
                        <th className="text-right py-1 pr-2">CPU%</th>
                        <th className="text-right py-1 pr-2">CONNS</th>
                        <th className="text-left py-1">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    {browsers.map((b, i) => (
                        <tr
                            key={i}
                            className="border-t transition-colors hover:bg-blue-500/5"
                            style={{ borderColor: 'rgba(59, 130, 246, 0.07)' }}
                        >
                            <td className="py-1.5 pr-2 text-blue-600/30">{String(i + 1).padStart(3, '0')}</td>
                            <td className="py-1.5 pr-2 text-cyan-400">{procMap[b.browser] || `${b.browser.toLowerCase()}.bin`}</td>
                            <td className="py-1.5 pr-2 text-blue-300 text-right">{b.pct}%</td>
                            <td className="py-1.5 pr-2 text-blue-400 text-right">{fmt(b.total)}</td>
                            <td className="py-1.5">
                                <span className="inline-flex items-center gap-1 text-green-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                                    ACTIVE
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ── OS List ──
function OsList({ oses }) {
    if (!oses.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No OS data</p>
    }

    return (
        <div className="space-y-2">
            {oses.map((o, i) => (
                <div key={i} className="flex items-center gap-3 text-xs admin-terminal-font">
                    <span className="text-blue-600/40 w-24 truncate">{o.os}</span>
                    <div className="flex-1">
                        <span className="text-cyan-400" style={{ textShadow: '0 0 4px rgba(34, 211, 238, 0.2)' }}>
                            {asciiBar(parseFloat(o.pct), 16)}
                        </span>
                    </div>
                    <span className="text-blue-300 w-10 text-right">{o.pct}%</span>
                    <span className="text-blue-600/30 w-10 text-right">{fmt(o.total)}</span>
                </div>
            ))}
        </div>
    )
}

// ── Device Matrix ──
function DeviceMatrix({ devices }) {
    if (!devices.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No device data</p>
    }

    const colors = {
        desktop: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', text: '#60a5fa' },
        mobile: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' },
        tablet: { bg: 'rgba(34, 211, 238, 0.15)', border: 'rgba(34, 211, 238, 0.3)', text: '#22d3ee' },
        bot: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
    }

    return (
        <div className="grid grid-cols-2 gap-3">
            {devices.map((d, i) => {
                const c = colors[d.device_type] || colors.desktop
                return (
                    <div
                        key={i}
                        className="rounded p-3 text-center transition-all hover:scale-[1.02]"
                        style={{
                            background: c.bg,
                            border: `1px solid ${c.border}`,
                            boxShadow: `0 0 8px ${c.border}`,
                        }}
                    >
                        <div className="flex justify-center mb-1" style={{ color: c.text }}>
                            <DeviceIcon type={d.device_type} />
                        </div>
                        <p className="text-lg font-bold admin-terminal-font" style={{ color: c.text }}>
                            {d.pct}%
                        </p>
                        <p className="text-xs admin-terminal-font text-blue-600/40 uppercase">
                            {d.device_type} ({fmt(d.total)})
                        </p>
                    </div>
                )
            })}
        </div>
    )
}

// ── Screen Resolutions ──
function ScreenList({ screens }) {
    if (!screens.length) {
        return <p className="text-blue-600/30 text-xs admin-terminal-font">// No screen data</p>
    }

    const max = Math.max(...screens.map(s => s.total), 1)

    return (
        <div className="space-y-1.5">
            {screens.map((s, i) => {
                const pct = (s.total / max) * 100
                return (
                    <div key={i} className="flex items-center gap-3 text-xs admin-terminal-font">
                        <span className="text-cyan-400 w-24 font-bold">{s.resolution}</span>
                        <div className="flex-1 h-2.5 rounded-sm overflow-hidden" style={{ background: 'rgba(59, 130, 246, 0.08)' }}>
                            <div
                                className="h-full rounded-sm"
                                style={{
                                    width: `${pct}%`,
                                    background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.2))',
                                }}
                            />
                        </div>
                        <span className="text-blue-300 w-8 text-right">{fmt(s.total)}</span>
                    </div>
                )
            })}
        </div>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// LIVE FEED TAB
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function LiveTab({ visitors, onRefresh }) {
    return (
        <TerminalPanel
            title="live_network_feed — incoming_connections"
            icon={<CommandLineIcon className="w-4 h-4" />}
        >
            <div className="flex items-center gap-2 mb-4">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-green-400 text-xs admin-terminal-font">
                    LIVE — auto-refresh every 30s
                </span>
                <button
                    onClick={onRefresh}
                    className="ml-auto p-1 rounded hover:bg-blue-500/10 text-blue-600 hover:text-blue-400 transition-colors"
                >
                    <ArrowPathIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {visitors.length === 0 ? (
                <p className="text-blue-600/30 text-xs admin-terminal-font">// Awaiting incoming signals...</p>
            ) : (
                <div className="space-y-1 font-mono text-xs max-h-[600px] overflow-y-auto admin-scroll">
                    {visitors.map((v, i) => (
                        <div
                            key={i}
                            className="flex items-start gap-2 py-1.5 px-2 rounded transition-colors hover:bg-blue-500/5"
                            style={{
                                borderLeft: '2px solid rgba(59, 130, 246, 0.2)',
                                animationDelay: `${i * 50}ms`,
                            }}
                        >
                            {/* Timestamp */}
                            <span className="text-blue-600/30 shrink-0 w-16">
                                {new Date(v.visited_at).toLocaleTimeString('en', { hour12: false })}
                            </span>
                            {/* IP */}
                            <span className="text-cyan-400 shrink-0 w-28 font-bold" style={{ textShadow: '0 0 4px rgba(34, 211, 238, 0.2)' }}>
                                {v.ip_address}
                            </span>
                            {/* Country flag */}
                            <span className="shrink-0 w-6 text-center">
                                {countryFlag(v.country_code)}
                            </span>
                            {/* Location */}
                            <span className="text-blue-400/60 shrink-0 w-28 truncate">
                                {v.city ? `${v.city}, ${v.country}` : v.country || '—'}
                            </span>
                            {/* Browser & OS */}
                            <span className="text-blue-600/40 shrink-0 w-24 truncate">
                                {v.browser}/{v.os}
                            </span>
                            {/* Device */}
                            <span className="shrink-0 text-blue-600/30">
                                <DeviceIcon type={v.device_type} />
                            </span>
                            {/* Page */}
                            <span className="text-green-400/60 truncate flex-1">
                                {v.page_url}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </TerminalPanel>
    )
}

// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
// NETWORK LOG TAB (raw geek data)
// """""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

function NetworkTab({ data }) {
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
        <TerminalPanel
            title={`network_packet_log — ${fmt(meta.total)} total_entries`}
            icon={<ServerIcon className="w-4 h-4" />}
        >
            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                    <span className="text-blue-500/50 text-xs admin-terminal-font">&gt; querying_database...</span>
                </div>
            ) : visitors.length === 0 ? (
                <p className="text-blue-600/30 text-xs admin-terminal-font">// No packet data recorded</p>
            ) : (
                <>
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto admin-scroll">
                        <table className="w-full text-xs admin-terminal-font whitespace-nowrap">
                            <thead className="sticky top-0" style={{ background: 'rgba(0, 10, 30, 0.95)' }}>
                                <tr className="text-blue-600/40 uppercase">
                                    <th className="text-left py-1.5 pr-3">TIME</th>
                                    <th className="text-left py-1.5 pr-3">IP</th>
                                    <th className="text-left py-1.5 pr-3">LOCATION</th>
                                    <th className="text-left py-1.5 pr-3">BROWSER / OS</th>
                                    <th className="text-left py-1.5 pr-3">DEVICE</th>
                                    <th className="text-left py-1.5 pr-3">PAGE</th>
                                    <th className="text-left py-1.5 pr-3">LANG</th>
                                    <th className="text-left py-1.5">PREFS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visitors.map((v, i) => (
                                    <tr
                                        key={v.id}
                                        className="border-t transition-colors hover:bg-blue-500/5"
                                        style={{ borderColor: 'rgba(59, 130, 246, 0.05)' }}
                                    >
                                        <td className="py-1.5 pr-3 text-blue-600/40">
                                            {new Date(v.visited_at).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </td>
                                        <td className="py-1.5 pr-3 text-cyan-400 font-bold">{v.ip_address}</td>
                                        <td className="py-1.5 pr-3">
                                            <div className="text-blue-400">{v.city ? `${v.city}, ${v.country}` : v.country || '—'}</div>
                                            {v.isp && <div className="text-blue-600/30 text-[10px] truncate max-w-[180px]">{v.isp}</div>}
                                        </td>
                                        <td className="py-1.5 pr-3">
                                            <span className="text-blue-400/60">{v.browser}</span>
                                            <span className="text-blue-600/20 mx-1">/</span>
                                            <span className="text-blue-400/60">{v.os}</span>
                                        </td>
                                        <td className="py-1.5 pr-3">
                                            <span className={v.device_type === 'bot' ? 'text-red-400' : 'text-blue-400/50'}>
                                                {v.device_type}
                                            </span>
                                            {v.screen_width > 0 && (
                                                <span className="text-blue-600/25 ml-1">{v.screen_width}×{v.screen_height}</span>
                                            )}
                                        </td>
                                        <td className="py-1.5 pr-3 text-green-400/50 max-w-[120px] truncate">{v.page_url}</td>
                                        <td className="py-1.5 pr-3 text-blue-600/40">{v.language || '—'}</td>
                                        <td className="py-1.5 text-blue-600/30">
                                            {v.is_dark_mode ? '🌙' : '☀️'}
                                            <span className="mx-0.5">{'·'}</span>
                                            {v.is_touch ? '👆' : '🖱️'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {meta.pages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(59, 130, 246, 0.1)' }}>
                            <span className="text-blue-600/30 text-xs admin-terminal-font">
                // page {page} of {meta.pages} ({fmt(meta.total)} records)
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => fetchVisitors(page - 1)}
                                    disabled={page <= 1}
                                    className="px-3 py-1 rounded text-xs admin-terminal-font text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-blue-500/20"
                                >
                                    &lt; prev
                                </button>
                                <button
                                    onClick={() => fetchVisitors(page + 1)}
                                    disabled={page >= meta.pages}
                                    className="px-3 py-1 rounded text-xs admin-terminal-font text-blue-400 hover:bg-blue-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-blue-500/20"
                                >
                                    next &gt;
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </TerminalPanel>
    )
}

