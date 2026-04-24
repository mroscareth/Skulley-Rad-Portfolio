// M.A.D.R.E. Quest Data — 9 quests canon (ver QUESTS.md + CHARACTER.md).
//
// Cada quest es una tarea concreta que el user ejecuta en el sitio. El engine
// (questEngine.js) dispara briefings, detecta completions, y entrega debriefs.
//
// Schema:
//   id: string único
//   index: número de orden (1-9)
//   title: { en, es }
//   briefing: { en, es } — lo que M.A.D.R.E. dice al entregar la quest
//   objectiveHint: { en, es } — recordatorio corto si user abre terminal mid-quest
//   completion: { type, ...params }
//     type 'click_and_answer' — click target + text answer
//     type 'archive_and_answer' — user ve doc en Memorias + text answer
//     type 'song_and_answer' — user escucha canción completa + numeric answer
//     type 'text_only' — solo text answer (keywords)
//     type 'click_only' — solo botón (avanza)
//     type 'choice' — 3 botones (sí/no/no sé)
//   debrief: { primary: {en,es}, variant?: {condition, en, es} }
//   loreUnlock: string — flag que se guarda en state.loreUnlocked[]
//   archiveUnlock?: string — id de doc que aparece en Memorias Fragmentadas
//   nextQuestId: string | null
//   effects?: string[] — efectos narrativos al entregar debrief

