/**
 * OptimizationToast — Displays image optimization results
 * Shows original vs optimized size, reduction %, and conversion info
 * Auto-dismisses after a configurable duration
 */

import React, { useState, useEffect } from 'react'

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Get color based on reduction percentage
 */
function getReductionColor(percent) {
    if (percent >= 70) return '#22c55e' // green — excellent
    if (percent >= 40) return '#3b82f6' // blue — good
    if (percent >= 15) return '#f59e0b' // amber — moderate
    return '#94a3b8' // slate — minimal
}

export default function OptimizationToast({ data, onDismiss, duration = 6000 }) {
    const [visible, setVisible] = useState(false)
    const [exiting, setExiting] = useState(false)

    useEffect(() => {
        if (!data) return
        // Animate in
        requestAnimationFrame(() => setVisible(true))

        // Auto-dismiss
        const timer = setTimeout(() => {
            setExiting(true)
            setTimeout(() => {
                setVisible(false)
                onDismiss?.()
            }, 400)
        }, duration)

        return () => clearTimeout(timer)
    }, [data, duration, onDismiss])

    if (!data) return null

    const {
        original_size,
        optimized_size,
        reduction_percent,
        original_dimensions,
        new_dimensions,
        format,
        converted_to_webp,
    } = data

    const color = getReductionColor(reduction_percent)
    const dimensionsChanged = original_dimensions !== new_dimensions

    return (
        <div
            style={{
                position: 'fixed',
                bottom: '5rem',
                right: '1.5rem',
                zIndex: 9999,
                maxWidth: '340px',
                width: '100%',
                fontFamily: '"Cascadia Code", "Fira Code", monospace',
                transform: visible && !exiting ? 'translateX(0)' : 'translateX(120%)',
                opacity: visible && !exiting ? 1 : 0,
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: visible ? 'auto' : 'none',
            }}
        >
            <div
                style={{
                    background: 'rgba(0, 8, 20, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: `1px solid ${color}33`,
                    borderRadius: '0.75rem',
                    padding: '0',
                    overflow: 'hidden',
                    boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 24px ${color}15`,
                }}
            >
                {/* Header */}
                <div
                    style={{
                        background: `linear-gradient(135deg, ${color}18, transparent)`,
                        padding: '0.625rem 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: `1px solid ${color}20`,
                    }}
                >
                    <span style={{ color, fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        ✦ image_optimized
                    </span>
                    <button
                        onClick={() => {
                            setExiting(true)
                            setTimeout(() => onDismiss?.(), 400)
                        }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'rgba(148,163,184,0.5)',
                            cursor: 'pointer',
                            padding: '0.125rem 0.25rem',
                            fontSize: '0.8rem',
                            lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '0.75rem 0.875rem' }}>
                    {/* Size reduction bar */}
                    <div style={{ marginBottom: '0.625rem' }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                marginBottom: '0.375rem',
                            }}
                        >
                            <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.65rem' }}>
                                {formatBytes(original_size)} → {formatBytes(optimized_size)}
                            </span>
                            <span
                                style={{
                                    color,
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    textShadow: `0 0 12px ${color}40`,
                                }}
                            >
                                -{reduction_percent}%
                            </span>
                        </div>

                        {/* Progress bar */}
                        <div
                            style={{
                                width: '100%',
                                height: '4px',
                                background: 'rgba(148,163,184,0.1)',
                                borderRadius: '2px',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${Math.min(100, reduction_percent)}%`,
                                    height: '100%',
                                    background: `linear-gradient(90deg, ${color}, ${color}80)`,
                                    borderRadius: '2px',
                                    transition: 'width 1s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: `0 0 8px ${color}40`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.6rem' }}>
                        {converted_to_webp && (
                            <span
                                style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                    background: 'rgba(34,197,94,0.12)',
                                    border: '1px solid rgba(34,197,94,0.25)',
                                    color: '#4ade80',
                                }}
                            >
                                → WebP
                            </span>
                        )}
                        {dimensionsChanged && (
                            <span
                                style={{
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '999px',
                                    background: 'rgba(59,130,246,0.12)',
                                    border: '1px solid rgba(59,130,246,0.25)',
                                    color: '#60a5fa',
                                }}
                            >
                                {new_dimensions}
                            </span>
                        )}
                        <span
                            style={{
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                background: 'rgba(148,163,184,0.08)',
                                border: '1px solid rgba(148,163,184,0.15)',
                                color: 'rgba(148,163,184,0.6)',
                            }}
                        >
                            {format}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
