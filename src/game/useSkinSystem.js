import { useState, useEffect, useCallback, useMemo } from 'react'
import scoreStore from '../lib/scoreStore.js'
import { GOLD_SKIN_THRESHOLD } from '../components/GameOverModal.jsx'
import { SKINS, getSkin } from '../lib/skinRegistry.js'
import { ACTIVE_SKIN_KEY, GOLD_SKIN_KEY, activateSkinShader, readGoldOwned } from '../lib/characterSkin.js'

// Generaliza el viejo useGoldSkinSystem a un sistema de SKINS multi-estrategia
// (ver skinRegistry.js). Mantiene el comportamiento de la dorada (GLB swap +
// FX + live-unlock en el minijuego) y agrega las skins por shader.
//
//  - Ownership: base siempre; gold por flag de perfil; shader por achievements.
//    En DEV todas las shader skins quedan owned para poder evaluarlas.
//  - `activeSkinId` persiste en localStorage. Al cambiar, dispara el modo del
//    shader global (activateSkinShader) — base = modo 0, gold = modo 6.
//  - goldSkinModelActive (derivado: activeSkinId === 'gold') es lo que Player /
//    CharacterPortrait usan para cargar el GLB dorado.

const ACTIVE_KEY = ACTIVE_SKIN_KEY
// `ownershipKnown`: ya llegaron los logros (y el perfil, si hay sesión). Hasta
// entonces no se resetea la skin activa por "no ser tuya": con sesión, el set
// de logros arranca vacío y llega del servidor un momento después, y cada
// recarga regresaba la skin a base (y la guardaba así) antes de que llegara.
export default function useSkinSystem({ userProfile, achievements, ownershipKnown = true, sphereGameActive, gameToast, unlockAchievement }) {
  const goldOwned = (userProfile?.hasGoldSkin) || readGoldOwned()

  const isOwned = useCallback((skin) => {
    if (!skin) return false
    if (skin.alwaysOwned) return true
    if (skin.id === 'gold') return !!goldOwned
    if (skin.achievementKey) {
      if (import.meta.env.DEV) return true // dev: evaluar todas las skins
      return !!achievements?.has?.(skin.achievementKey)
    }
    return false
  }, [goldOwned, achievements])

  const [activeSkinId, setActiveSkinId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'base' } catch { return 'base' }
  })
  const [goldSkinTransformActive, setGoldTransform] = useState(false)

  const skins = useMemo(
    () => SKINS.map((s) => ({ ...s, owned: isOwned(s), active: s.id === activeSkinId })),
    [isOwned, activeSkinId]
  )

  const goldSkinModelActive = activeSkinId === 'gold'

  const persistActive = useCallback((id) => {
    setActiveSkinId(id)
    try { localStorage.setItem(ACTIVE_KEY, id) } catch { }
  }, [])

  const setActiveSkin = useCallback((id) => {
    const skin = getSkin(id)
    if (!isOwned(skin)) return
    persistActive(id)
  }, [isOwned, persistActive])

  // Drive el modo del shader global + el color de stroke/ink cuando cambia la
  // skin activa (void usa líneas blancas; el resto negras).
  useEffect(() => {
    activateSkinShader(activeSkinId)
  }, [activeSkinId])

  // Si la skin activa deja de estar owned (revoke / no owned al cargar), base.
  useEffect(() => {
    if (!ownershipKnown) return
    const skin = getSkin(activeSkinId)
    if (!isOwned(skin)) persistActive('base')
  }, [ownershipKnown, isOwned, activeSkinId, persistActive])

  // Live-unlock de la dorada en el minijuego (igual que antes): al cruzar el
  // threshold, marca owned + activa + corre el FX (con swap de modelo a 1s).
  const triggerGoldSkinUnlock = useCallback(() => {
    try { localStorage.setItem(GOLD_SKIN_KEY, '1') } catch { }
    setGoldTransform(true)
    setTimeout(() => persistActive('gold'), 1000)
    setTimeout(() => setGoldTransform(false), 1300)
    try {
      gameToast?.show?.({
        title: '✨ LEGENDARY SKIN UNLOCKED!',
        body: "Gold skin activated — you've earned a store reward!",
        type: 'success',
        duration: 5000,
      })
    } catch { }
  }, [gameToast, persistActive])

  // Unlock por score en el minijuego: gold a GOLD_SKIN_THRESHOLD (5000) → FX +
  // flag. (Oil ya NO es por score — ahora se gana con el rayo + 2 colores al
  // mismo portal; ver effect en App.jsx.)
  useEffect(() => {
    if (!sphereGameActive) return
    const unsub = scoreStore.subscribe((score) => {
      if (score >= GOLD_SKIN_THRESHOLD && !goldOwned) triggerGoldSkinUnlock()
    })
    return unsub
  }, [sphereGameActive, goldOwned, triggerGoldSkinUnlock])

  return {
    skins,
    activeSkinId,
    setActiveSkin,
    // Compat con Player / CharacterPortrait / App (lenguaje gold previo).
    goldSkinModelActive,
    goldSkinTransformActive,
    goldSkinUnlocked: goldOwned,
    triggerGoldSkinUnlock,
  }
}
