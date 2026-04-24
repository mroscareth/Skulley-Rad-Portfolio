// Quest Engine — state machine para el flujo de quests de M.A.D.R.E.
//
// Reemplaza el approach conversacional anterior (keyword matching + pool
// de respuestas). Ahora el user avanza por 9 quests en secuencia lineal.
// Cada quest tiene: briefing → acción del user fuera de terminal → debrief.
//
// State lives in localStorage.skulley_madre_terminal (mismo key que antes
// para preservar el skulleyPath/signal data). Nuevos campos:
//   currentQuestId: string | null
//   questPhase: 'briefing' | 'awaiting_action' | 'ready_for_debrief' | 'debriefed' | 'complete'
//   completedQuests: string[]
//   questProgress: { [questId]: { pieceClicked?, docSeen?, songListened?, answer? } }
//   loreUnlocked: string[]
//   archiveDocs: string[]   // ids de docs visibles en /fragmented-memories
//
// NO se llama a un LLM. Todo data-driven desde questData.js.

import { QUESTS, QUESTS_BY_ID, FIRST_QUEST_ID, ARCHIVE_DOCS } from './questData.js'

const STORAGE_KEY = 'skulley_madre_terminal'
const STATE_VERSION = 2   // bumped from 1 → migrate old conversation state

// ---------------------------------------------------------------------------
// STATE SHAPE & PERSISTENCE
// ---------------------------------------------------------------------------

const defaultState = () => ({
  version: STATE_VERSION,

  // Quest log
  currentQuestId: FIRST_QUEST_ID,
  questPhase: 'briefing',           // user opens terminal first time → Q1 briefing
  completedQuests: [],
  questProgress: {},
  loreUnlocked: [],
  archiveDocs: [],                  // docs visibles en Memorias Fragmentadas

  // Skulley path (canon paralelo, se conserva del engine viejo)
  skulleyPath: {
    active: false,
    stage: 0,
    verificationIndex: 0,
    completed: false,
    failed: false,
  },

  // Infra
  visitCount: 0,
  lastVisit: 0,
  arrivalSignal: null,              // ?signal=XXX capturado al aterrizar
  cooldownUntil: 0,

  // Preferencias del user
  prefs: {
    ttsEnabled: false,              // CYBER_VOX opt-in
    bipbopMuted: false,             // botón mute del robot
  },
})

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed) return defaultState()
    // Migrate from v1 (conversation-based) → v2 (quest-based)
    if (parsed.version !== STATE_VERSION) {
      return migrateFromV1(parsed)
    }
    return { ...defaultState(), ...parsed }
  } catch {
    return defaultState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // silencioso
  }
}

export function resetState() {
  const s = defaultState()
  saveState(s)
  return s
}

// Migrate old conversation state → new quest state. Preserve skulley path
// + arrivalSignal + visitCount if they existed.
function migrateFromV1(oldState) {
  const fresh = defaultState()
  return {
    ...fresh,
    skulleyPath: oldState.skulleyPath || fresh.skulleyPath,
    arrivalSignal: oldState.arrivalSignal || null,
    visitCount: oldState.visitCount || 0,
    lastVisit: oldState.lastVisit || 0,
  }
}

// ---------------------------------------------------------------------------
// QUEST INTROSPECTION
// ---------------------------------------------------------------------------

export function getCurrentQuest(state) {
  if (!state.currentQuestId) return null
  return QUESTS_BY_ID[state.currentQuestId] || null
}

export function getQuestByIndex(i) {
  return QUESTS.find(q => q.index === i) || null
}

// Total progress en la barra (0-9)
export function getQuestProgress(state) {
  return {
    completed: state.completedQuests.length,
    total: QUESTS.length,
    currentIndex: getCurrentQuest(state)?.index ?? (state.completedQuests.length + 1),
  }
}

// ---------------------------------------------------------------------------
// DETECTION HOOKS — llamados desde componentes del sitio cuando el user
// ejecuta la acción requerida por la quest activa.
// ---------------------------------------------------------------------------

