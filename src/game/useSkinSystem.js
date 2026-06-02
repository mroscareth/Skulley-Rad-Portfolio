import { useState, useEffect, useCallback, useMemo } from 'react'
import scoreStore from '../lib/scoreStore.js'
import { GOLD_SKIN_THRESHOLD } from '../components/GameOverModal.jsx'
import { SKINS, getSkin } from '../lib/skinRegistry.js'
import { setActiveSkinShader } from '../lib/skinShaders.js'

// Generaliza el viejo useGoldSkinSystem a un sistema de SKINS multi-estrategia
// (ver skinRegistry.js). Mantiene el comportamiento de la dorada (GLB swap +
// FX + live-unlock en el minijuego) y agrega las skins por shader.
//
//  - Ownership: base siempre; gold por flag de perfil; shader por achievements.
//    En DEV todas las shader skins quedan owned para poder evaluarlas.
//  - `activeSkinId` persiste en localStorage. Al cambiar, dispara el modo del
//    shader global (setActiveSkinShader) — base/gold = modo 0.
//  - goldSkinModelActive (derivado: activeSkinId === 'gold') es lo que Player /
//    CharacterPortrait usan para cargar el GLB dorado.

const ACTIVE_KEY = 'skulley_active_skin'
const GOLD_LS_KEY = 'goldSkinUnlocked'

function readGoldLocal() {
  try { return localStorage.getItem(GOLD_LS_KEY) === '1' } catch { return false }
}

export default function useSkinSystem({ userProfile, achievements, sphereGameActive, gameToast, unlockAchievement }) {
  const goldOwned = (userProfile?.hasGoldSkin) || readGoldLocal()

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
    const skin = getSkin(activeSkinId)
    const line = skin?.lineColor || [0, 0, 0]
    const forced = skin?.forcedColors || null
    if (skin?.type === 'shader') setActiveSkinShader(skin.shaderMode || 0, skin.amount ?? 1, line, forced)
    else setActiveSkinShader(0, 1, line, forced)
  }, [activeSkinId])

  // Si la skin activa deja de estar owned (revoke / no owned al cargar), base.
  useEffect(() => {
    const skin = getSkin(activeSkinId)
    if (!isOwned(skin)) persistActive('base')
  }, [isOwned, activeSkinId, persistActive])

  // Live-unlock de la dorada en el minijuego (igual que antes): al cruzar el
  // threshold, marca owned + activa + corre el FX (con swap de modelo a 1s).
  const triggerGoldSkinUnlock = useCallback(() => {
    try { localStorage.setItem(GOLD_LS_KEY, '1') } catch { }
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
