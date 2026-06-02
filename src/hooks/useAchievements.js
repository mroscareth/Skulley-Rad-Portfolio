import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/authContext.js'

const API_BASE = `${import.meta.env.BASE_URL}api/achievements.php`

// Guest (no auth) store — los logros de invitado se guardan en localStorage
// para que PERSISTAN entre sesiones (cerrar la pestaña no los borra). Cuando el
// usuario eventualmente se loguea (en esta sesión o días después), se migran al
// backend y se limpia el store local. Antes vivían en sessionStorage → se perdían
// al cerrar el navegador sin haber logueado.
const GUEST_KEY = 'skulley_achievements'
// Legacy flag que usaba App.jsx antes del sistema de achievements.
// Se migra a 'section6_unlocked' y se borra al sincronizar con el backend.
const LEGACY_SECTION6_KEY = 'skulley_section6_unlocked'
// Buffer namespaced POR USUARIO: unlocks de un usuario AUTENTICADO que todavía
// NO se confirmaron en la DB (POST falló: perfil no sincronizado aún, red caída,
// etc.). Se reintenta en cada carga hasta confirmarse → un logro nunca se pierde.
// Namespaced por privy_id para no contaminar entre usuarios del mismo navegador.
const PENDING_KEY = (pid) => `skulley_ach_pending_${pid}`

function parseList(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(k => typeof k === 'string') : []
  } catch { return [] }
}

function readGuestAchievements() {
  const set = new Set()
  // Fuente principal: localStorage (persistente).
  try { parseList(localStorage.getItem(GUEST_KEY)).forEach(k => set.add(k)) } catch {}
  // Compat: versiones anteriores guardaban en sessionStorage — merge para no
  // perder lo ganado antes de este cambio.
  try { parseList(sessionStorage.getItem(GUEST_KEY)).forEach(k => set.add(k)) } catch {}
  // Flag legacy de section6 (pudo quedar en cualquiera de los dos).
  try {
    if (localStorage.getItem(LEGACY_SECTION6_KEY) === '1' || sessionStorage.getItem(LEGACY_SECTION6_KEY) === '1') {
      set.add('section6_unlocked')
    }
  } catch {}
  return set
}

function writeGuestAchievements(set) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify([...set]))
    // Mantener el flag legacy por compat mientras coexista código viejo.
    if (set.has('section6_unlocked')) {
      localStorage.setItem(LEGACY_SECTION6_KEY, '1')
    }
  } catch {}
}

// Limpia el store de invitado (local + session) tras migrar al backend.
function clearGuestAchievements() {
  try { localStorage.removeItem(GUEST_KEY); localStorage.removeItem(LEGACY_SECTION6_KEY) } catch {}
  try { sessionStorage.removeItem(GUEST_KEY); sessionStorage.removeItem(LEGACY_SECTION6_KEY) } catch {}
}

// ── Buffer "pending" de unlocks no confirmados en DB (por usuario) ──
function readPending(pid) {
  if (!pid) return new Set()
  try { return new Set(parseList(localStorage.getItem(PENDING_KEY(pid)))) } catch { return new Set() }
}
function writePending(pid, set) {
  if (!pid) return
  try {
    if (set && set.size) localStorage.setItem(PENDING_KEY(pid), JSON.stringify([...set]))
    else localStorage.removeItem(PENDING_KEY(pid))
  } catch {}
}
function addPending(pid, key) { const s = readPending(pid); s.add(key); writePending(pid, s) }
function removePending(pid, key) { const s = readPending(pid); if (s.delete(key)) writePending(pid, s) }

