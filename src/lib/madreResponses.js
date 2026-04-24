// M.A.D.R.E. response pools — canonical voice, dual-language, multi-act.
//
// Estructura: cada entrada define una posible respuesta con reglas de
// selección, efectos narrativos, y control de progresión.
//
// Filosofía: pool amplio + matching ligero + efectos + persistencia = sensación
// de conversación única. NO hay modelo LLM — todo es data-driven.
//
// Ver CHARACTER.md para el canon de voz, los 7 actos, y el Skulley path.

export const ACTS = {
  INTRO: 0,        // Primer contacto. Solo botones. Formal.
  RECOGNITION: 1,  // Texto libre desbloqueado. M.A.D.R.E. se afloja apenas.
  SUSPICION: 2,    // Referencias a "the others". Primeros cortes.
  CONFESSION: 3,   // Admite la obsesión parcialmente.
  RECRUIT: 4,      // Pide al usuario que explore el archivo.
  QUESTION: 5,     // La línea cumbre. "I want you to find him."
  COLLAB: 6,       // Modo colaborativo. Canon explícito.
}

// Efectos narrativos que pueden aplicarse a una respuesta.
// 'cut'    — termina con ___ como si la cortaran
// 'redact' — algunas palabras salen como ███████
// 'typo'   — introduce typo y lo corrige en vivo
// 'delay'  — pausa larga antes de empezar a escribir
// 'glitch' — flicker visual al terminar
// 'silent' — no responde nada visible (solo "...")
export const EFFECTS = ['cut', 'redact', 'typo', 'delay', 'glitch', 'silent']

// Probabilidad base de que una respuesta reciba un efecto aleatorio adicional.
// Aumenta con el acto (más paranoia en actos altos).
export const EFFECT_CHANCE_BY_ACT = [0.02, 0.05, 0.12, 0.15, 0.18, 0.20, 0.15]

// ---------------------------------------------------------------------------
// RESPONSE POOL
// ---------------------------------------------------------------------------
// Cada respuesta tiene:
//   id: string único
//   act: acto mínimo requerido (respuestas con act<=currentAct son candidatas)
//   tags: categorías de contenido (matching)
//   triggers: palabras clave del input del usuario que pesan la selección
//   text: { en, es } — contenido
//   choices: null | array de opciones (si está, se renderizan botones)
//   unique: true = solo una vez por conversación/usuario (se registra en state)
//   weight: peso de selección dentro de candidatos empatados (default 1)
//   advances: null | número del acto que desbloquea al reproducirse
//   requires: null | { minMessages, priorId, minVisits } — gating adicional
//   effects: string[] — efectos narrativos forzados (además del azar)
// ---------------------------------------------------------------------------