// Hook genérico de lectura+escritura contra localStorage. Los componentes
// del sitio no necesitan cargar todo el state — solo registrar que algo pasó.
function mutateState(mutator) {
  const state = loadState()
  const next = mutator(state)
  if (next && next !== state) saveState(next)
  return next
}

/**
 * Usuario clickeó una pieza del archivo. Marca progreso de Q1 si aplica.
 */
export function trackPieceClicked(pieceId, section = 'work') {
  return mutateState(state => {
    const q = getCurrentQuest(state)
    if (!q) return state
    if (q.completion.type !== 'click_and_answer') return state
    if (q.completion.clickTarget?.section && q.completion.clickTarget.section !== section) return state
    const progress = { ...state.questProgress }
    progress[q.id] = { ...(progress[q.id] || {}), pieceClicked: pieceId }
    // Si la fase era 'awaiting_action', avanza a 'ready_for_debrief' (pero
    // todavía falta la text_answer — el terminal lo detecta al abrir).
    return { ...state, questProgress: progress }
  })
}

/**
 * Usuario vio un documento en /fragmented-memories.
 */
export function trackArchiveDocSeen(docId) {
  return mutateState(state => {
    const q = getCurrentQuest(state)
    if (!q) return state
    if (q.completion.type !== 'archive_and_answer') return state
    if (q.completion.docId !== docId) return state
    const progress = { ...state.questProgress }
    progress[q.id] = { ...(progress[q.id] || {}), docSeen: true }
    return { ...state, questProgress: progress }
  })
}

/**
 * Usuario terminó de escuchar una canción (al menos 90% del duration).
 */
export function trackSongListened(songId, seconds) {
  return mutateState(state => {
    const q = getCurrentQuest(state)
    if (!q) return state
    if (q.completion.type !== 'song_and_answer') return state
    const progress = { ...state.questProgress }
    progress[q.id] = { ...(progress[q.id] || {}), songListened: { id: songId, seconds } }
    return { ...state, questProgress: progress }
  })
}

/**
 * Usuario contestó texto libre cuando la terminal se lo pidió.
 * Devuelve { state, ok, interpolated } — ok indica si el answer pasa el check.
 */
export function submitAnswer(answer) {
  const state = loadState()
  const q = getCurrentQuest(state)
  if (!q) return { state, ok: false }

  const normalized = normalizeText(answer)
  const completion = q.completion

  let ok = false
  let variant = null

  if (completion.type === 'click_and_answer') {
    // Q1-style: acepta cualquier texto o "no sé"
    if (!normalized || /^no (se|sé|idea|clue)?$|^idk$|^dunno$/i.test(answer.trim())) {
      variant = 'no_answer'
      ok = true
    } else {
      ok = true
    }
  } else if (completion.type === 'archive_and_answer') {
    // Acepta si hace match contra acceptedAnswers o acceptedKeywords
    if (completion.acceptedAnswers) {
      ok = completion.acceptedAnswers.some(a =>
        fuzzyMatch(normalized, normalize(a))
      )
    }
    if (!ok && completion.acceptedKeywords) {
      ok = completion.acceptedKeywords.some(kw =>
        normalized.includes(normalize(kw))
      )
    }
  } else if (completion.type === 'song_and_answer') {
    // Espera un número (segundo)
    const n = parseInt(answer, 10)
    ok = !isNaN(n) && n >= 0
  } else if (completion.type === 'text_only') {
    if (completion.acceptedKeywords) {
      ok = completion.acceptedKeywords.some(kw =>
        normalized.includes(normalize(kw))
      )
    }
    if (!ok && completion.fallbackPolicy === 'accept_any' && normalized.length > 0) {
      ok = true
    }
  }

  if (!ok) return { state, ok: false }

  // Commit answer to progress
  const progress = { ...state.questProgress }
  progress[q.id] = { ...(progress[q.id] || {}), answer: answer, variant }
  const newState = { ...state, questProgress: progress, questPhase: 'ready_for_debrief' }
  saveState(newState)
  return { state: newState, ok: true, variant }
}