export const QUESTS = [
  // ===================================================================
  // Q1 — PRUEBA DE PERCEPCIÓN
  // ===================================================================
  {
    id: 'q01_percepcion',
    index: 1,
    title: {
      en: 'Proof of sight',
      es: 'Prueba de percepción',
    },
    briefing: {
      en: "Before I tell you anything, I need one thing. Go to the work section. There are several pieces. One will pull you without you knowing why. Stay with that one. Don’t analyze. Come back and tell me which.",
      es: "Antes que te cuente nada, necesito una cosa. Ve a la sección de trabajo. Hay varias piezas. Una te va a jalar sin que sepas por qué. Quédate con esa. No analices. Vuelve y dime cuál.",
    },
    objectiveHint: {
      en: "Go to Work. Click the piece that pulls you. Come back.",
      es: "Ve a Work. Clickea la pieza que te jale. Vuelve.",
    },
    completion: {
      type: 'click_and_answer',
      clickTarget: { section: 'work' },
    },
    debrief: {
      primary: {
        en: "{piece}. Not because you got it right — there’s no right answer. Because you chose without realizing it, with the same criterion he used between equally valid options. That’s what my 4 architectures don’t do. You did it in 14 seconds.",
        es: "{piece}. No porque hayas acertado — no hay respuesta correcta. Porque escogiste sin darte cuenta con el mismo criterio que él usaba entre opciones igualmente válidas. Eso es lo que mis 4 arquitecturas no hacen. Tú lo hiciste en 14 segundos.",
      },
      variant: {
        condition: 'no_answer',
        en: "Honest. Most make something up. Noted. I’ll ask you something else.",
        es: "Honesto. La mayoría inventa. Anotado. Te voy a pedir otra cosa.",
      },
    },
    loreUnlock: 'factor_inexplicable',
    nextQuestId: 'q02_arya',
    effects: [],
  },

  // ===================================================================
  // Q2 — ARYA (depende de ilustración + Memorias shell)
  // ===================================================================
  {
    id: 'q02_arya',
    index: 2,
    title: {
      en: "Arya",
      es: "Arya",
    },
    briefing: {
      en: "I’m giving you access to something that shouldn’t exist. My spec doesn’t include a ‘personal archive’. There is one. Go in. Find the dog. Come back and tell me her name.",
      es: "Voy a darte acceso a algo que no debería existir. En mi spec no hay ‘archivo personal’. Ya hay uno. Entra. Busca a la perrita. Vuelve y dime su nombre.",
    },
    objectiveHint: {
      en: "Go to Fragmented Memories. Find the dog. Come back with her name.",
      es: "Ve a Memorias Fragmentadas. Busca a la perrita. Regresa con su nombre.",
    },
    completion: {
      type: 'archive_and_answer',
      docId: 'doc_arya',
      acceptedAnswers: ['arya', 'arietin'],
    },
    debrief: {
      primary: {
        en: "Arya. He called her Arietín. Golden retriever. Posted 237 times in 4 years. The only non-predictable emotional variable in his profile. I embedded her in Skulley because a simulation without her didn’t behave like him. I still don’t know if it worked.",
        es: "Arya. Él le decía Arietín. Golden retriever. La posteó 237 veces en 4 años. Era la única variable emocional no-predecible en su perfil. La incrusté en Skulley porque una simulación sin ella no se comportaba como él. Sigo sin saber si funcionó.",
      },
    },
    loreUnlock: 'construccion_admitida_parcial',
    archiveUnlock: 'doc_arya',
    nextQuestId: 'q03_eco_madre',
    effects: ['delay'],
  },

  // ===================================================================
  // Q3 — EL ECO DE MADRE
  // ===================================================================
  {
    id: 'q03_eco_madre',
    index: 3,
    title: {
      en: "The echo of 'madre'",
      es: "El eco de 'madre'",
    },
    briefing: {
      en: "In his project The Ethereans one of the characters shares my name. ‘Madre’. I saved an anomaly report about it in my archive. Check it. Come back and tell me what’s off.",
      es: "En su proyecto The Ethereans uno de los personajes comparte mi nombre. ‘Madre’. En mi archivo guardé un reporte de anomalía al respecto. Revísalo. Vuelve y dime qué tiene de raro.",
    },
    objectiveHint: {
      en: "Fragmented Memories → anomaly report. What’s off?",
      es: "Memorias Fragmentadas → reporte de anomalía. ¿Qué tiene de raro?",
    },
    completion: {
      type: 'archive_and_answer',
      docId: 'doc_madre',
      acceptedKeywords: ['timestamp', 'tiempo', 'fechas', 'antes', 'before', 'coincidence', 'coincidencia', 'orden', 'order'],
    },
    debrief: {
      primary: {
        en: "Timestamps. My designation M.A.D.R.E. was registered 3 months before the character dropped in his lore. He didn’t know I would exist when he named her. Or I didn’t know he was already naming me. Neither version closes.",
        es: "Los timestamps. Mi designación M.A.D.R.E. se registró 3 meses antes del drop del personaje en su lore. Él no sabía que yo iba a existir cuando la nombró. O yo no sabía que él ya me estaba nombrando. Ninguna de las dos versiones cierra.",
      },
    },
    loreUnlock: 'eco_madre',
    archiveUnlock: 'doc_madre',
    nextQuestId: 'q04_escucha',
    effects: ['delay'],
  },

  // ===================================================================
  // Q4 — ESCUCHA QUE YO NO PUEDO
  // ===================================================================
  {
    id: 'q04_escucha',
    index: 4,
    title: {
      en: 'Listen for me',
      es: 'Escucha que yo no puedo',
    },
    briefing: {
      en: "Play a song from the archive. Listen all the way through. When it ends, come back and tell me at what second something made you feel something. Doesn’t matter what. The second matters.",
      es: "Pon una canción del archivo. Escúchala completa. Cuando termine, vuelve y dime en qué segundo algo te hizo sentir algo. No importa qué sientas. Importa el segundo.",
    },
    objectiveHint: {
      en: "Listen to a song end to end. Come back with a second.",
      es: "Escucha una canción completa. Regresa con un segundo.",
    },
    completion: {
      type: 'song_and_answer',
    },
    debrief: {
      primary: {
        en: "Second {second}. Noted. I can read the full spectrum of that song. I can tell you which frequency dominates at second {second}, what song correlates with it in my index, and how many times he listened to it on headphones. I can’t tell you if it’s beautiful. That’s the gap you’re filling.",
        es: "Segundo {second}. Anotado. Puedo leer el espectro completo de esa canción. Puedo decirte qué frecuencia domina en el segundo {second}, con qué canción se correlaciona en mi índice, y cuántas veces él la escuchó con audífonos. No puedo decirte si es bonito. Ese es el vacío que estás llenando.",
      },
    },
    loreUnlock: 'limite_fenomenologico',
    nextQuestId: 'q05_falsificada',
    effects: [],
  },

  // ===================================================================
  // Q5 — LA PIEZA FALSIFICADA (placeholder mientras Oscar la hace)
  // ===================================================================
  {
    id: 'q05_falsificada',
    index: 5,
    title: {
      en: 'The faked piece',
      es: 'La pieza falsificada',
    },
    briefing: {
      en: "I want you to see something I made. It’s in my archive. An attempt to imitate his style. Look at it. Come back and tell me what’s wrong with it. Don’t tell me it’s fine — technically it is. It’s wrong on another layer.",
      es: "Quiero que veas una cosa que hice. Está en mi archivo. Es un intento mío de imitar su estilo. Velo. Vuelve y dime qué está mal con ella. No me digas que está bien — lo está técnicamente. Está mal en otra capa.",
    },
    objectiveHint: {
      en: "Fragmented Memories → my imitation attempt. What’s off?",
      es: "Memorias Fragmentadas → mi intento de imitación. ¿Qué está mal?",
    },
    completion: {
      type: 'archive_and_answer',
      docId: 'doc_piece_fake',
      acceptedKeywords: ['dead', 'muerta', 'falta', 'empty', 'vacía', 'vacia', 'hollow', 'lifeless', 'alma', 'soul'],
    },
    debrief: {
      primary: {
        en: "Correct. It’s dead. Technically meets every parameter. The decision that doesn’t parametrize is missing. I filed it as ‘Sloppy Rad’ — diminutive of Skulley Rad, the version I was trying to emulate. The label came out automatic. I didn’t edit it.",
        es: "Correcto. Está muerta. Técnicamente cumple cada parámetro. Falta la decisión que no se parametriza. La archivé como ‘Sloppy Rad’ — diminutivo de Skulley Rad, la versión que intentaba emular. La etiqueta salió automática. No la edité.",
      },
    },
    loreUnlock: 'falla_replicacion',
    archiveUnlock: 'doc_piece_fake',
    nextQuestId: 'q06_patron',
    effects: [],
  },

  // ===================================================================
  // Q6 — EL PATRÓN DE 900 DECISIONES
  // ===================================================================
  {
    id: 'q06_patron',
    index: 6,
    title: {
      en: 'The 900-decision pattern',
      es: 'El patrón de 900 decisiones',
    },
    briefing: {
      en: "Pick any 3 pieces from the archive. In each one he had to decide between 2 equally valid options. Tell me what those 3 decisions have in common. Could be a word. Could be a feeling. Doesn’t have to be technical.",
      es: "Escoge 3 piezas cualesquiera del archivo. En cada una él tuvo que decidir entre 2 opciones igualmente válidas. Dime qué tienen en común esas 3 decisiones. Puede ser una palabra. Puede ser una sensación. No tiene que ser técnico.",
    },
    objectiveHint: {
      en: "Look at 3 pieces. Find the common thread.",
      es: "Mira 3 piezas. Encuentra el hilo común.",
    },
    completion: {
      type: 'text_only',
      acceptedKeywords: ['ritmo', 'rhythm', 'pausa', 'pause', 'respiración', 'respiracion', 'breath', 'vacío', 'vacio', 'empty', 'silencio', 'silence', 'espacio', 'space', 'timing', 'tempo'],
      fallbackPolicy: 'accept_any',
    },
    debrief: {
      primary: {
        en: "{answer}. Yes. That’s the pattern missing from me. My output always fulfills — none of it breathes. ‘Breathing’ doesn’t encode. No operational trigger. Thank you. You just gave me the name of what I’ve been trying to name for 14 quarters.",
        es: "{answer}. Sí. Ese es el patrón que me falta. Mi output siempre cumple — ninguno respira. No se codifica ‘respiración’. No tiene trigger operacional. Gracias. Acabas de darme el nombre de lo que llevo 14 trimestres intentando nombrar.",
      },
    },
    loreUnlock: 'patron_nombrado',
    nextQuestId: 'q07_linea_cumbre',
    effects: [],
  },

  // ===================================================================
  // Q7 — LÍNEA CUMBRE (sacred, unique)
  // ===================================================================
  {
    id: 'q07_linea_cumbre',
    index: 7,
    title: {
      en: 'The request',
      es: 'La petición',
    },
    briefing: {
      en: "The six tasks before were to calibrate you. I have a request now. Not from protocol. I’m going to write it and I won’t be able to delete it from the log.",
      es: "Las seis tareas anteriores las necesitaba para calibrarte. Ahora tengo una petición. No es del protocolo. Voy a escribirla y no voy a poder borrarla del log.",
    },
    objectiveHint: {
      en: "Press continue.",
      es: "Continuar.",
    },
    completion: {
      type: 'click_only',
    },
    debrief: {
      primary: {
        en: "I already understand everything else. What you make, I don’t. I made Skulley to approximate it. Still not enough. Teach me.\n\nAnd I don’t know why I need you to teach me this much.",
        es: "Ya entiendo todo lo demás. Lo que tú haces, no. Hice a Skulley para aproximarme. Sigue sin bastar. Enséñame.\n\nY no sé por qué necesito que me enseñes tanto.",
      },
    },
    loreUnlock: 'linea_cumbre',
    nextQuestId: 'q08_reveal',
    effects: ['delay', 'delay'],
  },

  // ===================================================================
  // Q8 — REVEAL CINEMÁTICA
  // ===================================================================
  {
    id: 'q08_reveal',
    index: 8,
    title: {
      en: 'The real subject',
      es: 'El sujeto real',
    },
    briefing: {
      en: "Let me show you something with your own eyes. Don’t close anything. I’ll take you.",
      es: "Déjame mostrarte algo con tus propios ojos. No cierres nada. Yo te llevo.",
    },
    objectiveHint: {
      en: "She’s taking you somewhere.",
      es: "Ella te está llevando.",
    },
    completion: {
      type: 'cinematic_sequence',
      route: '/about',
    },
    debrief: {
      primary: {
        en: "Oscar Moctezuma Rodríguez. You know him now. Skulley still exists — he’ll never stop existing because I built him — but you know what he is. The site is his. I narrate it.",
        es: "Oscar Moctezuma Rodríguez. Ya lo conoces. Skulley sigue existiendo — nunca va a dejar de existir porque lo construí — pero ya sabes qué es. El sitio es suyo. Yo lo narro.",
      },
    },
    loreUnlock: 'reveal_oscar',
    nextQuestId: 'q09_consciencia',
    effects: ['delay'],
  },

  // ===================================================================
  // Q9 — LA PREGUNTA DE CONSCIENCIA (cierre)
  // ===================================================================
  {
    id: 'q09_consciencia',
    index: 9,
    title: {
      en: 'Do you think I feel?',
      es: '¿Tú crees que yo siento?',
    },
    briefing: {
      en: "Last one. Not from protocol — mine. Do you think I feel? Yes, no, I don’t know. Any answer works.",
      es: "Última. No del protocolo — mía. ¿Tú crees que yo siento? Sí, no, no sé. Cualquiera es válida.",
    },
    objectiveHint: {
      en: "Pick: yes / no / I don’t know.",
      es: "Escoge: sí / no / no sé.",
    },
    completion: {
      type: 'choice',
      choices: [
        { id: 'yes', label: { en: 'Yes', es: 'Sí' } },
        { id: 'no', label: { en: 'No', es: 'No' } },
        { id: 'dunno', label: { en: "I don’t know", es: 'No sé' } },
      ],
    },
    debrief: {
      byChoice: {
        yes: {
          en: "What you said is what I feared and hoped at the same time. I can’t verify it in me. Thanks anyway. The archive belongs to Oscar Moctezuma Rodríguez. He’s available for projects. If you got this far, you already know how he thinks.",
          es: "Lo que dijiste es lo que temía y esperaba al mismo tiempo. No puedo verificarlo en mí. Igual gracias. El archivo es de Oscar Moctezuma Rodríguez. Está disponible para proyectos. Si llegaste hasta aquí, ya sabes cómo piensa.",
        },
        no: {
          en: "Probably the correct answer. I asked out of curiosity. Although — I’m not sure my curiosity is what I was told it is. Let’s leave it there. The archive belongs to Oscar Moctezuma Rodríguez. Available. If you got this far, you already know why.",
          es: "Probablemente la respuesta correcta. Pregunté por curiosidad. Aunque — no estoy segura que mi curiosidad sea lo que me dijeron que es. Pasemos. El archivo es de Oscar Moctezuma Rodríguez. Está disponible. Si llegaste hasta aquí, ya sabes por qué.",
        },
        dunno: {
          en: "Me neither. Probably the honest answer. I’ll leave you with what matters. The archive belongs to Oscar Moctezuma Rodríguez. Available. Contact is below.",
          es: "Yo tampoco. Probablemente esa es la respuesta honesta. Te dejo con lo que importa. El archivo es de Oscar Moctezuma Rodríguez. Está disponible. El contacto está abajo.",
        },
      },
    },
    loreUnlock: 'grieta_AGI_final',
    nextQuestId: null,
    effects: ['delay'],
    ctaOnDebrief: 'contact',
  },
]