async function postUnlock(privyId, key, metadata) {
  const res = await fetch(`${API_BASE}?action=unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      privy_id: privyId,
      achievement_key: key,
      ...(metadata ? { metadata } : {}),
    }),
  })
  return res.json()
}

/**
 * useAchievements — logros persistentes por usuario autenticado.
 *
 * Guests: set en localStorage (persiste entre sesiones).
 * Auth: la DB (user_achievements) es source of truth. Cada unlock hace POST; si
 * falla queda en un buffer "pending" namespaced y se reintenta en cada carga.
 * Al loggear se migran los keys de invitado (los que fallen se conservan para
 * reintento — nunca se borra un logro sin confirmarlo en DB).
 */
export default function useAchievements() {
  const { authenticated, user, ready } = useAuth()
  const privyId = user?.id || null

  const [achievements, setAchievements] = useState(() => readGuestAchievements())
  // Espejo siempre fresco del set. CRÍTICO: permite que varios unlock()
  // SÍNCRONOS consecutivos (ej. la ofrenda desbloquea section6_unlocked Y
  // skin_void en la misma llamada) se COMPONGAN en vez de pisarse — sin el ref,
  // cada uno parte del mismo `achievements` viejo y el último setAchievements
  // gana, perdiendo el otro key.
  const achievementsRef = useRef(achievements)
  achievementsRef.current = achievements
  // Mapa key → unlocked_at (ISO). Solo se puebla para usuarios auth (el backend
  // guarda la fecha); guests no tienen fecha. Lo consume el tab de logros.
  const [unlockedAt, setUnlockedAt] = useState({})
  const [isLoaded, setIsLoaded] = useState(false)
  const fetchedForRef = useRef(null)

  useEffect(() => {
    if (!ready) return

    if (!authenticated || !privyId) {
      // Guest: rehidratar desde localStorage por si cambió (logout, otra tab).
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
        const list = json?.ok && Array.isArray(json.achievements) ? json.achievements : []
        const serverKeys = new Set(
          list.map(a => a.key).filter(k => typeof k === 'string')
        )
        const dates = {}
        for (const a of list) {
          if (a && typeof a.key === 'string') dates[a.key] = a.unlocked_at || null
        }
        if (!cancelled) setUnlockedAt(dates)

        // 1) Migrar keys que el guest desbloqueó antes de loggearse. Los que
        //    FALLEN se conservan en localStorage (reintento en la próxima carga)
        //    → nunca se pierde un logro por un POST fallido / perfil no listo.
        const guestKeys = readGuestAchievements()
        const guestToMigrate = [...guestKeys].filter(k => !serverKeys.has(k))
        const guestFailed = []
        if (guestToMigrate.length > 0) {
          await Promise.all(guestToMigrate.map(async (key) => {
            try {
              const j = await postUnlock(privyId, key)
              if (j?.ok) serverKeys.add(key)
              else guestFailed.push(key)
            } catch { guestFailed.push(key) }
          }))
        }
        if (guestFailed.length > 0) writeGuestAchievements(new Set(guestFailed))
        else clearGuestAchievements()
        guestFailed.forEach(k => serverKeys.add(k)) // mostrarlos desbloqueados igual

        // 2) Reconciliar el buffer "pending" del usuario: unlocks de sesiones
        //    previas que no se confirmaron en DB. Re-POST y limpia los OK.
        const pending = readPending(privyId)
        const stillPending = new Set()
        if (pending.size > 0) {
          await Promise.all([...pending].map(async (key) => {
            if (serverKeys.has(key)) return // ya está confirmado en server
            try {
              const j = await postUnlock(privyId, key)
              if (j?.ok) serverKeys.add(key)
              else stillPending.add(key)
            } catch { stillPending.add(key) }
          }))
        }
        writePending(privyId, stillPending)
        stillPending.forEach(k => serverKeys.add(k))

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
    // Leemos del REF (siempre fresco), no del closure de `achievements`, para
    // que unlocks síncronos consecutivos se acumulen.
    const current = achievementsRef.current
    if (current.has(key)) return { newlyUnlocked: false }

    // Optimistic update — el consumidor ve el unlock inmediatamente. Actualizamos
    // el ref SÍNCRONAMENTE → la siguiente llamada en el mismo tick parte de este
    // set (con el key recién agregado) y no lo pisa.
    const optimistic = new Set(current)
    optimistic.add(key)
    achievementsRef.current = optimistic
    setAchievements(optimistic)

    if (authenticated && privyId) {
      // Lo marcamos PENDING antes del POST → si el POST falla (perfil no
      // sincronizado todavía, red caída), queda guardado en el buffer namespaced
      // y se reintenta en la próxima carga. Así el logro NUNCA se pierde.
      addPending(privyId, key)
      try {
        const json = await postUnlock(privyId, key, metadata)
        if (json?.ok) removePending(privyId, key) // confirmado en DB → fuera del buffer
        return { newlyUnlocked: !!json?.newly_unlocked }
      } catch (err) {
        console.warn('[useAchievements] unlock failed (encolado para reintento):', err)
        return { newlyUnlocked: true }
      }
    }

    // Guest: persistir en localStorage (con el set compuesto, no pisa otros keys).
    writeGuestAchievements(optimistic)
    return { newlyUnlocked: true }
  }, [authenticated, privyId])

  return { achievements, unlockedAt, isLoaded, has, unlock }
}