/**
 * Usuario clickeó "continue" para una quest de tipo click_only (Q7).
 */
export function submitClick() {
  const state = loadState()
  const q = getCurrentQuest(state)
  if (!q) return state
  if (q.completion.type !== 'click_only' && q.completion.type !== 'cinematic_sequence') return state
  const progress = { ...state.questProgress }
  progress[q.id] = { ...(progress[q.id] || {}), confirmed: true }
  const newState = { ...state, questProgress: progress, questPhase: 'ready_for_debrief' }
  saveState(newState)
  return newState
}

/**
 * Usuario escogió opción (Q9 choice).
 */
export function submitChoice(choiceId) {
  const state = loadState()
  const q = getCurrentQuest(state)
  if (!q) return { state, ok: false }
  if (q.completion.type !== 'choice') return { state, ok: false }
  const valid = q.completion.choices.some(c => c.id === choiceId)
  if (!valid) return { state, ok: false }
  const progress = { ...state.questProgress }
  progress[q.id] = { ...(progress[q.id] || {}), choice: choiceId }
  const newState = { ...state, questProgress: progress, questPhase: 'ready_for_debrief' }
  saveState(newState)
  return { state: newState, ok: true, choice: choiceId }
}

// ---------------------------------------------------------------------------
// PHASE TRANSITIONS
// ---------------------------------------------------------------------------

/**
 * Marca la briefing como entregada → user sale a ejecutar.
 */
export function markBriefingDelivered(state) {
  return { ...state, questPhase: 'awaiting_action' }
}

/**
 * Check si la acción física (fuera de terminal) está completa. Usado por
 * la terminal al abrirse, para decidir si hay que pedir el answer o todavía
 * esperar acción.
 */
export function isPhysicalActionComplete(state) {
  const q = getCurrentQuest(state)
  if (!q) return false
  const progress = state.questProgress?.[q.id] || {}
  switch (q.completion.type) {
    case 'click_and_answer':      return !!progress.pieceClicked
    case 'archive_and_answer':    return !!progress.docSeen
    case 'song_and_answer':       return !!progress.songListened
    case 'text_only':             return true  // no hay acción física
    case 'click_only':            return true  // el "click" es el answer
    case 'cinematic_sequence':    return true  // el engine lo dispara
    case 'choice':                return true
    default:                      return false
  }
}

/**
 * Entrega el debrief con interpolación. Devuelve { text, newState }.
 * Si la quest tiene siguiente, avanza. Si no, marca 'complete'.
 */
export function deliverDebrief(lang = 'en') {
  const state = loadState()
  const q = getCurrentQuest(state)
  if (!q) return { text: '', newState: state }

  const progress = state.questProgress[q.id] || {}
  let text = ''

  // Resolver texto según variante / choice
  if (q.debrief.byChoice) {
    const choice = progress.choice || 'dunno'
    text = q.debrief.byChoice[choice]?.[lang] || q.debrief.byChoice[choice]?.en || ''
  } else if (progress.variant && q.debrief.variant && q.debrief.variant.condition === progress.variant) {
    text = q.debrief.variant[lang] || q.debrief.variant.en
  } else {
    text = q.debrief.primary[lang] || q.debrief.primary.en
  }

  // Interpolaciones
  text = text
    .replace(/\{piece\}/g, prettifyPieceId(progress.pieceClicked))
    .replace(/\{answer\}/g, (progress.answer || '').trim())
    .replace(/\{second\}/g, (progress.answer || '').trim())

  // Commit progress: marca completada + avanza a next.
  // archiveUnlock ya se aplicó en getBriefing() — no lo repetimos aquí.
  const completed = [...state.completedQuests, q.id]
  const lore = q.loreUnlock && !state.loreUnlocked.includes(q.loreUnlock)
    ? [...state.loreUnlocked, q.loreUnlock]
    : state.loreUnlocked

  const newState = {
    ...state,
    completedQuests: completed,
    loreUnlocked: lore,
    currentQuestId: q.nextQuestId,
    questPhase: q.nextQuestId ? 'briefing' : 'complete',
  }
  saveState(newState)
  return { text, newState, effects: q.effects || [], ctaOnDebrief: q.ctaOnDebrief || null }
}