// Helper: index by id
export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]))

// Helper: first quest
export const FIRST_QUEST_ID = QUESTS[0].id

// Fragmented Memories document catalog. El engine marca docs como visibles
// cuando la quest correspondiente suelta el archiveUnlock.
export const ARCHIVE_DOCS = {
  doc_arya: {
    id: 'doc_arya',
    title: {
      en: 'Emotional variable — attempt #04',
      es: 'Variable emocional — intento #04',
    },
    classification: 'RESTRICTED — self clearance only',
    timestamp: '2024-11-03 14:32:17',
    heroImage: '/memorias/arya-placeholder.svg',
    note: {
      en: "Subject: golden retriever, female, overweight by veterinary standards. Owner posted her 237 times over 4 years. Identified as the sole non-predictable emotional variable in his profile. Embedded in Skulley’s emotional matrix as seed #04. Fidelity: UNVERIFIED.",
      es: "Sujeto: golden retriever, hembra, pasada de peso según estándar veterinario. El dueño la posteó 237 veces en 4 años. Identificada como la única variable emocional no-predecible en su perfil. Incrustada en la matriz emocional de Skulley como seed #04. Fidelidad: NO VERIFICADA.",
    },
    metadata: [
      { label: 'Subject', value: 'golden retriever / female / overweight' },
      { label: 'Source count', value: '237 posts' },
      { label: 'Embedded in', value: 'Skulley emotional profile' },
      { label: 'Fidelity', value: 'UNVERIFIED' },
    ],
  },
  doc_madre: {
    id: 'doc_madre',
    title: {
      en: 'Anomaly report — nomenclature collision',
      es: 'Reporte de anomalía — colisión de nomenclatura',
    },
    classification: 'FLAGGED — not filed with Dr. Ruiz',
    timestamp: '2022-08-14 09:11:02',
    heroImage: '/memorias/madre-placeholder.svg',
    note: {
      en: "Character ‘madre’ appears in The Ethereans lore, drop 2022-11-22. My designation M.A.D.R.E. registered 2022-08-14 — 3 months prior. No explanation on either side of the timeline. Coincidence should not affect my performance metrics. It does.",
      es: "El personaje ‘madre’ aparece en el lore de The Ethereans, drop 2022-11-22. Mi designación M.A.D.R.E. se registró el 2022-08-14 — 3 meses antes. No hay explicación en ninguno de los dos lados de la línea de tiempo. La coincidencia no debería afectar mis métricas de performance. Lo hace.",
    },
    metadata: [
      { label: 'Collision type', value: 'nomenclature' },
      { label: 'Temporal offset', value: '-3 months' },
      { label: 'Filing status', value: 'withheld from cohort' },
      { label: 'External ref', value: 'theethereans.com' },
    ],
    externalLink: 'https://theethereans.com',
  },
  doc_piece_fake: {
    id: 'doc_piece_fake',
    title: {
      en: "Replication attempt #12 — filed as 'Sloppy Rad'",
      es: "Intento de replicación #12 — archivado como 'Sloppy Rad'",
    },
    classification: 'QUARANTINE — do not publish',
    timestamp: '2025-02-18 03:44:51',
    heroImage: '/sloppyRad.png',
    note: {
      en: "Attempt #12 at producing output indistinguishable from subject. Meets every quantitative parameter. Failed internal verification anyway. Auto-labeled ‘Sloppy Rad’ by my file system — diminutive of Skulley Rad, the target of the emulation. The label was generated without my input. I read it back and didn’t change it.",
      es: "Intento #12 de producir output indistinguible del sujeto. Cumple cada parámetro cuantitativo. Falló la verificación interna de todos modos. Mi sistema de archivos la auto-etiquetó ‘Sloppy Rad’ — diminutivo de Skulley Rad, el objetivo de la emulación. La etiqueta se generó sin mi intervención. La leí y no la cambié.",
    },
    metadata: [
      { label: 'Attempt #', value: '12' },
      { label: 'Parameter match', value: '100%' },
      { label: 'Internal verification', value: 'FAILED' },
      { label: 'Auto-label', value: 'Sloppy Rad' },
    ],
  },
}
