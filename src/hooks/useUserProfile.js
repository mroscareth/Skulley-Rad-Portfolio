import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/authContext.js'
import { takeGameToken } from '../lib/gameSession.js'

const API_BASE = `${import.meta.env.BASE_URL}api/profile.php`

/**
 * useUserProfile — Centralized hook for user profile management.
 *
 * Syncs with backend on login, exposes profile data, score saving,
 * and gold skin / golden ticket status from server.
 */
export default function useUserProfile() {
  const { authenticated, user, ready, getAccessToken } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const syncedRef = useRef(null) // Track which privy_id we've synced

  // Extract user identity from Privy
  const privyId = user?.id || null
  const email = user?.email?.address || user?.google?.email || null
  const wallet = user?.wallet?.address || null
  const displayName = user?.google?.name || null

  // Privy's Google type doesn't have a picture field in its typed interface,
  // but the raw linkedAccounts response may include it. Try to extract it.
  const avatarUrl = (() => {
    if (!user) return null
    // Check linkedAccounts for google_oauth entry with possible picture URL
    const googleAccount = user.linkedAccounts?.find(a => a.type === 'google_oauth')
    if (googleAccount?.profilePictureUrl) return googleAccount.profilePictureUrl
    // Twitter has profilePictureUrl in its type
    if (user.twitter?.profilePictureUrl) return user.twitter.profilePictureUrl
    // Farcaster has pfp
    if (user.farcaster?.pfp) return user.farcaster.pfp
    return null
  })()

  // El backend saca el privy_id del token de Privy (privy-auth.php), no del body.
  const authHeaders = useCallback(async (extra = {}) => {
    const token = await getAccessToken?.()
    return token ? { ...extra, 'X-Privy-Token': token } : extra
  }, [getAccessToken])

  // Sync profile with backend on login
  useEffect(() => {
    if (!ready || !authenticated || !privyId) {
      // User logged out — clear profile
      if (!authenticated && profile) {
        setProfile(null)
        syncedRef.current = null
      }
      return
    }

    // Don't re-sync if we already synced this user
    if (syncedRef.current === privyId) return
    syncedRef.current = privyId

    const syncProfile = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}?action=sync`, {
          method: 'POST',
          headers: await authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            email,
            wallet,
            display_name: displayName,
            avatar_url: avatarUrl,
          }),
        })
        const json = await res.json()
        if (json.ok && json.profile) {
          setProfile(json.profile)
        }
      } catch (err) {
        console.warn('[useUserProfile] sync failed:', err)
      } finally {
        setLoading(false)
      }
    }

    syncProfile()
  }, [ready, authenticated, privyId, email, wallet, displayName, avatarUrl, authHeaders])

  // Save a game score
  const saveScore = useCallback(async (score, tier) => {
    if (!privyId || !profile) return null
    try {
      const gameToken = await takeGameToken()
      if (!gameToken) return null
      const res = await fetch(`${API_BASE}?action=save_score`, {
        method: 'POST',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          score,
          tier: tier || null,
          game_token: gameToken,
        }),
      })
      const json = await res.json()
      if (json.ok && json.profile) {
        setProfile(json.profile)
        return {
          saved: true,
          newHighScore: json.new_high_score,
          profile: json.profile,
        }
      }
      return null
    } catch (err) {
      console.warn('[useUserProfile] save_score failed:', err)
      return null
    }
  }, [privyId, profile, authHeaders])

  // Refresh profile from server
  const refreshProfile = useCallback(async () => {
    if (!privyId) return
    try {
      const res = await fetch(`${API_BASE}?action=me`, { headers: await authHeaders() })
      const json = await res.json()
      if (json.ok && json.profile) {
        setProfile(json.profile)
      }
    } catch (err) {
      console.warn('[useUserProfile] refresh failed:', err)
    }
  }, [privyId, authHeaders])

  return {
    profile,
    loading,
    privyId,
    saveScore,
    refreshProfile,
    // Convenience booleans
    hasGoldSkin: profile?.gold_skin ?? false,
    hasGoldenTicket: profile?.golden_ticket ?? false,
    highScore: profile?.high_score ?? 0,
    isAuthenticated: authenticated && !!profile,
  }
}
