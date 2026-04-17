import { useState, useEffect, useCallback } from 'react'
import scoreStore from '../lib/scoreStore.js'
import { GOLD_SKIN_THRESHOLD } from '../components/GameOverModal.jsx'

const GOLD_SKIN_LS_KEY = 'goldSkinUnlocked'

// Encapsulates the "legendary gold skin" unlock system:
//  - localStorage-backed state (unlocked + modelActive) for non-auth users.
//  - Bidirectional sync with the server profile (grant AND revoke).
//  - Live unlock detection during the sphere minigame via scoreStore subscription.
//  - Transform FX orchestration (flash + dissolve + model swap + reveal wipe).
//
// Params:
//   userProfile: from useUserProfile() — reads `profile`, `hasGoldSkin`, `isAuthenticated`.
//   sphereGameActive: boolean, gates the live-unlock scoreStore subscription.
//   gameToast: from useGameToast() — used to announce the unlock.
//
// Returns the 3 states the scene/HUD needs plus `triggerGoldSkinUnlock()` which runs
// the full FX sequence (used by the cheat terminal).
export default function useGoldSkinSystem({ userProfile, sphereGameActive, gameToast }) {
  const [goldSkinUnlocked, setGoldSkinUnlocked] = useState(() => {
    try { return localStorage.getItem(GOLD_SKIN_LS_KEY) === '1' } catch { return false }
  })
  // Controls when the gold model actually activates (delayed 1s behind FX during live unlock).
  // On fresh page load with existing unlock: immediate. On live unlock: delayed.
  const [goldSkinModelActive, setGoldSkinModelActive] = useState(() => {
    try { return localStorage.getItem(GOLD_SKIN_LS_KEY) === '1' } catch { return false }
  })
  // Drives the transform FX (flash + dissolve + reveal wipe)
  const [goldSkinTransformActive, setGoldSkinTransformActive] = useState(false)

  // Runs the full unlock FX sequence. Idempotent-ish: guarded by current unlocked state.
  const triggerGoldSkinUnlock = useCallback(() => {
    try { localStorage.setItem(GOLD_SKIN_LS_KEY, '1') } catch { }
    setGoldSkinUnlocked(true)
    // 1) Start FX immediately (flash + dissolve, hides old model)
    setGoldSkinTransformActive(true)
    // 2) Swap model 1s later (model is hidden by flash/dissolve)
    setTimeout(() => setGoldSkinModelActive(true), 1000)
    // 3) Deactivate FX at 1.3s → triggers reveal wipe in Player (1.7s)
    setTimeout(() => setGoldSkinTransformActive(false), 1300)
    try {
      gameToast?.show?.({
        title: '✨ LEGENDARY SKIN UNLOCKED!',
        body: 'Gold skin activated — you\'ve earned a store reward!',
        type: 'success',
        duration: 5000,
      })
    } catch { }
  }, [gameToast])

  // Sync gold skin FROM server profile (bidirectional: grant AND revoke).
  useEffect(() => {
    if (!userProfile?.profile) return
    if (userProfile.hasGoldSkin && !goldSkinUnlocked) {
      setGoldSkinUnlocked(true)
      setGoldSkinModelActive(true)
      try { localStorage.setItem(GOLD_SKIN_LS_KEY, '1') } catch { }
    } else if (!userProfile.hasGoldSkin && goldSkinUnlocked && userProfile.isAuthenticated) {
      setGoldSkinUnlocked(false)
      setGoldSkinModelActive(false)
      try { localStorage.removeItem(GOLD_SKIN_LS_KEY) } catch { }
    }
  }, [userProfile?.hasGoldSkin, userProfile?.profile, userProfile?.isAuthenticated, goldSkinUnlocked])

  // Live unlock detection during sphere minigame.
  useEffect(() => {
    if (!sphereGameActive || goldSkinUnlocked) return
    const unsub = scoreStore.subscribe((score) => {
      if (score >= GOLD_SKIN_THRESHOLD) {
        triggerGoldSkinUnlock()
      }
    })
    return unsub
  }, [sphereGameActive, goldSkinUnlocked, triggerGoldSkinUnlock])

  return {
    goldSkinUnlocked,
    goldSkinModelActive,
    goldSkinTransformActive,
    triggerGoldSkinUnlock,
  }
}
