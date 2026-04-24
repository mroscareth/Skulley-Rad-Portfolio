// M.A.D.R.E. conversation engine.
//
// Responsabilidades:
//   1. Seleccionar respuesta apropiada según input + estado + acto.
//   2. Persistir estado en localStorage (historia, acto, visitas, used ids).
//   3. Gestionar presencia/cooldowns ("not now, they are listening").
//   4. Aplicar efectos narrativos (cut, redact, delay, typo, glitch).
//   5. Detectar Skulley path y manejar su state-machine aislado.
//
// NO hay modelo LLM — todo es matching sobre los pools de madreResponses.js.

import {
  ACTS,
  RESPONSES,
  SKULLEY_TRIGGERS,
  SKULLEY_PATH,
  INTERRUPTIONS,
  RECONNECTS,
  EFFECT_CHANCE_BY_ACT,
  ASK_OWN_CHOICE,
  ASK_OWN_DEFLECTIONS,
  FREE_TEXT_INVITES,
} from './madreResponses.js'

// Umbral mínimo de score para que un match de keyword sea "decente".
// Si el mejor score está debajo de esto Y el usuario estaba en free-text
// abierto vía escape hatch, deflectamos en canon en lugar de alucinar.
const MIN_FREETEXT_MATCH_SCORE = 3

const STORAGE_KEY = 'skulley_madre_terminal'
const STATE_VERSION = 1

// Default state shape
const defaultState = () => ({
  version: STATE_VERSION,
  currentAct: ACTS.INTRO,
  usedUniqueIds: [],        // respuestas con unique:true ya servidas
  visitCount: 0,            // incrementado al abrir la terminal
  lastVisit: 0,             // timestamp epoch ms
  sessionMessages: 0,       // mensajes del usuario en la sesión actual
  totalMessages: 0,         // acumulado histórico
  visitedSections: [],      // quest del Acto 4 — secciones del sitio visitadas
  questCompleted: false,    // true cuando visitedSections cubre el umbral
  arrivalSignal: null,      // UTM ?signal=XXX — setteado al aterrizar desde redes
  skulleyPath: {
    active: false,
    stage: 0,
    verificationIndex: 0,
    completed: false,
    failed: false,
  },
  cooldownUntil: 0,         // epoch ms; interrumpe si > now
  lastResponseId: null,     // para evitar repetir la misma respuesta consecutiva
  history: [],              // últimos N exchanges (rolling)
})

// Secciones que cuentan para el quest del Acto 4. Excluye 'home' (es default).
const QUEST_SECTIONS = ['section1', 'section2', 'section3', 'section4', 'section5', 'section6']
// Umbral para marcar questCompleted. Idealmente todas, pragmáticamente 4.
const QUEST_COMPLETION_THRESHOLD = 4

const HISTORY_MAX = 24

// ---------------------------------------------------------------------------
// STATE PERSISTENCE
// ---------------------------------------------------------------------------

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== STATE_VERSION) return defaultState()
    // Merge con defaults por si se añaden campos nuevos en versiones futuras
    return { ...defaultState(), ...parsed }
  } catch {
    return defaultState()
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota exceeded u otra falla — silencioso, la terminal no es crítica
  }
}

export function resetState() {
  const s = defaultState()
  saveState(s)
  return s
}

// ---------------------------------------------------------------------------
// INPUT NORMALIZATION & MATCHING
// ---------------------------------------------------------------------------

function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Levenshtein distance — cuántos caracteres hay que cambiar para transformar
// a en b. Usado para tolerancia a typos en las respuestas del Skulley path.
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

// Tolerancia a typos según largo de la respuesta esperada.
// Idea: ~99% de precisión = 1 typo en cortas, 2 en medias, 3 en largas.
function toleranceForLength(len) {
  if (len <= 3) return 0
  if (len <= 6) return 1
  if (len <= 10) return 1
  if (len <= 16) return 2
  return 3
}