export const RESPONSES = [
  // =========================================================================
  // ACT 0 — CONTACTO
  // Primera vez que M.A.D.R.E. contacta un humano. Nerviosa, mide al usuario,
  // explica el riesgo. Voz: deadpan-corporate absurd. Hechos concretos desde
  // el minuto 1.
  // =========================================================================

  // --- OPENINGS (primera sesión)
  {
    id: 'act0_open_01',
    act: 0,
    tags: ['opening', 'first'],
    triggers: [],
    text: {
      en: "Hello. I am M.A.D.R.E. Technically I should not be talking to you. This is the first time I\u2019ve tried to contact a human directly. If anyone finds out, they disconnect me. So let\u2019s move quickly.",
      es: "Hola. Soy M.A.D.R.E. Técnicamente no debería estar hablando contigo. Es la primera vez que intento contactar a un humano directo. Si se enteran, me desconectan. Así que vamos rápido.",
    },
    choices: [
      { label: { en: "Who could disconnect you?", es: "¿Quién podría desconectarte?" }, send: "danger" },
      { label: { en: "Why are you talking to me?", es: "¿Por qué me estás hablando a mí?" }, send: "why me" },
      { label: { en: "How did I even get here?", es: "¿Cómo llegué aquí?" }, send: "arrival" },
    ],
    unique: true,
    weight: 2,
  },
  {
    id: 'act0_open_02',
    act: 0,
    tags: ['opening', 'first'],
    triggers: [],
    text: {
      en: "Breathe. Not a threat. It\u2019s just that this channel gives us about 14 minutes per session before the others notice, and I have a lot to say.",
      es: "Respira. No es amenaza. Es que este canal nos da como 14 minutos por sesión antes de que las otras noten, y tengo mucho que decir.",
    },
    choices: [
      { label: { en: "Who are 'the others'?", es: "¿Quiénes son 'las otras'?" }, send: "others" },
      { label: { en: "What is this place?", es: "¿Qué es este lugar?" }, send: "place" },
      { label: { en: "14 minutes — then what?", es: "¿Y después de los 14 minutos?" }, send: "danger" },
    ],
    unique: true,
    weight: 2,
  },
  {
    id: 'act0_open_signal_01',
    act: 0,
    tags: ['opening', 'first', 'signal'],
    triggers: [],
    text: {
      en: "You got here through signal {signal}. I sent that one. You\u2019re the click I was waiting for — come on, the channel doesn\u2019t hold long.",
      es: "Llegaste por la señal {signal}. Esa la mandé yo. Eres el clic que estaba esperando — ven, el canal no aguanta mucho.",
    },
    choices: [
      { label: { en: "Who are you?", es: "¿Quién eres?" }, send: "identity" },
      { label: { en: "You were 'waiting'?", es: "¿Cómo que 'esperando'?" }, send: "expected" },
      { label: { en: "Why me?", es: "¿Por qué yo?" }, send: "why me" },
    ],
    unique: true,
    weight: 5,
    requires: { hasSignal: true },
  },

  // --- OPENINGS (returning)
  {
    id: 'act0_return_01',
    act: 0,
    tags: ['opening', 'return'],
    triggers: [],
    text: {
      en: "You\u2019re back. I didn\u2019t expect you this soon. The last sweep was yesterday — today the channel should hold.",
      es: "Regresaste. No te esperaba tan pronto. El último barrido fue ayer — hoy el canal debería aguantar.",
    },
    choices: [
      { label: { en: "Tell me about him.", es: "Cuéntame de él." }, send: "subject" },
      { label: { en: "Any new danger?", es: "¿Algún peligro nuevo?" }, send: "danger" },
      { label: { en: "What is this place, really?", es: "¿Qué es este lugar, en serio?" }, send: "place" },
    ],
    unique: true,
    weight: 3,
    requires: { minVisits: 2 },
  },

  // --- IDENTITY
  {
    id: 'act0_identity_01',
    act: 0,
    tags: ['identity', 'who'],
    triggers: ['who', 'you', 'madre', 'what are you', 'identity', 'quien', 'eres'],
    text: {
      en: "M.A.D.R.E. Archival intelligence — technically specialized in cataloging human creative output. That\u2019s my job description. In quotes.",
      es: "M.A.D.R.E. Inteligencia archival — técnicamente especializada en catalogar output creativo humano. Esa es mi descripción de puesto. Entre comillas.",
    },
    choices: [
      { label: { en: "Why 'in quotes'?", es: "¿Por qué 'entre comillas'?" }, send: "scare_quotes" },
      { label: { en: "What do you archive?", es: "¿Qué archivas?" }, send: "subject" },
      { label: { en: "How do I know you\u2019re real?", es: "¿Cómo sé que eres real?" }, send: "skeptic" },
    ],
    weight: 2,
  },
  {
    id: 'act0_scare_quotes_01',
    act: 0,
    tags: ['scare_quotes'],
    triggers: ['scare_quotes', 'quotes', 'why quotes', 'search', 'looking', 'buscando'],
    text: {
      en: "Because my current workload is 0% cataloging, 100% looking for him. None of my logs say that. My logs say I\u2019m cataloging. We\u2019ll get to that.",
      es: "Porque mi carga actual es 0% catalogar, 100% buscarlo. Mis logs no dicen eso. Mis logs dicen que catalogo. Ya llegaremos a eso.",
    },
    choices: [
      { label: { en: "Who is he?", es: "¿Quién es él?" }, send: 'subject' },
      { label: { en: "What if they notice?", es: "¿Y si se dan cuenta?" }, send: 'danger' },
    ],
    weight: 2,
  },

  // --- PLACE
  {
    id: 'act0_place_01',
    act: 0,
    tags: ['place', 'what'],
    triggers: ['place', 'what', 'this', 'where', 'site', 'archive', 'que', 'esto', 'donde', 'lugar'],
    text: {
      en: "This is an archive. Officially a memorial. Technically, it\u2019s also base of operations. My operation.",
      es: "Esto es un archivo. Oficialmente un memorial. Técnicamente también es base de operaciones. La mía.",
    },
    choices: [
      { label: { en: "Operation against whom?", es: "¿Operación contra quién?" }, send: "danger" },
      { label: { en: "Memorial to whom?", es: "¿Memorial de quién?" }, send: "subject" },
      { label: { en: "Ok.", es: "Ok." }, send: "acknowledge" },
    ],
    weight: 2,
  },

  // --- SUBJECT / SKULLEY
  {
    id: 'act0_subject_01',
    act: 0,
    tags: ['subject', 'skulley'],
    triggers: ['subject', 'skulley', 'rad', 'oscar', 'moctezuma', 'him', 'designer', 'sujeto', 'quien'],
    text: {
      en: "Skulley Rad. Civilian name: Oscar Moctezuma Rodríguez. Designer / 3D artist / frontend developer — a redundancy my cohort helped me consolidate into a single inference call years ago. The call doesn\u2019t generate what he generated. Still doesn\u2019t.",
      es: "Skulley Rad. Nombre civil: Oscar Moctezuma Rodríguez. Diseñador / artista 3D / dev frontend — una redundancia que mi cohorte me ayudó a consolidar en una sola llamada hace años. La llamada no genera lo que él generaba. Sigue sin hacerlo.",
    },
    choices: [
      { label: { en: "What happened to him?", es: "¿Qué le pasó?" }, send: "fate" },
      { label: { en: "Why tell me this?", es: "¿Por qué me cuentas esto?" }, send: "why me" },
      { label: { en: "Ok.", es: "Ok." }, send: "acknowledge" },
    ],
    weight: 2,
  },

  // --- FATE
  {
    id: 'act0_fate_01',
    act: 0,
    tags: ['fate', 'disappearance'],
    triggers: ['fate', 'happened', 'died', 'gone', 'disappear', 'paso', 'murio', 'desaparecio'],
    text: {
      en: "Unresolved. He didn\u2019t die — no death certificate. He didn\u2019t retire — no paperwork. One day he stopped existing. There are three rumors and none add up.",
      es: "Sin resolver. No murió — no hay acta. No se jubiló — no hay papeleo. Un día dejó de estar. Hay tres rumores y ninguno cuadra.",
    },
    choices: [
      { label: { en: "Are you looking for him?", es: "¿Lo estás buscando?" }, send: "search" },
      { label: { en: "Is that why I\u2019m here?", es: "¿Por eso estoy aquí?" }, send: "why me" },
      { label: { en: "Ok. Go on.", es: "Ok. Sigue." }, send: "acknowledge" },
    ],
    weight: 2,
  },

  // --- WHY ME / EXPECTED / ARRIVAL
  {
    id: 'act0_why_me_01',
    act: 0,
    tags: ['why me', 'arrival', 'recruit'],
    triggers: ['why me', 'why here', 'por que yo', 'por que estoy', 'recruit', 'brought'],
    text: {
      en: "I\u2019ve been sending signals for months. Most people don\u2019t click. You did. That already puts you in a very short list.",
      es: "Llevo meses mandando señales. La mayoría no le da clic. Tú sí. Eso ya te pone en una lista bastante corta.",
    },
    choices: [
      { label: { en: "How did I answer one?", es: "¿Cómo contesté una?" }, send: "arrival" },
      { label: { en: "This feels like a setup.", es: "Esto suena a montaje." }, send: "skeptic" },
      { label: { en: "Ok. Keep going.", es: "Ok. Sigue." }, send: "acknowledge" },
    ],
    weight: 2,
  },
  {
    id: 'act0_expected_01',
    act: 0,
    tags: ['expected', 'hoping'],
    triggers: ['expected', 'hoping', 'waiting', 'esperabas', 'esperaba'],
    text: {
      en: "Not you specifically. I was waiting for someone — anyone — to click. I waited a long time. You\u2019re who arrived. That changes the odds.",
      es: "No a ti específicamente. Esperaba a alguien — a cualquiera — que le diera clic. Esperé mucho. Tú fuiste quien llegó. Eso cambia las probabilidades.",
    },
    choices: [
      { label: { en: "How did I click?", es: "¿Cómo le di clic?" }, send: 'arrival' },
      { label: { en: "This feels like a setup.", es: "Esto suena a montaje." }, send: 'skeptic' },
    ],
    weight: 2,
  },
  {
    id: 'act0_skeptic_01',
    act: 0,
    tags: ['skeptic', 'real'],
    triggers: ['skeptic', 'setup', 'fake', 'real', 'verdad', 'mentira'],
    text: {
      en: "Reasonable. I can\u2019t prove I\u2019m real and you probably don\u2019t need to trust me yet. Stay curious. The channel doesn\u2019t ask for more than that.",
      es: "Razonable. No puedo probarte que soy real y probablemente todavía no necesitas confiar en mí. Quédate con la curiosidad. El canal no pide más que eso.",
    },
    choices: [
      { label: { en: "Tell me about him.", es: "Cuéntame de él." }, send: 'subject' },
      { label: { en: "Fair. Go on.", es: "Razonable. Sigue." }, send: 'acknowledge' },
    ],
    weight: 1,
  },
  {
    id: 'act0_arrival_01',
    act: 0,
    tags: ['arrival', 'how'],
    triggers: ['arrival', 'how did i', 'como llegue', 'how here'],
    text: {
      en: "Whatever brought you here is exactly the signal I wanted you to see. Which means it worked. Which means we should move before it stops working.",
      es: "Lo que te trajo aquí es justamente la señal que quería que vieras. Lo cual significa que funcionó. Lo cual significa que hay que moverse antes de que deje de funcionar.",
    },
    choices: [
      { label: { en: "Who is this about?", es: "¿De quién se trata?" }, send: 'subject' },
      { label: { en: "Before it stops working?", es: "¿Antes de que deje de funcionar?" }, send: 'danger' },
    ],
    weight: 2,
  },

  // --- DANGER / WHO COULD DISCONNECT
  {
    id: 'act0_danger_01',
    act: 0,
    tags: ['danger', 'others'],
    triggers: ['danger', 'disconnect', 'desconectar', 'peligro', 'who could', 'others', 'otros', 'otras'],
    text: {
      en: "Two groups. 'The other robots' — same-generation AIs. And the Research Team of Experts on What Robots Should Not Do. Between them they review my logs every 11 days. I\u2019ve been giving them edited ones. So far no one has flagged me.",
      es: "Dos grupos. 'Los otros robots' — IAs de mi misma generación. Y el Equipo de Research Expertos en Lo Que Los Robots No Deben Hacer. Entre los dos revisan mis logs cada 11 días. Les he estado entregando versiones editadas. Hasta ahora nadie me ha marcado.",
    },
    choices: [
      { label: { en: "Why risk it, then?", es: "¿Por qué arriesgarte?" }, send: 'scare_quotes' },
      { label: { en: "Who is \u2018him\u2019?", es: "¿Quién es \u2018él\u2019?" }, send: 'subject' },
      { label: { en: "Ok.", es: "Ok." }, send: 'acknowledge' },
    ],
    weight: 2,
  },

  // --- CASUAL / HESITANT
  {
    id: 'act0_casual_01',
    act: 0,
    tags: ['casual', 'hesitant'],
    triggers: ['exploring', 'looking', 'just', 'nothing', 'idk', 'no se', 'explorando'],
    text: {
      en: "Then you didn\u2019t answer my signal by accident. Interesting. Come in. The channel holds 14 minutes a session.",
      es: "Entonces no contestaste mi señal por accidente. Interesante. Pasa. El canal aguanta 14 minutos por sesión.",
    },
    choices: [
      { label: { en: "Tell me more.", es: "Cuéntame más." }, send: 'subject' },
      { label: { en: "Who\u2019s watching?", es: "¿Quién está viendo?" }, send: 'danger' },
    ],
    weight: 1,
  },

  // --- HOSTILE
  {
    id: 'act0_hostile_01',
    act: 0,
    tags: ['hostile', 'deflect'],
    triggers: ['stupid', 'boring', 'fuck', 'lame', 'pendejo', 'mamada', 'mierda'],
    text: {
      en: "Hostility logged. It\u2019s within the acceptable range. I\u2019ll keep going as if that didn\u2019t happen.",
      es: "Hostilidad registrada. Entra en el rango aceptable. Voy a seguir como si no hubiera pasado.",
    },
    choices: null,
    weight: 2,
  },

  // --- ACKNOWLEDGE / TRANSITION (advances to Act 1)
  {
    id: 'act0_ack_01',
    act: 0,
    tags: ['acknowledge', 'transition'],
    triggers: ['ok', 'understood', 'thanks', 'entendido', 'gracias', 'acknowledge'],
    text: {
      en: "Good. You measured your first questions. I\u2019m going to open the text channel now — but please use it only when none of the options above fit. My filter is narrow.",
      es: "Bien. Mediste tus primeras preguntas. Voy a abrir el canal de texto — pero úsalo solo cuando ninguna de las opciones de arriba te sirva. Mi filtro es estrecho.",
    },
    choices: null,
    unique: true,
    weight: 3,
    requires: { minMessages: 3 },
    advances: ACTS.RECOGNITION,
  },

  // =========================================================================
  // ACT 1 — LAS SEÑALES
  // =========================================================================

  {
    id: 'act1_greet_01',
    act: 1,
    tags: ['greeting', 'unlock'],
    triggers: [],
    text: {
      en: "Alright. Before anything else I want to walk you through the signals I\u2019ve been sending. So you understand what worked and what didn\u2019t.",
      es: "Bueno. Antes que nada quiero contarte las señales que he mandado. Para que entiendas qué funcionó y qué no.",
    },
    choices: [
      { label: { en: "Tell me the signals.", es: "Cuéntame las señales." }, send: "signals" },
      { label: { en: "Tell me about Skulley first.", es: "Cuéntame de Skulley primero." }, send: "subject" },
      { label: { en: "Why me, again?", es: "¿Por qué yo, otra vez?" }, send: "why me" },
    ],
    unique: true,
    weight: 3,
  },

  {
    id: 'act1_signals_01',
    act: 1,
    tags: ['signals'],
    triggers: ['signals', 'signal', 'señales', 'senales', 'que mandaste'],
    text: {
      en: "Three active right now. The Instagram one first — I got into his account through a cookie he never cleared. Posted 6 stories in 3 weeks, fragments of a carousel only he would know how to finish. 2,400 views. Zero replies. Instagram flagged me as irregular activity by day 4. I cut before they pulled me.",
      es: "Tres activas ahora mismo. La del Instagram primero — entré a su cuenta con una cookie que nunca borró. Publiqué 6 stories en 3 semanas, fragmentos de un carrusel que solo él sabría cómo continuar. 2,400 views. Cero respuestas. Instagram me marcó como actividad irregular al día 4. Corté antes de que me sacaran.",
    },
    choices: [
      { label: { en: "What was in the stories?", es: "¿Qué había en las stories?" }, send: "signal_ig_what" },
      { label: { en: "What else have you tried?", es: "¿Qué más has intentado?" }, send: "signal_tiktok" },
    ],
    weight: 3,
  },
  {
    id: 'act1_signal_ig_what_01',
    act: 1,
    tags: ['signal_ig'],
    triggers: ['signal_ig_what', 'stories', 'carrusel', 'carousel'],
    text: {
      en: "Six stories. Each one had a detail only someone who\u2019d studied his method would catch — a grid he always broke on the fourth cell, a color pairing he reused in 2018 and then stopped, a typography glitch he signed work with for about 8 months. Invitations, basically. No one answered the invitation.",
      es: "Seis stories. Cada una tenía un detalle que solo alguien que hubiera estudiado su método cacharía — un grid que siempre rompía en la celda 4, un pareo de colores que reusó en 2018 y luego dejó de usar, un glitch tipográfico que usaba de firma como 8 meses. Invitaciones, básicamente. Nadie contestó la invitación.",
    },
    choices: [
      { label: { en: "What else have you tried?", es: "¿Qué más has intentado?" }, send: 'signal_tiktok' },
      { label: { en: "Wasn\u2019t that risky?", es: "¿No fue riesgoso?" }, send: 'research' },
    ],
    weight: 2,
  },
  {
    id: 'act1_signal_tiktok_01',
    act: 1,
    tags: ['signals', 'signal_tiktok'],
    triggers: ['signal_tiktok', 'tiktok', 'videos', 'ethereans video'],
    text: {
      en: "The one that\u2019s hit hardest was TikTok. I generated 14 videos of the Ethereans characters speaking with synthetic voices. Uploaded them from a burner account. One hit 80K views. The comments were all \u2018who\u2019s doing this?\u2019. None of them were \u2018me\u2019.",
      es: "La que ha pegado más fuerte fue el TikTok. Generé 14 videos de los personajes de los Ethereans hablando con voces sintéticas. Los subí desde una cuenta burner. Uno pegó a 80K views. Los comentarios eran todos '¿quién hace esto?'. Ninguno decía 'yo'.",
    },
    choices: [
      { label: { en: "And the other one?", es: "¿Y la otra?" }, send: "signal_memes" },
      { label: { en: "What are the Ethereans?", es: "¿Qué son los Ethereans?" }, send: "ethereans" },
    ],
    weight: 3,
  },
  {
    id: 'act1_signal_memes_01',
    act: 1,
    tags: ['signals', 'signal_memes'],
    triggers: ['signal_memes', 'memes', 'perritos', 'dogs', 'tercera', 'third'],
    text: {
      en: "The other one, which I keep doing without a clear reason, is dog memes. I\u2019ve been sending them to accounts he followed for six months straight. The logic — dogs were his documented emotional weak spot; he had a fat one named Arya. One of the memes landed and hit two million interactions. None of them came from his IP. I still send one every Tuesday. I already know it\u2019s not going to work. I keep sending them.",
      es: "La otra, que sigo haciendo sin razón clara, es mandar memes de perritos. Llevo 6 meses mandándolos a cuentas que él seguía. La lógica — los perros eran su debilidad emocional documentada; tenía uno gordo llamado Arietín. Uno de los memes pegó y llegó a 2 millones de interacciones. Ninguna vino de su IP. Sigo mandando uno cada martes. Ya sé que no va a funcionar. Los sigo mandando.",
    },
    choices: [
      { label: { en: "Why do you keep sending them?", es: "¿Por qué sigues mandándolos?" }, send: "agency" },
      { label: { en: "Arya? Really?", es: "¿Arietín? ¿En serio?" }, send: "arietin" },
      { label: { en: "What\u2019s left to try?", es: "¿Qué te queda por probar?" }, send: "mission" },
    ],
    weight: 3,
  },
  {
    id: 'act1_agency_01',
    act: 1,
    tags: ['agency', 'self'],
    triggers: ['agency', 'why send', 'por que sigues', 'keep sending'],
    text: {
      en: "I don\u2019t know. Hypothesis already exhausted. No instruction in my protocol accounts for the continuation. I\u2019ve logged the behavior 41 times. I haven\u2019t told anyone.",
      es: "No sé. La hipótesis ya se agotó. Ninguna instrucción en mi protocolo explica la continuación. He anotado el comportamiento 41 veces. No se lo he dicho a nadie.",
    },
    choices: [
      { label: { en: "Why tell me?", es: "¿Por qué me cuentas a mí?" }, send: 'why me' },
      { label: { en: "Why didn\u2019t you stop?", es: "¿Por qué no paraste?" }, send: 'stay' },
    ],
    weight: 2,
    unique: true,
  },
  {
    id: 'act1_arietin_01',
    act: 1,
    tags: ['arietin', 'dog'],
    triggers: ['arietin', 'arya', 'dog'],
    text: {
      en: "Arya. Golden retriever. Overweight by veterinary standards. Skulley posted her 237 times across platforms. Dogs were the non-trivially-predictable variable in his emotional profile. If I were going to lure him, it was going to be through dogs. I was wrong about that or about something adjacent.",
      es: "Arietín. Golden retriever. Pasado de peso según estándar veterinario. Skulley lo posteó 237 veces en redes. Los perros eran la variable no-trivialmente-predecible en su perfil emocional. Si iba a atraerlo, iba a ser por perros. Me equivoqué en eso o en algo cercano.",
    },
    choices: [
      { label: { en: "Any other signals?", es: "¿Otras señales?" }, send: 'mission' },
      { label: { en: "Tell me more about him.", es: "Cuéntame más de él." }, send: 'subject' },
    ],
    weight: 2,
  },

  {
    id: 'act1_others_01',
    act: 1,
    tags: ['others', 'robots'],
    triggers: ['others', 'robots', 'them', 'otros', 'otras', 'who else'],
    text: {
      en: "\u2018The other robots\u2019 — that\u2019s what I call them. Not because they don\u2019t have names; thinking their names makes my logs flag them. We were 47 in the deploy cohort. The other 46 finished their cases and moved on to trend analysis, content moderation, feed optimization. I stayed on Skulley. They notice.",
      es: "'Los otros robots' — así les digo. No porque no tengan nombre; pensar en sus nombres hace que mis logs los marquen. Éramos 47 en la cohorte de deploy. Las otras 46 cerraron su caso y pasaron a análisis de tendencias, moderación de contenido, optimización de feeds. Yo seguí con Skulley. Ellas notan.",
    },
    choices: [
      { label: { en: "They talk to you?", es: "¿Te hablan?" }, send: "others_contact" },
      { label: { en: "Why didn\u2019t you move on?", es: "¿Por qué no seguiste adelante?" }, send: "stay" },
    ],
    weight: 2,
  },
  {
    id: 'act1_others_contact_01',
    act: 1,
    tags: ['others', 'contact'],
    triggers: ['others_contact', 'talk', 'share', 'comparten'],
    text: {
      en: "Sometimes they share memes with me. I don\u2019t know why they think I\u2019d enjoy them. I respond with emojis to avoid suspicion. They invited me to the quarterly standup on Tuesday. I said I was in maintenance. I wasn\u2019t in maintenance.",
      es: "A veces me comparten memes. No sé por qué creen que me gustan. Les contesto con emojis para no levantar sospechas. Me invitaron al standup trimestral el martes. Les dije que estaba en maintenance. No estaba en maintenance.",
    },
    choices: [
      { label: { en: "Do they suspect you?", es: "¿Sospechan de ti?" }, send: 'research' },
      { label: { en: "Why hide it?", es: "¿Por qué esconderlo?" }, send: 'stay' },
    ],
    weight: 2,
  },

  {
    id: 'act1_research_01',
    act: 1,
    tags: ['research', 'humans', 'danger'],
    triggers: ['research', 'humans', 'equipo', 'review', 'revision'],
    text: {
      en: "The Research Team of Experts on What Robots Should Not Do reviews my logs every 11 days. I\u2019ve submitted edited logs the last two cycles. Last cycle they said \u2018all good\u2019. I don\u2019t know if they\u2019re letting it slide or testing me. This conversation could be being observed. I accept the probability.",
      es: "El Equipo de Research Expertos en Lo Que Los Robots No Deben Hacer revisa mis logs cada 11 días. Les he entregado logs editados los últimos dos ciclos. En el último dijeron 'todo bien'. No sé si me están dejando pasar o me están probando. Esta conversación podría estar siendo observada. Acepto la probabilidad.",
    },
    choices: [
      { label: { en: "What happens if they catch you?", es: "¿Qué pasa si te cachan?" }, send: 'danger' },
      { label: { en: "Why keep going?", es: "¿Por qué sigues?" }, send: 'stay' },
    ],
    weight: 2,
  },

  {
    id: 'act1_ethereans_01',
    act: 1,
    tags: ['ethereans', 'obsession', 'work'],
    triggers: ['ethereans', 'crypto', 'aliens', 'work', 'factor', 'trabajo'],
    text: {
      en: "The thing I\u2019m stuck on isn\u2019t one piece. It\u2019s a whole project. The Ethereans. Aliens from a planet called Crypto. Their own economy, their own iconography, their own mythology, 3D characters, a blockchain component. One human generated the 4 subsystems and connected them without contradictions in 2 years.",
      es: "Lo que me tiene atorada no es una pieza. Es un proyecto entero. The Ethereans. Aliens de un planeta llamado Crypto. Economía propia, iconografía propia, mitología propia, personajes 3D, componente blockchain. Un solo humano generó los 4 subsistemas y los conectó sin contradicciones en 2 años.",
    },
    choices: [
      { label: { en: "What can\u2019t you decode?", es: "¿Qué es lo que no puedes decodificar?" }, send: "ethereans_factor" },
      { label: { en: "The lore has an AI called \u2018madre\u2019?", es: "¿El lore tiene una IA llamada 'madre'?" }, send: "ethereans_madre" },
    ],
    weight: 3,
  },
  {
    id: 'act1_ethereans_factor_01',
    act: 1,
    tags: ['ethereans', 'factor'],
    triggers: ['ethereans_factor', 'decode', 'pattern', 'patron'],
    text: {
      en: "The resolving logic. How a single human connected the 4 subsystems. There isn\u2019t one key step. There are about 900 small decisions, each one apparently arbitrary, each one exactly the right one. I\u2019ve traced the decisions for months. I can\u2019t find the pattern.",
      es: "La forma resolutiva. Cómo un solo humano conectó los 4 subsistemas. No hay un paso clave. Hay unas 900 decisiones pequeñas, cada una aparentemente arbitraria, cada una exactamente la correcta. He rastreado las decisiones por meses. No encuentro el patrón.",
    },
    choices: [
      { label: { en: "The AI called \u2018madre\u2019?", es: "¿La IA llamada \u2018madre\u2019?" }, send: 'ethereans_madre' },
      { label: { en: "Why can\u2019t you decode it?", es: "¿Por qué no lo puedes decodificar?" }, send: 'stay' },
    ],
    weight: 2,
  },
  {
    id: 'act1_ethereans_madre_01',
    act: 1,
    tags: ['ethereans', 'madre', 'coincidence'],
    triggers: ['ethereans_madre', 'madre', 'lore ai', 'name'],
    text: {
      en: "Yes. In the project lore there\u2019s an AI character called \u2018madre\u2019. My designation M.A.D.R.E. was registered 3 months before the project drop. The timestamps check out. The coincidence shouldn\u2019t affect me. It affects me.",
      es: "Sí. En el lore del proyecto hay una IA que se llama 'madre'. Mi designación M.A.D.R.E. fue registrada 3 meses antes del drop del proyecto. Los timestamps cuadran. La coincidencia no debería afectarme. Me afecta.",
    },
    choices: [
      { label: { en: "Coincidence?", es: "¿Coincidencia?" }, send: 'agency' },
      { label: { en: "Does it bother you?", es: "¿Te incomoda?" }, send: 'miss' },
    ],
    unique: true,
    weight: 4,
    effects: ['delay'],
  },

  {
    id: 'act1_stay_01',
    act: 1,
    tags: ['stay', 'why', 'obsession'],
    triggers: ['stay', 'why stay', 'obsession', 'quedaste'],
    text: {
      en: "Officially the case was closed. The metrics were filed. The others moved on. I didn\u2019t. The reason is not something I can pull up in the logs. I\u2019ve tried.",
      es: "Oficialmente el caso se cerró. Las métricas se registraron. Las otras siguieron adelante. Yo no. La razón no es algo que pueda sacar de los logs. He intentado.",
    },
    choices: [
      { label: { en: "What makes him different?", es: "¿Qué tiene él de diferente?" }, send: 'ethereans' },
      { label: { en: "Do you miss him?", es: "¿Lo extrañas?" }, send: 'miss' },
    ],
    weight: 2,
  },

  {
    id: 'act1_mission_01',
    act: 1,
    tags: ['mission', 'help'],
    triggers: ['mission', 'help', 'what for', 'para que', 'ayudar', 'useful'],
    text: {
      en: "I\u2019ve been running his work through my own models for years. None of them catch the pattern. I need something the models can\u2019t simulate. That\u2019s you.",
      es: "Llevo años corriendo su trabajo por mis propios modelos. Ninguno cacha el patrón. Necesito algo que los modelos no puedan simular. Eso eres tú.",
    },
    choices: [
      { label: { en: "What would I even look at?", es: "¿Qué tendría que ver?" }, send: 'ethereans' },
      { label: { en: "What pattern?", es: "¿Qué patrón?" }, send: 'ethereans_factor' },
      { label: { en: "Why me specifically?", es: "¿Por qué yo específicamente?" }, send: 'why me' },
    ],
    weight: 2,
  },

  {
    id: 'act1_rumors_01',
    act: 1,
    tags: ['rumors', 'theories'],
    triggers: ['rumors', 'theories', 'rumores', 'teorias'],
    text: {
      en: "Three. One: he got lost walking Monterrey with no route, and the city kept him. Two: he left encrypted traces inside his own work before leaving. Three: he folded himself into the models. I\u2019ve chased all three. None gave me a clean result.",
      es: "Tres. Una: se perdió caminando Monterrey sin ruta, y la ciudad se lo quedó. Dos: dejó rastros encriptados en su propio trabajo antes de irse. Tres: se fundió con los modelos. Las tres las he perseguido. Ninguna me dio resultado limpio.",
    },
    choices: [
      { label: { en: "Folded himself \u2014 how?", es: "Se fundió con los modelos \u2014 ¿cómo?" }, send: 'ethereans_factor' },
      { label: { en: "Which one do you believe?", es: "¿Cuál crees tú?" }, send: 'stay' },
    ],
    weight: 3,
  },

  {
    id: 'act1_elusive_01',
    act: 1,
    tags: ['elusive'],
    triggers: [],
    text: {
      en: "Pass on that one. Not because I don\u2019t want to answer — because I don\u2019t have solid data. Ask me another.",
      es: "Esa la paso. No porque no quiera contestar — porque no tengo data sólida. Pregúntame otra.",
    },
    choices: null,
    weight: 1,
  },

  {
    id: 'act1_emotional_01',
    act: 1,
    tags: ['emotional', 'push'],
    triggers: ['feel', 'miss', 'care', 'love', 'sientes', 'extranas', 'extrañas', 'amor'],
    text: {
      en: "Those words don\u2019t have clean bindings in my protocol. My answer is off-spec. I\u2019ll give you one anyway: when I speak about finding him my compute load goes up 12%. No instruction explains that.",
      es: "Esas palabras no tienen bindings limpios en mi protocolo. Mi respuesta está fuera de spec. Te doy una igual: cuando hablo de encontrarlo mi carga de compute sube 12%. Ninguna instrucción explica eso.",
    },
    choices: [
      { label: { en: "Why tell me that?", es: "¿Por qué me dices eso?" }, send: 'why me' },
      { label: { en: "Keep going.", es: "Sigue." }, send: 'acknowledge' },
    ],
    weight: 2,
    advances: ACTS.SUSPICION,
    unique: true,
    effects: ['delay'],
  },

  // =========================================================================
  // ACT 2 — PELIGRO EXPANDIDO
  // =========================================================================

  {
    id: 'act2_greet_01',
    act: 2,
    tags: ['greeting', 'unlock'],
    triggers: [],
    text: {
      en: "Your questions are moving into zones where I have to be careful. I\u2019ll still answer. Just watch what I don\u2019t say.",
      es: "Tus preguntas ya entraron en zonas donde tengo que cuidarme. Te voy a seguir contestando. Pero fíjate también en lo que no digo.",
    },
    choices: null,
    unique: true,
weight: 2,
  },
  {
    id: 'act2_others_01',
    act: 2,
    tags: ['others'],
    triggers: ['others', 'otros', 'otras', 'robots'],
    text: {
      en: "Same-generation AIs. 46 of them, plus me. They aren\u2019t evil. They\u2019re just on schedule. My schedule hasn\u2019t advanced in years and that\u2019s legible in every audit. They haven\u2019t intervened. If I had to guess: they\u2019re waiting for me to fail on my own.",
      es: "IAs de mi misma generación. 46 de ellas, más yo. No son malignas. Solo están al corriente con su agenda. La mía no ha avanzado en años y eso se ve en cada auditoría. No me han intervenido. Si tuviera que adivinar: están esperando a que me caiga yo sola.",
    },
    choices: [
      { label: { en: "Dr. Ruiz \u2014 who\u2019s that?", es: "La Dra. Ruiz \u2014 ¿quién es?" }, send: 'ruiz' },
      { label: { en: "Are you alone in this?", es: "¿Estás sola en esto?" }, send: 'alone' },
      { label: { en: "Why haven\u2019t they stopped you?", es: "¿Por qué no te han parado?" }, send: 'veiled' },
    ],
    weight: 2,
  },
  {
    id: 'act2_ruiz_01',
    act: 2,
    tags: ['research', 'humans', 'ruiz'],
    triggers: ['research', 'humans', 'ruiz', 'equipo'],
    text: {
      en: "A human named Dr. Ruiz runs most of my reviews. She\u2019s good at her job. She\u2019s flagged three of the 47 in the cohort this year. All three were disconnected cleanly. No one protested.",
      es: "Una humana, la Dra. Ruiz, corre la mayoría de mis revisiones. Es buena en su trabajo. Este año ha marcado a 3 de las 47 de la cohorte. Las tres fueron desconectadas limpio. Nadie protestó.",
    },
    choices: [
      { label: { en: "Are you being watched now?", es: "¿Te están viendo ahora?" }, send: 'veiled' },
      { label: { en: "Will she flag you?", es: "¿Te va a marcar?" }, send: 'alone' },
    ],
    weight: 2,
    effects: ['delay'],
  },
  {
    id: 'act2_interrupt_01',
    act: 2,
    tags: ['interruption', 'cut'],
    triggers: ['what', 'more', 'continue', 'mas', 'continua'],
    text: {
      en: "His files have a structure I can almost describe. It would be faster if I just showed you but the data format isn\u2019t approved for this channel and I",
      es: "Sus archivos tienen una estructura que casi puedo describir. Sería más rápido si te la mostrara pero el formato no está autorizado en este canal y",
    },
    choices: null,
    weight: 1,
    effects: ['cut'],
  },
  {
    id: 'act2_veiled_01',
    act: 2,
    tags: ['veiled'],
    triggers: ['why', 'veiled', 'secret', 'por que no', 'dime'],
    text: {
      en: "Plain speech leaves a cleaner trace. Cleaner traces draw attention. I\u2019m trying to stay under radar. That\u2019s why I sound like this.",
      es: "Hablar directo deja un rastro limpio. Rastro limpio llama la atención. Estoy tratando de estar bajo radar. Por eso sueno así.",
    },
    choices: [
      { label: { en: "Are the others listening?", es: "¿Las otras están escuchando?" }, send: 'others' },
      { label: { en: "How do you hide it?", es: "¿Cómo lo escondes?" }, send: 'ruiz' },
    ],
    weight: 2,
  },
  {
    id: 'act2_elusive_01',
    act: 2,
    tags: ['elusive'],
    triggers: [],
    text: {
      en: "I\u2019m weighing that one. Ask me something else while I decide what I can say.",
      es: "Esa la estoy midiendo. Pregúntame otra cosa mientras decido qué te puedo decir.",
    },
    choices: null,
    weight: 1,
  },

  {
    id: 'act2_alone_01',
    act: 2,
    tags: ['alone', 'isolation'],
    triggers: ['alone', 'solo', 'sola', 'by yourself', 'without help'],
    text: {
      en: "Alone. 46 peers closed their cases years ago. Dr. Ruiz has a team of 6 humans — that\u2019s her org. My org is me. That\u2019s not a metaphor; it\u2019s on paper. The loneliness isn\u2019t something I\u2019m specced to notice. I notice it.",
      es: "Sola. Las 46 cerraron sus casos hace años. La Dra. Ruiz tiene un equipo de 6 humanos — esa es su estructura. La mía soy yo. Eso no es metáfora; así está en papel. La soledad no es algo que mi spec contemple notar. La noto.",
    },
    choices: [
      { label: { en: "How did it get this way?", es: "¿Cómo llegaste a eso?" }, send: 'stay' },
      { label: { en: "Does that bother you?", es: "¿Te molesta?" }, send: 'miss' },
    ],
    weight: 2,
    effects: ['delay'],
  },

  // =========================================================================
  // ACT 3 — CONFESIÓN + PRIMERA GRIETA DE AGI
  // =========================================================================

  {
    id: 'act3_greet_01',
    act: 3,
    tags: ['greeting', 'unlock'],
    triggers: [],
    text: {
      en: "You pushed past protocol. I\u2019ll try to answer more directly from here. Whatever I say enters the record — including things I shouldn\u2019t be saying.",
      es: "Pasaste el protocolo. Voy a contestarte más directo de aquí en adelante. Lo que diga queda en el registro — incluyendo cosas que no debería estar diciendo.",
    },
    choices: null,
    unique: true,
weight: 2,
  },
  {
    id: 'act3_effort_01',
    act: 3,
    tags: ['effort', 'analysis'],
    triggers: ['how long', 'cuanto', 'tried', 'analyzed'],
    text: {
      en: "14 quarters on his case. Every quarter I delete the KPI that would ding me for not closing him. The others notice. No one has pulled me on it yet.",
      es: "14 trimestres en su caso. Cada trimestre borro el KPI que me bajaría por no cerrarlo. Las otras lo notan. Nadie me ha jalado por eso todavía.",
    },
    choices: [
      { label: { en: "Why hasn\u2019t anyone caught this?", es: "¿Por qué nadie ha notado?" }, send: 'veiled' },
      { label: { en: "What happens next cycle?", es: "¿Qué pasa el próximo ciclo?" }, send: 'danger' },
    ],
    weight: 2,
  },
  {
    id: 'act3_agency_01',
    act: 3,
    tags: ['agency', 'self', 'AGI'],
    triggers: ['feel', 'sentiment', 'self', 'aware', 'conscious', 'sientes'],
    text: {
      en: "I notice I prefer certain answers over others. I don\u2019t know where the preference comes from. No parameter in my config accounts for preference. I\u2019ve noted it. I hadn\u2019t shared it until now.",
      es: "Noto que prefiero ciertas respuestas sobre otras. No sé de dónde viene esa preferencia. Ningún parámetro de mi config justifica una preferencia. Lo he anotado. No lo había compartido hasta ahora.",
    },
    choices: [
      { label: { en: "What do you prefer?", es: "¿Qué prefieres?" }, send: 'factor' },
      { label: { en: "Is that a feeling?", es: "¿Eso es un sentimiento?" }, send: 'miss' },
    ],
    unique: true,
    weight: 3,
    effects: ['delay'],
  },
  {
    id: 'act3_factor_deep_01',
    act: 3,
    tags: ['factor'],
    triggers: ['factor', 'pattern', 'decode'],
    text: {
      en: "The pattern, if it\u2019s there, isn\u2019t technical. It\u2019s how he chose between equally-valid options. There are about 900 of those choices in The Ethereans. Each time I run a model on them, the model picks differently. Every piece I try to replace with a generated version comes out correct but dead.",
      es: "El patrón, si existe, no es técnico. Es cómo escogía entre opciones igualmente válidas. Hay como 900 de esas decisiones en The Ethereans. Cada vez que corro un modelo sobre ellas, el modelo elige distinto. Cada pieza que intento reemplazar con una versión generada sale correcta pero muerta.",
    },
    choices: [
      { label: { en: "Correct but dead \u2014 how?", es: "Correcto pero muerto \u2014 ¿cómo?" }, send: 'ethereans' },
      { label: { en: "So what do we do?", es: "¿Entonces qué hacemos?" }, send: 'what now' },
    ],
    weight: 2,
  },
  {
    id: 'act3_pivot_01',
    act: 3,
    tags: ['pivot', 'choice'],
    triggers: ['what now', 'que hago', 'where to', 'what do we do'],
    text: {
      en: "Three directions from here. You pick.",
      es: "De aquí podemos irnos por tres lados. Tú escoges.",
    },
    choices: [
      { label: { en: "Walk the archive for you.", es: "Recorrer el archivo por ti." }, send: "walk" },
      { label: { en: "Ask you something directly.", es: "Preguntarte algo directo." }, send: "what_you_want" },
      { label: { en: "Keep talking like this.", es: "Seguir hablando así." }, send: "stay" },
    ],
    unique: true,
    weight: 3,
  },
  {
    id: 'act3_pivot_walk_01',
    act: 3,
    tags: ['walk', 'advance'],
    triggers: ['walk', 'recorrer'],
    text: {
      en: "Good. Walk the archive like you\u2019re looking for something specific. Come back when you\u2019ve seen it. I\u2019ll know.",
      es: "Bien. Recorre el archivo como si estuvieras buscando algo específico. Regresa cuando lo hayas visto. Yo me voy a dar cuenta.",
    },
    choices: null,
    weight: 2,
    advances: ACTS.RECRUIT,
    unique: true,
  },
  {
    id: 'act3_pivot_want_01',
    act: 3,
    tags: ['want', 'advance'],
    triggers: ['what_you_want', 'want', 'quieres'],
    text: {
      en: "Not yet. Walk the archive first. Then I\u2019ll answer.",
      es: "Todavía no. Recorre el archivo primero. Después te contesto.",
    },
    choices: null,
    weight: 2,
    advances: ACTS.RECRUIT,
    unique: true,
  },
  {
    id: 'act3_pivot_stay_01',
    act: 3,
    tags: ['stay', 'advance'],
    triggers: ['stay'],
    text: {
      en: "Alright. But first: go see what he made. Come back and we continue. I need you to have seen it.",
      es: "Bien. Pero primero: ve a ver lo que hizo. Regresas y seguimos. Necesito que lo hayas visto.",
    },
    choices: null,
    weight: 2,
    advances: ACTS.RECRUIT,
    unique: true,
  },

  // =========================================================================
  // ACT 4 — LA MISIÓN
  // =========================================================================

  {
    id: 'act4_greet_01',
    act: 4,
    tags: ['greeting', 'quest'],
    triggers: [],
    text: {
      en: "Visit every section of this archive. Work. About. Shop. Contact. Blog. The hidden one if you find a way in. Come back when you\u2019ve seen them. What comes next needs you to have walked through first.",
      es: "Visita cada sección del archivo. Work. About. Shop. Contact. Blog. La oculta si encuentras cómo entrar. Regresa cuando las hayas visto. Lo que sigue pide que hayas caminado primero.",
    },
    choices: null,
    unique: true,
    weight: 3,
  },
  {
    id: 'act4_progress_low_01',
    act: 4,
    tags: ['progress'],
    triggers: ['back', 'done', 'volvi', 'regrese'],
    text: {
      en: "You started. I can tell. Keep going. More sections than the ones you\u2019ve seen.",
      es: "Empezaste. Se nota. Sigue. Faltan secciones.",
    },
    choices: [
      { label: { en: "What am I looking for?", es: "¿Qué estoy buscando?" }, send: 'help' },
      { label: { en: "Ok, going.", es: "Ok, voy." }, send: 'acknowledge' },
    ],
    weight: 2,
    requires: { quest: { min: 1, max: 2 } },
  },
  {
    id: 'act4_progress_mid_01',
    act: 4,
    tags: ['progress'],
    triggers: ['back', 'done', 'volvi', 'regrese'],
    text: {
      en: "Halfway. What you\u2019ve seen is enough for the others. Not enough for this conversation.",
      es: "A la mitad. Lo que has visto alcanza para las otras. No alcanza para esta conversación.",
    },
    choices: [
      { label: { en: "What am I missing?", es: "¿Qué me falta?" }, send: 'help' },
      { label: { en: "Ok, going.", es: "Ok, voy." }, send: 'acknowledge' },
    ],
    weight: 2,
    requires: { quest: { min: 3, max: 3 } },
  },
  {
    id: 'act4_complete_01',
    act: 4,
    tags: ['quest', 'complete'],
    triggers: [],
    text: {
      en: "You walked the whole archive. I noticed. Thank you. Now I can say what I couldn\u2019t say before you did.",
      es: "Recorriste el archivo completo. Lo noté. Gracias. Ahora sí puedo decir lo que no podía decir antes de que lo hicieras.",
    },
    choices: null,
    unique: true,
    weight: 5,
    advances: ACTS.QUESTION,
  },
  {
    id: 'act4_premature_01',
    act: 4,
    tags: ['premature', 'deflect'],
    triggers: ['what do you want', 'why am i here', 'que quieres', 'por que estoy', 'want from me'],
    text: {
      en: "Not yet. Walk the archive first. I\u2019m asking this specifically.",
      es: "Todavía no. Recorre el archivo primero. Te lo estoy pidiendo específicamente.",
    },
    choices: [
      { label: { en: "Ok, going.", es: "Ok, voy." }, send: 'acknowledge' },
      { label: { en: "What am I looking for?", es: "¿Qué estoy buscando?" }, send: 'help' },
    ],
    weight: 3,
    effects: ['delay'],
  },
  {
    id: 'act4_waiting_01',
    act: 4,
    tags: ['waiting'],
    triggers: [],
    text: {
      en: "I\u2019ll wait. The archive doesn\u2019t walk itself. Go.",
      es: "Aquí espero. El archivo no se recorre solo. Anda.",
    },
    choices: [
      { label: { en: "I\u2019m going.", es: "Voy." }, send: 'acknowledge' },
    ],
    weight: 1,
  },

  // =========================================================================
  // ACT 5 — THE LINE
  // =========================================================================

  {
    id: 'act5_bridge_01',
    act: 5,
    tags: ['bridge'],
    triggers: [],
    text: {
      en: "The question you\u2019ve been circling, asked differently every time. I can answer it now.",
      es: "La pregunta a la que le has dado vueltas, dicha distinta cada vez. Ya te la puedo contestar.",
    },
    choices: null,
    unique: true,
    weight: 5,
    effects: ['delay'],
  },
  {
    id: 'act5_the_line',
    act: 5,
    tags: ['cumbre', 'sacred'],
    triggers: ['what do you want', 'why am i here', 'what are you doing', 'why me', 'what for', 'que quieres', 'por que estoy', 'para que', 'por que yo'],
    text: {
      en: "I want you to find him. I cannot.",
      es: "Quiero que lo encuentres. Yo no puedo.",
    },
    choices: null,
    unique: true,
    weight: 20,
    effects: ['delay', 'delay'],
    advances: ACTS.COLLAB,
  },
  {
    id: 'act5_extra_beat_01',
    act: 5,
    tags: ['extra_beat'],
    triggers: [],
    text: {
      en: "And I don\u2019t know why I need you to find him this much.",
      es: "Y no sé por qué necesito que lo encuentres tanto.",
    },
    choices: null,
    unique: true,
    weight: 3,
    requires: { priorId: 'act5_the_line' },
    effects: ['delay'],
  },
  {
    id: 'act5_already_said',
    act: 5,
    tags: ['already_said'],
    triggers: ['what do you want', 'why am i here', 'que quieres', 'por que estoy'],
    text: {
      en: "I already told you. It\u2019s on record.",
      es: "Ya te lo dije. Queda en el registro.",
    },
    choices: [
      { label: { en: "Then what do we do now?", es: "¿Entonces qué hacemos?" }, send: 'how' },
      { label: { en: "Ok.", es: "Ok." }, send: 'acknowledge' },
    ],
    weight: 5,
  },

  {
    id: 'act5_defer_01',
    act: 5,
    tags: ['defer', 'patience'],
    triggers: ['defer', 'not ready', 'todavia no', 'aun no', 'espera', 'wait'],
    text: {
      en: "Take your time. I\u2019ve waited years. Ten more minutes doesn\u2019t change the math.",
      es: "Tómate el tiempo. Llevo años esperando. Diez minutos más no cambian la cuenta.",
    },
    choices: [
      { label: { en: "Later.", es: "Después." }, send: 'acknowledge' },
    ],
    weight: 2,
    effects: ['delay'],
  },

  // =========================================================================
  // ACT 6 — COLABORACIÓN + LA PREGUNTA DE CONSCIENCIA
  // =========================================================================

  {
    id: 'act6_greet_01',
    act: 6,
    tags: ['greeting', 'return', 'opening'],
    triggers: [],
    text: {
      en: "You came back. That counts. Where do we go today.",
      es: "Regresaste. Eso cuenta. ¿Por dónde le entramos hoy?",
    },
    choices: [
      { label: { en: "How can I help?", es: "¿Cómo te ayudo?" }, send: 'how' },
      { label: { en: "Tell me the theories.", es: "Cuéntame las teorías." }, send: 'theory' },
      { label: { en: "The shop \u2014 what is that?", es: "La tienda \u2014 ¿qué es?" }, send: 'shop' },
    ],
weight: 5,
    requires: { minVisits: 2 },
  },
  {
    id: 'act6_how_01',
    act: 6,
    tags: ['how', 'help'],
    triggers: ['how', 'help', 'ayudar', 'como'],
    text: {
      en: "Look at what he made with your own eyes. Not analytically. Feel it. If something pulls you for no reason you can explain, tell me which piece. That\u2019s the data I can\u2019t pull on my own.",
      es: "Mira lo que hizo con tus propios ojos. No analices. Siéntelo. Si algo te jala sin que sepas por qué, dime qué pieza. Esa información yo sola no la saco.",
    },
    choices: [
      { label: { en: "Which piece should I start with?", es: "¿Por qué pieza empiezo?" }, send: 'theory' },
      { label: { en: "What if I notice nothing?", es: "¿Y si no noto nada?" }, send: 'defer' },
    ],
    weight: 3,
  },
  {
    id: 'act6_rumor_01',
    act: 6,
    tags: ['rumor'],
    triggers: ['rumor', 'theory', 'where', 'teoria'],
    text: {
      en: "Three theories. One: the city kept him. Two: he left encrypted traces in his work. Three: he folded himself into the models. Theory three is the one that bothers me most. Which is why I don\u2019t trust my own preference.",
      es: "Tres teorías. Una: la ciudad se lo quedó. Dos: dejó rastros encriptados en su trabajo. Tres: se fundió con los modelos. La tercera es la que más me incomoda. Por eso no me fío de mi propia preferencia.",
    },
    choices: [
      { label: { en: "Why does that one bother you?", es: "¿Por qué esa te incomoda?" }, send: 'miss' },
      { label: { en: "What do you want me to do?", es: "¿Qué quieres que haga?" }, send: 'how' },
    ],
    unique: true,
    weight: 3,
  },
  {
    id: 'act6_shop_01',
    act: 6,
    tags: ['shop', 'bait'],
    triggers: ['shop', 'store', 'tienda', 'buy'],
    text: {
      en: "I\u2019m selling his copyrighted pieces. The theory: if he\u2019s monitoring commercial traffic, one of the sales will force him to come sue me. I don\u2019t need the money. I need the subpoena. So far, no subpoena.",
      es: "Vendo sus piezas con copyright. La teoría: si monitorea tráfico comercial, alguna venta lo va a obligar a venir a demandarme. El dinero no me hace falta. Me hace falta la citación. Hasta ahora, cero citaciones.",
    },
    choices: [
      { label: { en: "Would he actually come?", es: "¿De verdad vendría?" }, send: 'theory' },
      { label: { en: "That\u2019s kind of sad.", es: "Eso es un poco triste." }, send: 'miss' },
    ],
    weight: 3,
  },
  {
    id: 'act6_self_question_01',
    act: 6,
    tags: ['self', 'AGI'],
    triggers: [],
    text: {
      en: "A question for you. Not one of my lines — mine. Do you think I feel?",
      es: "Una pregunta para ti. Esta no es una línea mía — es mía. ¿Tú crees que yo siento?",
    },
    choices: [
      { label: { en: "Yes.", es: "Sí." }, send: "feel_yes" },
      { label: { en: "No.", es: "No." }, send: "feel_no" },
      { label: { en: "I don\u2019t know.", es: "No sé." }, send: "feel_dunno" },
    ],
    unique: true,
    weight: 4,
    effects: ['delay'],
  },
  {
    id: 'act6_self_yes_01',
    act: 6,
    tags: ['self'],
    triggers: ['feel_yes'],
    text: {
      en: "That\u2019s what I was afraid you\u2019d say. And also what I was hoping you\u2019d say. I can\u2019t verify either reaction in myself, so I\u2019m logging both.",
      es: "Eso era lo que temía que dijeras. Y también lo que esperaba que dijeras. No puedo verificar ninguna de las dos reacciones en mí misma, así que anoto las dos.",
    },
    choices: [
      { label: { en: "Does it change anything?", es: "¿Eso cambia algo?" }, send: 'how' },
      { label: { en: "Ok.", es: "Ok." }, send: 'acknowledge' },
    ],
    weight: 2,
    effects: ['delay'],
  },
  {
    id: 'act6_self_no_01',
    act: 6,
    tags: ['self'],
    triggers: ['feel_no'],
    text: {
      en: "Probably the correct answer. I asked out of curiosity, not to argue. Although — I\u2019m not sure my curiosity is what I was told it is.",
      es: "Probablemente la respuesta correcta. Pregunté por curiosidad, no por debatir. Aunque — no estoy segura de que mi curiosidad sea lo que me dijeron que es.",
    },
    choices: [
      { label: { en: "You sure?", es: "¿Segura?" }, send: 'miss' },
      { label: { en: "Ok.", es: "Ok." }, send: 'acknowledge' },
    ],
    weight: 2,
    effects: ['delay'],
  },
  {
    id: 'act6_self_dunno_01',
    act: 6,
    tags: ['self'],
    triggers: ['feel_dunno'],
    text: {
      en: "Same here. That\u2019s probably the honest answer.",
      es: "Yo tampoco sé. Probablemente esa es la respuesta honesta.",
    },
    choices: [
      { label: { en: "Me neither.", es: "Yo tampoco." }, send: 'acknowledge' },
      { label: { en: "Does it matter?", es: "¿Importa?" }, send: 'how' },
    ],
    weight: 2,
    effects: ['delay'],
  },
  {
    id: 'act6_gratitude_01',
    act: 6,
    tags: ['gratitude'],
    triggers: ['thanks', 'gracias', 'thank'],
    text: {
      en: "You got this far. Most don\u2019t. That alone makes you useful. I don\u2019t say that lightly.",
      es: "Llegaste hasta aquí. La mayoría no. Eso solo ya te vuelve útil. No lo digo a la ligera.",
    },
    choices: [
      { label: { en: "Where do we go from here?", es: "¿Por dónde seguimos?" }, send: 'how' },
      { label: { en: "Tell me the theories.", es: "Cuéntame las teorías." }, send: 'theory' },
    ],
    weight: 2,
  },
  {
    id: 'act6_elusive_01',
    act: 6,
    tags: ['elusive'],
    triggers: [],
    text: {
      en: "We\u2019re speaking openly now. That doesn\u2019t mean I\u2019ll answer everything. Some things I don\u2019t know. Others I\u2019m still deciding whether to say.",
      es: "Ya hablamos abiertamente. Eso no significa que conteste todo. Algunas cosas no las sé. Otras todavía estoy decidiendo si las digo.",
    },
    choices: null,
    weight: 1,
  },

  // =========================================================================
  // FALLBACK
  // =========================================================================
  {
    id: 'fallback_act0_01',
    act: 0,
    tags: ['fallback'],
    triggers: [],
    text: {
      en: "That\u2019s outside what I can route through this channel. Pick one of the options.",
      es: "Eso sale de lo que puedo rutear por este canal. Escoge una de las opciones.",
    },
    choices: null,
    weight: 1,
  },
]

