import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/authContext.js'

const API_BASE = `${import.meta.env.BASE_URL}api/achievements.php`

// Guest (no auth) store — achievements persist para el resto de la sesión
// en sessionStorage. Al loggear, los keys pendientes se migran al backend.
const GUEST_KEY = 'skulley_achievements'
// Legacy flag que usaba App.jsx antes del sistema de achievements.
// Se migra a 'section6_unlocked' y se borra al sincronizar con el backend.
const LEGACY_SECTION6_KEY = 'skulley_section6_unlocked'

function readGuestAchievements() {
  try {
    const raw = sessionStorage.getItem(GUEST_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const set = new Set(Array.isArray(parsed) ? parsed.filter(k => typeof k === 'string') : [])
    if (sessionStorage.getItem(LEGACY_SECTION6_KEY) === '1') {
      set.add('section6_unlocked')
    }
    return set
  } catch {
    return new Set()
  }
}

function writeGuestAchievements(set) {
  try {
    sessionStorage.setItem(GUEST_KEY, JSON.stringify([...set]))
    // Mantener el flag legacy por compat mientras coexista código viejo.
    if (set.has('section6_unlocked')) {
      sessionStorage.setItem(LEGACY_SECTION6_KEY, '1')
    }
  } catch {}
}

/**
 * useAchievements — logros persistentes por usuario autenticado.
 *
 * Guests: set en sessionStorage (vive por la sesión actual).
 * Auth: backend es source of truth. Al loggear se migran los keys
 * que el guest tenía en sessionStorage al backend, luego se limpia.
 */
export default function useAchievements() {
  const { authenticated, user, ready } = useAuth()
  const privyId = user?.id || null

  const [achievements, setAchievements] = useState(() => readGuestAchievements())
  const [isLoaded, setIsLoaded] = useState(false)
  const fetchedForRef = useRef(null)

  useEffect(() => {
    if (!ready) return

    if (!authenticated || !privyId) {
      // Guest: rehidratar desde sessionStorage por si cambió (logout, otra tab).
      setAchievements(readGuestAchievements())
      setIsLoaded(true)
      fetchedForRef.current = null
      return
    }

    if (fetchedForRef.current === privyId) return
    fetchedForRef.current = privyId

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}?action=list&pid=${encodeURIComponent(privyId)}`)
        const json = await res.json()
        if (cancelled) return
        const serverKeys = new Set(
          json?.ok && Array.isArray(json.achievements)
            ? json.achievements.map(a => a.key).filter(k => typeof k === 'string')
            : []
        )

        // Migrar keys que el guest desbloqueó antes de loggearse.
        const guestKeys = readGuestAchievements()
        const toMigrate = [...guestKeys].filter(k => !serverKeys.has(k))
        if (toMigrate.length > 0) {
          await Promise.all(toMigrate.map(async (key) => {
            try {
              const r = await fetch(`${API_BASE}?action=unlock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ privy_id: privyId, achievement_key: key }),
              })
              const j = await r.json()
              if (j?.ok) serverKeys.add(key)
            } catch {}
          }))
        }

        // Limpiar sessionStorage — backend queda como source of truth.
        try {
          sessionStorage.removeItem(GUEST_KEY)
          sessionStorage.removeItem(LEGACY_SECTION6_KEY)
        } catch {}

        if (!cancelled) setAchievements(serverKeys)
      } catch (err) {
        console.warn('[useAchievements] fetch failed:', err)
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    })()

    return () => { cancelled = true }
  }, [ready, authenticated, privyId])

  const has = useCallback((key) => achievements.has(key), [achievements])

  const unlock = useCallback(async (key, metadata) => {
    if (!key || typeof key !== 'string') return { newlyUnlocked: false }
    if (achievements.has(key)) return { newlyUnlocked: false }

    // Optimistic update — el consumidor ve el unlock inmediatamente.
    const optimistic = new Set(achievements)
    optimistic.add(key)
    setAchievements(optimistic)

    if (authenticated && privyId) {
      try {
        const res = await fetch(`${API_BASE}?action=unlock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privy_id: privyId,
            achievement_key: key,
            ...(metadata ? { metadata } : {}),
          }),
        })
        const json = await res.json()
        return { newlyUnlocked: !!json?.newly_unlocked }
      } catch (err) {
        console.warn('[useAchievements] unlock failed:', err)
        return { newlyUnlocked: true }
      }
    }

    // Guest: persistir en sessionStorage.
    writeGuestAchievements(optimistic)
    return { newlyUnlocked: true }
  }, [achievements, authenticated, privyId])

  return { achievements, isLoaded, has, unlock }
}