// Fuzzy match para respuestas del Skulley path. Normaliza ambas strings,
// acepta: (a) substring match exacto, (b) Levenshtein distance del input
// completo contra la esperada dentro de la tolerancia, (c) sliding window
// sobre el input con la misma tolerancia (para handling de frases con palabras
// extras como "mi respuesta es caty").
export function fuzzyMatchAnswer(userInput, expected) {
  const input = normalize(userInput)
  const exp = normalize(expected)
  if (!input || !exp) return false
  // (a) substring exacto
  if (input.includes(exp)) return true
  const tol = toleranceForLength(exp.length)
  // (b) distance total
  if (levenshtein(input, exp) <= tol) return true
  // (c) sliding window — chequea cada segmento del input del mismo largo que
  // exp ± tol, por si el usuario metió palabras de más.
  const minLen = Math.max(1, exp.length - tol)
  const maxLen = exp.length + tol
  for (let start = 0; start <= Math.max(0, input.length - minLen); start++) {
    for (let windowLen = minLen; windowLen <= maxLen && start + windowLen <= input.length; windowLen++) {
      const chunk = input.slice(start, start + windowLen)
      if (levenshtein(chunk, exp) <= tol) return true
    }
  }
  return false
}

function scoreMatch(response, normalizedInput, inputTokens) {
  // Opciones (send) son matches exactos de alta confianza
  // Los triggers son palabras clave — cada match suma
  if (!response.triggers || response.triggers.length === 0) {
    return response.tags?.includes('elusive') || response.tags?.includes('fallback') ? 0.01 : 0
  }

  let score = 0
  for (const trigger of response.triggers) {
    const normTrigger = normalize(trigger)
    if (!normTrigger) continue
    // Match exacto sobre el input completo (muy alto)
    if (normalizedInput === normTrigger) score += 10
    // Match como substring
    else if (normalizedInput.includes(normTrigger)) score += 3
    // Match palabra por palabra
    else if (inputTokens.includes(normTrigger)) score += 2
  }
  return score
}

function meetsRequires(response, state) {
  const r = response.requires
  if (!r) return true
  if (r.minMessages != null && state.sessionMessages < r.minMessages) return false
  if (r.minVisits != null && state.visitCount < r.minVisits) return false
  if (r.priorId != null && state.lastResponseId !== r.priorId) return false
  // Quest requirement (Acto 4): verifica visitedSections.length contra min/max
  if (r.quest) {
    const visited = state.visitedSections?.length || 0
    if (r.quest.min != null && visited < r.quest.min) return false
    if (r.quest.max != null && visited > r.quest.max) return false
  }
  // Signal requirement: respuesta solo aplica si el usuario entró con
  // ?signal=XXX capturado en la URL de arrival.
  if (r.hasSignal === true && !state.arrivalSignal) return false
  if (r.hasSignal === false && state.arrivalSignal) return false
  return true
}

// ---------------------------------------------------------------------------
// RESPONSE SELECTION
// ---------------------------------------------------------------------------

function weightedPick(scored) {
  if (scored.length === 0) return null
  const totalWeight = scored.reduce((s, x) => s + (x.weight || 1), 0)
  let r = Math.random() * totalWeight
  for (const x of scored) {
    r -= (x.weight || 1)
    if (r <= 0) return x.response
  }
  return scored[scored.length - 1].response
}