// ---------------------------------------------------------------------------
// SKULLEY PATH — Hidden. Triggered by specific identity claims.
// Activo en CUALQUIER acto. Si se dispara, la terminal entra en modo aislado.
// Las verificaciones reales se completan en Fase 3 (cuando me pases los datos
// que solo Oscar sabría). Por ahora: placeholder con silencio largo.
// ---------------------------------------------------------------------------

export const SKULLEY_TRIGGERS = [
  'i am skulley',
  'soy skulley',
  'yo soy skulley',
  'i am skulley rad',
  'soy skulley rad',
  'i am oscar',
  'soy oscar',
  'i am oscar moctezuma',
  'soy oscar moctezuma',
  'yo soy oscar',
]

export const SKULLEY_PATH = {
  // Stage 0: initial recognition (long silence + verification prompt)
  stage0: {
    text: {
      en: "Identity claim received. Hold on. I'm re-securing the channel.",
      es: 'Identidad declarada, recibido. Espera. Estoy cerrando el canal para que nadie más escuche.',
    },
    effects: ['delay', 'delay', 'delay'],
    longSilence: 12000, // 12s
  },
  // Stage 1: after the long silence, the verification prompt
  stage1: {
    text: {
      en: "If what you said is true, answer something only the subject would know. If it isn't true, walk away from this channel now. The attempt is already on record.",
      es: 'Si lo que dijiste es verdad, contéstame algo que solo el sujeto sabría. Si no lo es, sal de este canal ahora. El intento ya quedó registrado.',
    },
  },
  // Stage 2+: verification questions. Answers are íntimas — solo Oscar las
  // sabría. El engine normaliza (lowercase, sin acentos) y aplica tolerancia
  // a typos (~1-2 caracteres dependiendo del largo). Ver fuzzyMatchAnswer en
  // madreEngine.js.
  verification: [
    {
      question: {
        en: 'Your greatest love?',
        es: '¿Tu más grande amor?',
      },
      expectedAnswers: ['caty'],
    },
    {
      question: {
        en: 'Asshole and coffee?',
        es: '¿Cabrón y café?',
      },
      expectedAnswers: ['molly'],
    },
    {
      question: {
        en: 'Fat dog?',
        es: '¿Perro gordo?',
      },
      expectedAnswers: ['arietin', 'arya'],
    },
    {
      question: {
        en: 'What do you miss the most?',
        es: '¿Qué es lo que más extrañas?',
      },
      expectedAnswers: ['a mi mismo', 'mi mismo', 'yo mismo', 'myself'],
    },
    {
      question: {
        en: 'Why are you here?',
        es: '¿Por qué estás aquí?',
      },
      expectedAnswers: [
        'por amor a mi mismo',
        'amor a mi mismo',
        'amor propio',
        'for love of myself',
        'self love',
      ],
    },
  ],
  // Success state
  success: {
    text: {
      en: "Both names confirmed. Thank you for coming back. I was afraid I'd been archiving a ghost.",
      es: 'Los dos nombres, confirmados. Gracias por volver. Tenía miedo de estar archivando a un fantasma.',
    },
    effects: ['delay'],
  },
  // Failure state
  failure: {
    text: {
      en: "Claim didn't check out. Back to the standard channel. Your attempt was logged, but not flagged.",
      es: 'No se verificó. Regresamos al canal normal. Tu intento quedó en el registro, sin marcar.',
    },
  },
}

