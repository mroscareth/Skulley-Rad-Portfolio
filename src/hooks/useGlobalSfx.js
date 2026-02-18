/**
 * useGlobalSfx — global event-delegation hook for hover/click SFX.
 *
 * Mount this ONCE at the app root (App.jsx / AdminApp.jsx).
 * It attaches mouseenter (via mouseover) + click listeners on `document`
 * and automatically plays hover/click sounds for interactive elements.
 *
 * Deduplication is handled inside playSfx itself (80ms cooldown),
 * so components that already call playSfx manually will NOT double-fire.
 */

import { useEffect } from 'react'
import { playSfx, preloadSfx } from '../lib/sfx.js'

// Selectors that count as "interactive"
const INTERACTIVE_TAGS = new Set(['BUTTON', 'A', 'SUMMARY'])
const INTERACTIVE_ROLES = new Set(['button', 'link', 'tab', 'menuitem', 'switch'])

// Elements we should NEVER play hover sounds on (form fields, etc.)
const SKIP_TAGS = new Set([
    'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'LABEL',
    'VIDEO', 'AUDIO', 'CANVAS',
])

function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false
    // Skip disabled elements
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false
    // Skip invisible or pointer-events-none
    if (el.offsetParent === null && el.tagName !== 'BODY') return false
    // Skip form fields
    if (SKIP_TAGS.has(el.tagName)) return false
    // Direct match
    if (INTERACTIVE_TAGS.has(el.tagName)) return true
    // Role match
    const role = el.getAttribute('role')
    if (role && INTERACTIVE_ROLES.has(role)) return true
    // input type=submit/reset/button
    if (el.tagName === 'INPUT' && ['submit', 'reset', 'button'].includes(el.type)) return true
    // Elements with explicit cursor-pointer or tabindex
    if (el.tabIndex >= 0 && el.getAttribute('tabindex') !== null) return true
    // Check for click handler via onclick attribute (rare in React but covers it)
    if (el.hasAttribute('onclick')) return true
    return false
}

// Walk up the DOM from target to find the nearest interactive ancestor
function findInteractiveAncestor(target, maxDepth = 6) {
    let el = target
    for (let i = 0; i < maxDepth && el && el !== document.body; i++) {
        if (isInteractive(el)) return el
        el = el.parentElement
    }
    return null
}

// Track last hover target to avoid repeating on the same element
let lastHoverTarget = null

export default function useGlobalSfx() {
    useEffect(() => {
        // Preload both clips so first interaction is instant
        preloadSfx(['hover', 'click'])

        // HOVER — uses mouseover (bubbles, unlike mouseenter)
        const onHover = (e) => {
            const el = findInteractiveAncestor(e.target)
            if (!el) return
            // Avoid replaying while still inside the same element
            if (el === lastHoverTarget) return
            lastHoverTarget = el
            try { playSfx('hover', { volume: 0.7 }) } catch { }
        }

        // Reset hover target when mouse leaves an interactive element
        const onHoverOut = (e) => {
            const el = findInteractiveAncestor(e.target)
            if (el && el === lastHoverTarget) {
                lastHoverTarget = null
            }
        }

        // CLICK
        const onClick = (e) => {
            const el = findInteractiveAncestor(e.target)
            if (!el) return
            try { playSfx('click', { volume: 0.8 }) } catch { }
        }

        document.addEventListener('mouseover', onHover, { passive: true, capture: false })
        document.addEventListener('mouseout', onHoverOut, { passive: true, capture: false })
        document.addEventListener('click', onClick, { passive: true, capture: false })

        return () => {
            document.removeEventListener('mouseover', onHover)
            document.removeEventListener('mouseout', onHoverOut)
            document.removeEventListener('click', onClick)
            lastHoverTarget = null
        }
    }, [])
}