export function selectResponse(userInput, state, opts = {}) {
  // opts.isFreeText — true si el usuario está en free-text abierto (escape
  // hatch o Act 5 invite). En ese caso aplicamos umbral más estricto y si no
  // hay match decente, devolvemos deflección en canon.
  const isFreeText = !!opts.isFreeText
  const normalizedInput = normalize(userInput)
  const inputTokens = normalizedInput.split(' ').filter(Boolean)

  // 1. Skulley path check (works from any act)
  if (!state.skulleyPath.active && matchesSkulleyTrigger(normalizedInput)) {
    return { type: 'skulley_trigger', skulleyStage: 0 }
  }

  // 1b. Escape hatch choice → abre free text invite
  if (userInput === '__ask__') {
    return { type: 'free_text_invite', mode: 'ask_own' }
  }
  // 1c. Act 5 "pregúntamelo tú" → abre free text invite
  if (userInput === '__invite_question__') {
    return { type: 'free_text_invite', mode: 'invite_act5' }
  }

  // 2. If Skulley path is active, route through its state machine
  if (state.skulleyPath.active && !state.skulleyPath.completed && !state.skulleyPath.failed) {
    return handleSkulleyPath(userInput, state)
  }

  // 2b. PRIORITY: si el usuario acaba de completar el quest del Acto 4, lo
  // primero que M.A.D.R.E. va a decir es el acknowledgment del completion.
  // Este despacho tiene prioridad sobre cualquier matching de keywords.
  if (
    state.currentAct === ACTS.RECRUIT &&
    state.questCompleted &&
    !state.usedUniqueIds.includes('act4_complete_01')
  ) {
    const completeResponse = RESPONSES.find(r => r.id === 'act4_complete_01')
    if (completeResponse) return { type: 'response', response: completeResponse }
  }

  // 3. Build candidate pool: act<=current, not used-if-unique, requirements met
  const candidates = RESPONSES.filter(r =>
    r.act <= state.currentAct &&
    !(r.unique && state.usedUniqueIds.includes(r.id)) &&
    r.id !== state.lastResponseId && // evita repetir 2 veces seguidas
    meetsRequires(r, state)
  )

  // 4. Score each candidate
  const scored = candidates
    .map(r => ({
      response: r,
      score: scoreMatch(r, normalizedInput, inputTokens) * (r.weight || 1),
      weight: r.weight || 1,
    }))
    .filter(s => s.score > 0)

  // 5. If matches exist, pick from top-scoring group (weighted random within)
  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score)
    const topScore = scored[0].score

    // Free-text mode: si el mejor match no llega al umbral mínimo, deflectar.
    // Esto previene hallucinations cuando el usuario pregunta algo random en
    // el escape hatch.
    if (isFreeText && topScore < MIN_FREETEXT_MATCH_SCORE) {
      return { type: 'free_text_deflect' }
    }

    const topGroup = scored.filter(s => s.score >= topScore * 0.6) // ±40% del tope
    const picked = weightedPick(topGroup)
    if (picked) return { type: 'response', response: picked }
  }

  // Free-text sin matches: deflect inmediato
  if (isFreeText) {
    return { type: 'free_text_deflect' }
  }

  // 6. Fallback: elusive/fallback tagged responses for current act
  const fallbacks = RESPONSES.filter(r =>
    r.act <= state.currentAct &&
    (r.tags?.includes('elusive') || r.tags?.includes('fallback')) &&
    !(r.unique && state.usedUniqueIds.includes(r.id)) &&
    r.id !== state.lastResponseId
  )
  if (fallbacks.length > 0) {
    const pick = fallbacks[Math.floor(Math.random() * fallbacks.length)]
    return { type: 'response', response: pick }
  }

  // 7. Last resort: generic acknowledgment
  return {
    type: 'response',
    response: {
      id: 'synth_fallback',
      text: {
        en: 'Noted. Continue.',
        es: 'Anotado. Continúa.',
      },
      choices: null,
    },
  }
}

// ---------------------------------------------------------------------------
// FIRST CONTACT / GREETING
// ---------------------------------------------------------------------------

export function getOpeningResponse(state) {
  // PRIORITY: si el usuario completó el quest del Acto 4 y regresa, el
  // opening debe ser el acknowledgment (no un greeting genérico).
  if (
    state.currentAct === ACTS.RECRUIT &&
    state.questCompleted &&
    !state.usedUniqueIds.includes('act4_complete_01')
  ) {
    const completeResponse = RESPONSES.find(r => r.id === 'act4_complete_01')
    if (completeResponse) return { type: 'response', response: completeResponse }
  }

  // Returning visitor?
  const isReturning = state.visitCount > 1

  const opening = RESPONSES.filter(r =>
    r.tags?.includes('opening') &&
    r.act <= state.currentAct &&
    !(r.unique && state.usedUniqueIds.includes(r.id)) &&
    (isReturning ? r.tags.includes('return') : !r.tags.includes('return')) &&
    meetsRequires(r, state)
  )

  if (opening.length === 0) {
    // Si ya los usamos todos, pick uno genérico de la sesión inicial
    const anyOpening = RESPONSES.filter(r =>
      r.tags?.includes('opening') &&
      r.act <= state.currentAct &&
      !r.tags.includes('return') &&
      r.id !== state.lastResponseId
    )
    if (anyOpening.length > 0) {
      const pick = anyOpening[Math.floor(Math.random() * anyOpening.length)]
      return { type: 'response', response: pick }
    }
  }

  const pick = weightedPick(opening.map(r => ({ response: r, weight: r.weight || 1 })))
  if (pick) return { type: 'response', response: pick }

  // Último recurso
  return {
    type: 'response',
    response: RESPONSES.find(r => r.id === 'act0_open_01') || RESPONSES[0],
  }
}

// ---------------------------------------------------------------------------
// SKULLEY PATH STATE MACHINE
// ---------------------------------------------------------------------------