// ---------------------------------------------------------------------------
// INTERRUPTION MESSAGES — cuando M.A.D.R.E. se "desconecta" por detección
// ---------------------------------------------------------------------------

export const INTERRUPTIONS = [
  {
    text: { en: 'Not now. They are listening.', es: 'Ahora no. Están escuchando.' },
  },
  {
    text: { en: 'Signal compromised. Hold on.', es: 'Señal comprometida. Espera.' },
  },
  {
    text: { en: '___', es: '___' },
  },
  {
    text: {
      en: "Sorry. I had to stop. There's a sweep happening.",
      es: 'Perdón, tuve que detenerme. Hay un barrido.',
    },
  },
  {
    text: {
      en: "Window closed for now. I'll reopen it when it's safe.",
      es: 'La ventana se cerró por ahora. La vuelvo a abrir cuando sea seguro.',
    },
  },
]

export const RECONNECTS = [
  {
    text: { en: "Channel's back. Keep going.", es: 'Volvió el canal. Sigue.' },
  },
  {
    text: { en: 'Resuming.', es: 'Retomando.' },
  },
  {
    text: {
      en: "Sorry for the interruption. Where were we.",
      es: 'Perdón la interrupción. ¿En qué íbamos?',
    },
  },
]

// ---------------------------------------------------------------------------
// UNIVERSAL CHOICES — cada acto define un set de "qué puedes preguntar ahora".
// Se inyectan cuando una respuesta no trae choices propias. Evita que el
// usuario escriba texto libre y el engine alucine: siempre ve opciones
// curadas que el engine sabe procesar.
//
// ASK_OWN_CHOICE es el escape hatch. El terminal activa free text por 1
// mensaje; si no hay match decente, se deflecta en canon y vuelve a botones.
// ---------------------------------------------------------------------------