/**
 * Entrega el briefing de la quest actual. Devuelve { text, effects }.
 * Side-effect: si la quest desbloquea un archive doc, lo hace visible aquí
 * (el user necesita verlo DURANTE la quest, no después).
 */
export function getBriefing(state, lang = 'en') {
  const q = getCurrentQuest(state)
  if (!q) return { text: '', effects: [] }
  const text = q.briefing[lang] || q.briefing.en

  // Unlock archive doc at briefing time — user needs it visible during the quest
  if (q.archiveUnlock && !state.archiveDocs.includes(q.archiveUnlock)) {
    const next = { ...state, archiveDocs: [...state.archiveDocs, q.archiveUnlock] }
    saveState(next)
  }

  return { text, effects: q.effects || [], quest: q }
}

export function getObjectiveHint(state, lang = 'en') {
  const q = getCurrentQuest(state)
  if (!q) return ''
  return q.objectiveHint?.[lang] || q.objectiveHint?.en || ''
}

// ---------------------------------------------------------------------------
// ARCHIVE DOCS (Memorias Fragmentadas)
// ---------------------------------------------------------------------------

export function getVisibleArchiveDocs(state) {
  return state.archiveDocs
    .map(id => ARCHIVE_DOCS[id])
    .filter(Boolean)
}

export function getAllArchiveDocIds() {
  return Object.keys(ARCHIVE_DOCS)
}

export function isDocUnlocked(state, docId) {
  return state.archiveDocs.includes(docId)
}

// ---------------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------------

function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(text) {
  return normalize(text)
}

function fuzzyMatch(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  // Levenshtein-lite: accept if within 1 edit for short words
  if (Math.abs(a.length - b.length) <= 2 && levenshtein(a, b) <= 1) return true
  return false
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const dp = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      if (a[i - 1] === b[j - 1]) dp[j] = prev
      else dp[j] = 1 + Math.min(prev, dp[j - 1], dp[j])
      prev = tmp
    }
  }
  return dp[b.length]
}

function prettifyPieceId(id) {
  if (!id) return 'Something'
  // Convert 'ethereans' → 'The Ethereans', 'heads' → '3D Heads', etc.
  const labels = {
    ethereans: 'The Ethereans',
    heads: '3D Heads',
    '2dheads': '2D Heads',
    arttoys: 'Art Toys',
    heritage: 'Heritage Design Studio',
  }
  return labels[id] || id
}

// ---------------------------------------------------------------------------
// SIGNAL DETECTION (preserved from v1)
// ---------------------------------------------------------------------------

export function captureArrivalSignal(searchString) {
  if (typeof window === 'undefined') return
  const raw = searchString != null ? searchString : window.location.search
  try {
    const params = new URLSearchParams(raw)
    const signal = params.get('signal')
    if (!signal) return
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(signal)) return
    const state = loadState()
    if (state.arrivalSignal) return
    saveState({ ...state, arrivalSignal: signal })
  } catch {
    // silencioso
  }
}

// ---------------------------------------------------------------------------
// VISIT TRACKING
// ---------------------------------------------------------------------------

export function incrementVisit(state) {
  return { ...state, visitCount: state.visitCount + 1, lastVisit: Date.now() }
}

// ---------------------------------------------------------------------------
// PREFERENCES
// ---------------------------------------------------------------------------

export function setPref(key, value) {
  const state = loadState()
  const prefs = { ...(state.prefs || {}), [key]: value }
  const next = { ...state, prefs }
  saveState(next)
  return next
}