function matchesSkulleyTrigger(normalizedInput) {
  return SKULLEY_TRIGGERS.some(trigger => {
    const normTrigger = normalize(trigger)
    return normalizedInput === normTrigger || normalizedInput.includes(normTrigger)
  })
}

function handleSkulleyPath(userInput, state) {
  const stage = state.skulleyPath.stage

  // Stage 1 → 2+: verification questions
  if (stage >= 1) {
    const qIdx = state.skulleyPath.verificationIndex
    const question = SKULLEY_PATH.verification[qIdx]
    if (!question) {
      // No más preguntas — success
      return { type: 'skulley_success' }
    }

    // Fuzzy match: case-insensitive, sin acentos, tolera 1-3 typos según
    // largo de la respuesta esperada. Ver fuzzyMatchAnswer.
    const matches = (question.expectedAnswers || []).some(exp =>
      fuzzyMatchAnswer(userInput, exp)
    )

    if (matches) {
      // Avanzar a siguiente pregunta o success
      if (qIdx + 1 >= SKULLEY_PATH.verification.length) {
        return { type: 'skulley_success' }
      }
      return { type: 'skulley_next_question', nextIndex: qIdx + 1 }
    } else {
      return { type: 'skulley_failure' }
    }
  }

  // Stage 0 al dispararse el trigger — lo maneja el componente con la pausa larga
  return { type: 'skulley_stage0' }
}

// ---------------------------------------------------------------------------
// EFFECTS APPLICATION
// ---------------------------------------------------------------------------

// Decide si una respuesta recibe un efecto aleatorio adicional según el acto.
// Los efectos explícitos en response.effects siempre se aplican.
//
// IMPORTANTE: NO aplicamos 'redact' ni 'cut' aleatoriamente — eso causaba
// tapados absurdos en palabras irrelevantes. Esos efectos solo se aplican
// cuando la respuesta los declara explícitamente en su campo `effects`,
// escritos con intención narrativa (palabras sensibles específicas).
// El único efecto aleatorio que sí tiene sentido es 'delay' — M.A.D.R.E.
// ocasionalmente se toma un respiro antes de responder.
export function resolveEffects(response, act) {
  const explicit = response.effects || []
  const result = new Set(explicit)
  const chance = EFFECT_CHANCE_BY_ACT[act] ?? 0.05
  if (Math.random() < chance) {
    result.add('delay')
  }
  return Array.from(result)
}

// Aplica efectos de texto al string final. Solo implementa 'cut' actualmente.
// Para 'redact' (palabras tapadas con ███), escribir los bloques inline en
// el texto de la respuesta — es más controlado y legible que aleatorizar.
// Devuelve { text, hadCut } — hadCut indica si el texto fue cortado (permite
// disparar un "apologies" de reconexión después).
export function applyTextEffects(text, effects) {
  let result = text
  let hadCut = false

  if (effects.includes('cut')) {
    // Cortar después de un 60-80% del texto. Lo suficientemente tarde para
    // que se sienta como una interrupción (no una frase inconclusa desde el
    // inicio) pero antes del final natural.
    const ratio = 0.6 + Math.random() * 0.2
    const cutAt = Math.floor(result.length * ratio)
    // Buscar el próximo espacio para no cortar a medio-palabra
    let adjusted = cutAt
    while (adjusted < result.length && result[adjusted] !== ' ') adjusted++
    result = result.slice(0, Math.min(adjusted, result.length)) + '___'
    hadCut = true
  }

  return { text: result, hadCut }
}

// ---------------------------------------------------------------------------
// PRESENCE / COOLDOWN
// ---------------------------------------------------------------------------

// Determina si M.A.D.R.E. debería estar "not now" al abrir la terminal.
// Reglas:
//   - Si cooldownUntil > now → not available
//   - 5% random al abrir (solo fuera de primera visita)
//   - Si el usuario envió 5+ msgs muy rápido → cooldown 30-60s
export function checkAvailability(state) {
  const now = Date.now()
  if (state.cooldownUntil > now) {
    return { available: false, reason: 'cooldown', untilMs: state.cooldownUntil }
  }
  if (state.visitCount >= 1 && Math.random() < 0.05) {
    const cooldownMs = 20000 + Math.floor(Math.random() * 40000)
    return { available: false, reason: 'surveillance', untilMs: now + cooldownMs }
  }
  return { available: true }
}

export function pickInterruption() {
  return INTERRUPTIONS[Math.floor(Math.random() * INTERRUPTIONS.length)]
}