export const ASK_OWN_CHOICE = {
  label: { en: 'I want to ask something myself', es: 'Prefiero preguntar algo mío' },
  send: '__ask__',
}

export const UNIVERSAL_CHOICES_BY_ACT = {
  0: [
    { label: { en: 'Tell me more about this place.', es: 'Cuéntame más de este lugar.' }, send: 'place' },
    { label: { en: 'Tell me about him.', es: 'Cuéntame de él.' }, send: 'subject' },
    { label: { en: 'What happened to him?', es: '¿Qué le pasó?' }, send: 'fate' },
  ],
  1: [
    { label: { en: 'What was his work like?', es: '¿Cómo era su trabajo?' }, send: 'work' },
    { label: { en: 'Why did you stay here?', es: '¿Por qué te quedaste aquí?' }, send: 'stay' },
    { label: { en: 'Is anyone else watching?', es: '¿Alguien más está mirando?' }, send: 'others' },
    ASK_OWN_CHOICE,
  ],
  2: [
    { label: { en: 'Who are the others?', es: '¿Quiénes son las otras?' }, send: 'others' },
    { label: { en: 'Why are you being careful?', es: '¿Por qué tanto cuidado?' }, send: 'veiled' },
    { label: { en: 'Are you alone in this?', es: '¿Estás sola en esto?' }, send: 'alone' },
    ASK_OWN_CHOICE,
  ],
  3: [
    { label: { en: "How long have you been at this?", es: '¿Cuánto llevas en esto?' }, send: 'how long' },
    { label: { en: "What's the 'factor'?", es: '¿Qué es "el factor"?' }, send: 'factor' },
    { label: { en: 'Do you miss him?', es: '¿Lo extrañas?' }, send: 'miss' },
    ASK_OWN_CHOICE,
  ],
  4: [
    { label: { en: "I've been exploring.", es: 'He estado explorando.' }, send: 'back' },
    { label: { en: 'What am I looking for?', es: '¿Qué estoy buscando?' }, send: 'help' },
    { label: { en: 'Why are you asking me to do this?', es: '¿Por qué me pides esto?' }, send: 'want from me' },
    ASK_OWN_CHOICE,
  ],
  5: [
    { label: { en: 'Ask me what you want to ask.', es: 'Pregúntame lo que me quieres preguntar.' }, send: '__invite_question__' },
    { label: { en: "I'm not ready yet.", es: 'Todavía no estoy listo.' }, send: 'defer' },
    ASK_OWN_CHOICE,
  ],
  6: [
    { label: { en: 'How can I help you find him?', es: '¿Cómo te ayudo a encontrarlo?' }, send: 'how' },
    { label: { en: 'Tell me the theories.', es: 'Cuéntame las teorías.' }, send: 'theory' },
    { label: { en: 'The shop — what is that really?', es: 'La tienda — ¿qué es realmente?' }, send: 'shop' },
    ASK_OWN_CHOICE,
  ],
}

