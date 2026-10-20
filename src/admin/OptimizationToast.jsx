/**
 * OptimizationToast — Displays image optimization results
 * Shows original vs optimized size, reduction %, and conversion info
 * Auto-dismisses after a configurable duration
 */

import React, { useState, useEffect } from 'react'
import { CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'

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

// Under 15% the saving is noise, so it reads neutral instead of success.
function getReductionColor(percent) {
    return percent >= 15 ? 'var(--a-success)' : 'var(--a-text-3)'
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
    const shown = visible && !exiting

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed z-[9999] bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[340px] transition-[transform,opacity] duration-[400ms] ease-expo-out"
            style={{
                transform: shown ? 'translateX(0)' : 'translateX(120%)',
                opacity: shown ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
            }}
        >
            <div className="a-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-2 border-b-2 border-white/10">
                    <span className="flex items-center gap-2 text-sm font-bold text-white">
                        <CheckCircleIcon className="w-[1.125rem] h-[1.125rem] flex-shrink-0" style={{ color }} aria-hidden />
                        Image optimized
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setExiting(true)
                            setTimeout(() => onDismiss?.(), 400)
                        }}
                        className="a-icon-btn a-icon-btn--sm border-transparent"
                        aria-label="Dismiss"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-4 py-3.5 space-y-3">
                    <div>
                        <div className="flex items-baseline justify-between gap-3 mb-2">
                            <span className="a-meta">
                                {formatBytes(original_size)} → {formatBytes(optimized_size)}
                            </span>
                            <span className="a-num text-lg font-bold leading-none" style={{ color }}>
                                -{reduction_percent}%
                            </span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-[width] duration-1000 ease-expo-out"
                                style={{
                                    width: `${Math.min(100, reduction_percent)}%`,
                                    background: color,
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {converted_to_webp && (
                            <span className="a-badge a-badge--success">Converted to WebP</span>
                        )}
                        {dimensionsChanged && (
                            <span className="a-badge a-num">{new_dimensions}</span>
                        )}
                        <span className="a-badge">{format}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