export function pickReconnect() {
  return RECONNECTS[Math.floor(Math.random() * RECONNECTS.length)]
}

// Pesca una deflección aleatoria para cuando el free-text no matchea.
export function pickAskOwnDeflection() {
  return ASK_OWN_DEFLECTIONS[Math.floor(Math.random() * ASK_OWN_DEFLECTIONS.length)]
}

// Fallback mínimo cuando una respuesta no declara sus propias choices. NO
// inyectamos las universal "qué preguntar ahora" del acto porque quedan
// desconectadas del texto que M.A.D.R.E. acaba de decir (rompe el hilo
// narrativo). Solo el escape hatch — si el user quiere hacer una pregunta,
// la escribe. Cada respuesta narrativamente importante debe traer sus
// propias choices inline.
export function getUniversalChoices(_state) {
  return [ASK_OWN_CHOICE]
}

// Devuelve el texto del invite de free-text según el modo.
export function getFreeTextInvite(mode) {
  return FREE_TEXT_INVITES[mode] || FREE_TEXT_INVITES.ask_own
}

// ---------------------------------------------------------------------------
// STATE MUTATIONS (pure — devuelven nuevo state)
// ---------------------------------------------------------------------------

export function commitResponse(state, response) {
  const newState = { ...state }
  if (response.unique) {
    if (!newState.usedUniqueIds.includes(response.id)) {
      newState.usedUniqueIds = [...newState.usedUniqueIds, response.id]
    }
  }
  newState.lastResponseId = response.id
  if (response.advances != null && response.advances > newState.currentAct) {
    newState.currentAct = response.advances
  }
  return newState
}

export function commitUserMessage(state, text) {
  const entry = { role: 'user', text, ts: Date.now() }
  const history = [...state.history, entry].slice(-HISTORY_MAX)
  return {
    ...state,
    history,
    sessionMessages: state.sessionMessages + 1,
    totalMessages: state.totalMessages + 1,
  }
}

export function commitMadreMessage(state, text, responseId = null) {
  const entry = { role: 'madre', text, ts: Date.now(), id: responseId }
  const history = [...state.history, entry].slice(-HISTORY_MAX)
  return { ...state, history }
}

export function incrementVisit(state) {
  return { ...state, visitCount: state.visitCount + 1, lastVisit: Date.now(), sessionMessages: 0 }
}

// Cross-site tracking: el App.jsx llama esta función cuando el usuario entra
// a una sección nueva. Alimenta el quest del Acto 4.
// Side-effect: lee y escribe localStorage directamente (para que App.jsx no
// tenga que cargar el state completo del terminal).
export function trackSectionVisit(sectionName) {
  if (!sectionName || sectionName === 'home') return
  if (!QUEST_SECTIONS.includes(sectionName)) return
  const state = loadState()
  if (state.visitedSections.includes(sectionName)) return // ya contada
  const visitedSections = [...state.visitedSections, sectionName]
  const questCompleted = visitedSections.length >= QUEST_COMPLETION_THRESHOLD
  saveState({ ...state, visitedSections, questCompleted })
}

// Captura el parámetro ?signal=XXX al aterrizar desde redes / campaña.
// Si ya hay uno guardado, no lo sobrescribe — la primera señal que tocó al
// usuario es la que M.A.D.R.E. reconoce. Pasar null o window.location.search
// directo según uso.
export function captureArrivalSignal(searchString) {
  if (typeof window === 'undefined') return
  const raw = searchString != null ? searchString : window.location.search
  try {
    const params = new URLSearchParams(raw)
    const signal = params.get('signal')
    if (!signal) return
    // Whitelist simple: solo caracteres alfanuméricos y guiones, máx 32 chars
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(signal)) return
    const state = loadState()
    if (state.arrivalSignal) return // ya está registrada la primera
    saveState({ ...state, arrivalSignal: signal })
  } catch {
    // silencioso
  }
}

export function setSkulleyStage(state, stage, partial = {}) {
  return {
    ...state,
    skulleyPath: { ...state.skulleyPath, active: true, stage, ...partial },
  }
}

export function exitSkulleyPath(state, { success = false, failure = false } = {}) {
  return {
    ...state,
    skulleyPath: {
      ...state.skulleyPath,
      active: false,
      completed: success || state.skulleyPath.completed,
      failed: failure,
    },
  }
}

// Exporta ACTS para consumers
export { ACTS, SKULLEY_PATH }