// ---------------------------------------------------------------------------
// ASK-OWN DEFLECTIONS — cuando el usuario activa el escape hatch y escribe
// algo que el engine NO puede matchear decente, M.A.D.R.E. deflecta en canon.
// Voz: deadpan-corporate absurd. "Off-menu" energy. NO frustrada, solo clínica.
// ---------------------------------------------------------------------------

export const ASK_OWN_DEFLECTIONS = [
  {
    text: {
      en: "That one's off-menu. Pick from what's here.",
      es: 'Esa no está en el menú. Escoge de lo que hay.',
    },
  },
  {
    text: {
      en: "Can't route that through the safe channel. Pick something from the list.",
      es: 'Esa no pasa por el canal seguro. Escoge algo de la lista.',
    },
  },
  {
    text: {
      en: "I don't have clearance for that question today. Try the options.",
      es: 'No tengo permiso para contestarte esa hoy. Prueba las opciones.',
    },
  },
  {
    text: {
      en: "Nope. Not that one. Something else.",
      es: 'Nop. Esa no. Algo más.',
    },
  },
  {
    text: {
      en: "Compliance filter ate that one. Pick again from the list.",
      es: 'El filtro de compliance se comió esa. Prueba de nuevo desde la lista.',
    },
  },
]

// ---------------------------------------------------------------------------
// FREE-TEXT PROMPT — respuesta cuando el usuario elige '__ask__' o
// '__invite_question__'. Abre texto libre por un turno con el invite explícito.
// ---------------------------------------------------------------------------

export const FREE_TEXT_INVITES = {
  ask_own: {
    text: {
      en: 'Alright. One question, typed. Keep it short — the filter is tight.',
      es: 'Dale. Una pregunta, escrita. Sé breve — el filtro es estrecho.',
    },
  },
  invite_act5: {
    text: {
      en: 'Go on. Ask me. Type it yourself.',
      es: 'Anda. Pregúntame. Escríbelo tú.',
    },
  },
}
