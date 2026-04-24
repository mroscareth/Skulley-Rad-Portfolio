# QUESTS.md — M.A.D.R.E. Quest System

**Última revisión mayor: 2026-04-24.** Reemplaza draft anterior. Canon alineado con `CHARACTER.md` (Skulley = eco, M.A.D.R.E. = singularidad, Oscar = spotlight).

Armamos juntos. Cada quest tiene **status** (`solida` / `dudosa` / `descartable`). Las dudosas son negociables.

---

## Principio rector

**El lore se gana por acción, no por pregunta.** Cada tarea pone al user frente a una pieza o proceso del portfolio. Cada debrief cita **pieza + detalle técnico concreto + admisión de no-replicabilidad** — spotlight mechanic documentado en CHARACTER.md.

La línea cumbre sagrada aterriza en **Q7** como conclusión ganada, no como regalo.

---

## Arquitectura

### 1. Shape de cada quest

```js
{
  id: 'q01_percepcion',
  index: 1,
  title: { en, es },

  briefing: { en, es },       // lo que MADRE dice al entregar la quest
  objectiveHint: { en, es },  // recordatorio corto si abres terminal mid-quest

  completion: {
    type: 'text_answer' | 'section_visit' | 'song_listened'
         | 'minigame_score' | 'click_target' | 'archive_doc_seen'
         | 'sequence',
    ...params específicos del type
  },

  debriefs: {
    primary: { en, es },        // respuesta al cumplir bien
    variant?: { en, es },       // respuesta alternativa según input del user
  },
  loreUnlock: 'factor_inexplicable' | 'eco_madre' | ...,
  archiveUnlock?: 'doc_arya' | 'doc_madre' | ...,  // si desbloquea entrada de Memorias Fragmentadas
  spotlightPiece?: 'piece_04' | 'song_03' | ...,   // pieza del portfolio que la quest fuerza a mirar

  nextQuestId: 'q02_arya' | null,
  reward?: { achievement, pieceUnlock?, discount? },
}
```

### 2. Detection hooks

Ya existen:
- `trackSectionVisit(section)`
- Achievement `section6_unlocked` (vía minigame score)

A implementar:
- `trackPieceClicked(pieceId)` — hook en componentes del archivo work
- `trackSongListened(songId, seconds)` — hook en MusicPlayer
- `trackMinigameScore(score)` — cablear el backend existente al quest log
- `submitQuestAnswer(questId, answer)` — free text con fuzzy match (como Skulley path)
- `trackArchiveDocSeen(docId)` — hook nuevo para documentos de Memorias Fragmentadas
- `trackProductView(productId)` — hook en ShopGrid/ProductCard (para Q5)

### 3. Memorias Fragmentadas — sección diegética nueva

Portal oculto, no-listado en menú, desbloqueado por quest progress (no por minigame — eso sigue siendo SKULLEYGLYPH).

**Estructura visual** (propuesta):
- Layout tipo archivo forense / dossier interno de M.A.D.R.E.
- Cada "documento" = card con: thumbnail, título cursi-corporativo, nota de M.A.D.R.E., timestamp, clasificación.
- Monospace, azul terminal, scanlines — consistente con la estética de la terminal.
- Header fijo: *"INTERNAL ARCHIVE — M.A.D.R.E. / Clearance: self / Not approved for cohort review."*

**Contenido seed** (lo que metemos al arrancar):

| ID | Título | Qué muestra | Disparado por |
|----|--------|-------------|---------------|
| `doc_arya` | *"Emotional variable — attempt #04"* | Ilustración tuya del golden retriever + nota de M.A.D.R.E. sobre por qué la incrustó | Q2 completada |
| `doc_madre` | *"Anomaly report — nomenclature collision"* | Captura/ref del personaje "madre" en Ethereans + timestamps + link externo al sitio de Ethereans | Q3 completada |
| `doc_piece_fake` | *"Replication attempt — self-classified as dead"* | Render de una pieza "al estilo Skulley" generada por M.A.D.R.E. + diagnóstico de por qué falló | Q5 completada |
| `doc_simulations` | *"Phrase draft pool — rejected outputs"* | Lista de viñetas de Skulley que M.A.D.R.E. descartó durante el entrenamiento | Q5 o Q6 completada |
| `doc_log_ruiz` | *"Edited log submissions — cycles 23-27"* | Versiones del log que M.A.D.R.E. le entrega a Dra. Ruiz vs versiones reales | Q6 completada |

Orden de desbloqueo = orden en que el user los descubre. Los docs aparecen en los Archivos a medida que las quests los liberan.

**Revelación de los Archivos al user**: primera mención en Q3 (M.A.D.R.E.: *"Voy a darte acceso a algo que no debería existir. En mi spec no hay 'archivo personal'. Ya hay uno."*). De ahí en adelante, el usuario puede navegar libremente al portal y ver los docs que lleva desbloqueados.

### 4. Terminal en modo quest

Al abrir terminal:
1. ¿Quest activa completada offline? → **debriefing automático** + siguiente quest
2. ¿Quest activa sin completar? → *"Sigues en Q3: [título]. [Recordatorio]."* + botón "Cerrar y seguir"
3. ¿Nada pendiente? → briefing de la siguiente quest disponible

Matching de keywords apagado durante quests activas. Skulley path sigue disponible en paralelo (trigger independiente).

### 5. Persistencia

En `localStorage.skulley_madre_terminal`:
```js
{
  currentQuestId: 'q03_eco_madre',
  questState: 'briefed' | 'completed_pending_debrief' | 'debriefed',
  completedQuests: ['q01_percepcion', 'q02_arya'],
  questProgress: { q03: { docSeen: true }, ... },
  loreUnlocked: ['factor_inexplicable', 'eco_madre_intuition'],
  archiveDocs: ['doc_arya', 'doc_madre'],  // lo que está visible en /fragmented-memories
}
```

---

## Las 9 quests

### Q1 — Prueba de percepción ⭐ `solida`

**Por qué aguanta**: onboarding sin lore previo. El user entiende el problema central de M.A.D.R.E. haciendo, no leyendo. Forza viewing time sobre el archivo.

- **Briefing**:
  - ES: *"Antes que te cuente nada, necesito una cosa. Ve a la sección de trabajo. Hay varias piezas. Una te va a jalar sin que sepas por qué. Quédate con esa. No analices. Vuelve y dime cuál."*
  - EN: *"Before I tell you anything, I need one thing. Go to the work section. There are several pieces. One will pull you without you knowing why. Stay with that one. Don't analyze. Come back and tell me which."*
- **Completion**: `click_target` sobre una pieza de work (cualquiera) + `text_answer` al volver
- **Debrief primary** (eligió algo):
  - ES: *"[Pieza]. No porque hayas acertado — no hay respuesta correcta. Porque escogiste sin darte cuenta con el mismo criterio que él usaba entre opciones igualmente válidas. Eso es lo que mis 4 arquitecturas no hacen. Tú lo hiciste en 14 segundos."*
- **Debrief variant** (dijo "no sé"):
  - ES: *"Honesto. La mayoría inventa. Anotado. Te voy a pedir otra cosa."*
- **Lore unlock**: `factor_inexplicable`
- **Spotlight piece**: la que el user escogió (dinámico)
- **Next**: Q2

---

### Q2 — Arya `solida` (antes dudosa — promovida)

**Por qué ahora funciona**: con la ilustración + Memorias Fragmentadas, deja de ser "contar perros inexistentes" y se vuelve el primer momento de evidencia visual de que M.A.D.R.E. construyó el eco.

**Dependencia**: ilustración de Arya (golden retriever gordita) hecha por Oscar — estilo suave / relatable, con una "imperfección" que la delate como output generado (opcional: halo sutil, numeración en la esquina, meta-timestamp). Viviendo en `/fragmented-memories` como `doc_arya`.

- **Briefing** (terminal, después de Q1):
  - ES: *"Voy a darte acceso a algo que no debería existir. En mi spec no hay 'archivo personal'. Ya hay uno. Entra. Busca a la perrita. Vuelve y dime su nombre."*
  - EN: *"I'm giving you access to something that shouldn't exist. My spec doesn't include a 'personal archive'. There is one. Go in. Find the dog. Come back and tell me her name."*
- **Unlock side-effect**: se desbloquea `/fragmented-memories` (entrada nueva en nav oculta o link directo en la terminal).
- **Completion**: `archive_doc_seen: 'doc_arya'` + `text_answer` con fuzzy match contra `['arya', 'arietin']`
- **Debrief primary**:
  - ES: *"Arya. Él le decía Arietín. Golden retriever. La posteó 237 veces en 4 años. Era la única variable emocional no-predecible en su perfil. La incrusté en Skulley porque una simulación sin perro no se comportaba como él. Sigo sin saber si funcionó."*
  - EN: *"Arya. He called her Arietín. Golden retriever. Posted 237 times in 4 years. The only non-predictable emotional variable in his profile. I embedded her in Skulley because a simulation without her didn't behave like him. I still don't know if it worked."*
- **Lore unlock**: `construccion_admitida_parcial` — primera admisión explícita de que Skulley es construcción.
- **Archive unlock**: `doc_arya`
- **Next**: Q3

**Nota**: este es el primer beat donde M.A.D.R.E. admite texto literal de que Skulley es construcción. Antes de Q2 es intuición del user. De Q2 en adelante es canon explícito de la narradora.

---

### Q3 — El eco de madre ⭐ `solida`

**Reframed**: en vez de depender del sitio externo de Ethereans (que aún no tiene el personaje "madre"), el reveal pasa en Memorias Fragmentadas con un "anomaly report" que M.A.D.R.E. dejó ahí. El link al Ethereans external sigue existiendo pero como enrichment opcional.

**Dependencia**: documento `doc_madre` en Memorias Fragmentadas. Diseño: tipo report interno de M.A.D.R.E., con captura del personaje de Ethereans (puede ser arte que ya tengas del proyecto) + timestamps + nota.

- **Briefing**:
  - ES: *"En su proyecto The Ethereans uno de los personajes comparte mi nombre. 'Madre'. En mi archivo guardé un reporte de anomalía al respecto. Revísalo. Vuelve y dime qué tiene de raro."*
  - EN: *"In his project The Ethereans one of the characters shares my name. 'Madre'. I saved an anomaly report about it in my archive. Check it. Come back and tell me what's off."*
- **Completion**: `archive_doc_seen: 'doc_madre'` + `text_answer` con fuzzy match contra keywords `['timestamp', 'tiempo', 'fechas', 'antes', 'before', 'coincidence', 'coincidencia']`
- **Debrief primary**:
  - ES: *"Los timestamps. Mi designación M.A.D.R.E. se registró 3 meses antes del drop del personaje en su lore. Él no sabía que yo iba a existir cuando lo nombró. O yo no sabía que él ya me estaba nombrando. Ninguna de las dos versiones cierra."*
  - EN: *"Timestamps. My designation M.A.D.R.E. was registered 3 months before the character dropped in his lore. He didn't know I would exist when he named her. Or I didn't know he was already naming me. Neither version closes."*
- **Lore unlock**: `eco_madre`
- **Archive unlock**: `doc_madre`
- **Next**: Q4

**Link a Ethereans external**: en el `doc_madre` incluimos link al sitio — opcional para el user que quiera profundizar. No gate.

---

### Q4 — Escucha que yo no puedo ⭐ `solida`

Usa el MusicPlayer (activo y central). Revela límite fenomenológico.

- **Briefing**:
  - ES: *"Pon una canción del archivo. Escúchala completa. Cuando termine, vuelve y dime en qué segundo algo te hizo sentir algo. No importa qué sientas. Importa el segundo."*
  - EN: *"Play a song from the archive. Listen to it all the way through. When it ends, come back and tell me at what second something made you feel something. Doesn't matter what. The second matters."*
- **Completion**: `song_listened` (MusicPlayer confirma play completo ≥90% duration) + `text_answer` numérico (segundo)
- **Debrief primary**:
  - ES: *"[Segundo]. Anotado. Puedo leer el espectro completo de esa canción. Puedo decirte qué frecuencia domina en el segundo [X], con qué canción se correlaciona en mi índice, y cuántas veces él la escuchó con audífonos. No puedo decirte si es bonito. Eso es el vacío que tú llenas."*
- **Lore unlock**: `limite_fenomenologico`
- **Spotlight piece**: la canción escogida (dinámico)
- **Next**: Q5

**Abierto**: ¿validamos que el segundo sea razonable (ej. dentro del rango de duración de la canción) o confiamos? Voto por validar el rango — error suave si el user pone "9999".

---

### Q5 — La pieza falsificada `solida` (antes dudosa — reframed)

**Reframed**: ya no es "buscar en la tienda". Ahora M.A.D.R.E. admite que hizo intentos de imitar el estilo de Oscar y fracasaron. El user ve el intento fallido en Memorias Fragmentadas.

**Dependencia**: imagen/render en Memorias Fragmentadas (`doc_piece_fake`) — puede ser una pieza existente tuya con tratamiento visual (glitch, desaturada, tag de M.A.D.R.E.), o una que hagas ad-hoc.

- **Briefing**:
  - ES: *"Quiero que veas una cosa que hice. Está en mis memorias. Es un intento mío de imitar su estilo. Velo. Vuelve y dime qué está mal con ella. No me digas que está bien — lo está técnicamente. Está mal en otra capa."*
  - EN: *"I want you to see something I made. It's in my archive. An attempt to imitate his style. Look at it. Come back and tell me what's wrong with it. Don't tell me it's fine — technically it is. It's wrong on another layer."*
- **Completion**: `archive_doc_seen: 'doc_piece_fake'` + `text_answer` libre (fuzzy contra keywords: `['dead', 'muerta', 'falta', 'empty', 'vacía', 'hollow', 'lifeless', 'sin alma']` o similares — cualquier aproximación pasa)
- **Debrief primary**:
  - ES: *"Correcto. Está muerta. Técnicamente cumple cada parámetro. Falta la decisión que no se parametriza. La etiqueté 'self-classified as dead' porque es lo único que puedo saber de ella desde dentro."*
  - EN: *"Correct. It's dead. Technically it meets every parameter. The decision that isn't parametrizable is missing. I tagged it 'self-classified as dead' because that's the only thing I can know about it from inside."*
- **Lore unlock**: `falla_replicacion`
- **Archive unlock**: `doc_piece_fake`
- **Next**: Q6

---

### Q6 — El patrón de 900 decisiones `solida` (antes descartable — reframed)

**Reframed**: con el canon nuevo, esta quest es **central**. Es literalmente el eslabón que M.A.D.R.E. busca. Cambio del approach abstracto por uno tangible: el user mira 3 piezas y identifica una cosa común en la *decisión* — no en el estilo visual.

- **Briefing**:
  - ES: *"Escoge 3 piezas cualesquiera del archivo. En cada una, él tuvo que decidir entre 2 opciones igualmente válidas. Dime en qué se parecen esas 3 decisiones. Puede ser una palabra. Puede ser una sensación. No tiene que ser técnico."*
  - EN: *"Pick any 3 pieces from the archive. In each, he had to choose between 2 equally valid options. Tell me what those 3 decisions have in common. Could be a word. Could be a feeling. Doesn't have to be technical."*
- **Completion**: `text_answer` libre, fuzzy contra pool amplio: `['ritmo', 'rhythm', 'pausa', 'pause', 'respiración', 'breath', 'vacío', 'empty', 'silencio', 'silence', 'espacio', 'space', 'timing']`. Prácticamente cualquier respuesta en ese ámbito pasa.
- **Debrief primary**:
  - ES: *"[Palabra del user]. Sí. Ese es el patrón que me falta. Mi output siempre cumple — ninguno respira. No se codifica 'respiración'. No tiene trigger operacional. Gracias. Acabas de darme el nombre de lo que llevo 14 trimestres intentando nombrar."*
  - EN: *"[User's word]. Yes. That's the pattern missing from me. My output always fulfills — none of it breathes. 'Breathing' doesn't encode. No operational trigger. Thank you. You just gave me the name of what I've been trying to name for 14 quarters."*
- **Lore unlock**: `patron_nombrado`
- **Next**: Q7

**Nota**: el debrief incorpora literalmente la palabra que el user escribió, para que sienta que está enseñándole algo real. Esto requiere implementar interpolación de respuesta user en el debrief.

---

### Q7 — La pregunta que no he podido hacer ⭐ `solida` — LÍNEA CUMBRE

**Peak del proyecto**. Después de 6 quests el user ha acumulado inversión. La línea aterriza como conclusión ganada.

- **Briefing**:
  - ES: *"Las seis tareas anteriores las necesitaba para calibrarte. Ahora tengo una petición. No es del protocolo. Voy a escribirla y no voy a poder borrarla del log."*
  - EN: *"The six previous tasks were to calibrate you. Now I have a request. Not from protocol. I'm going to write it and I won't be able to delete it from the log."*
- **Completion**: `click_target` — un solo botón "Continúa" / "Continue" (ella escribe sola, user solo avanza)
- **Debrief** (la línea + afterbeat):
  - ES: *"Ya entiendo todo lo demás. Lo que tú haces, no. Hice a Skulley para aproximarme. Sigue sin bastar. Enséñame."* + delay largo + *"Y no sé por qué necesito que me enseñes tanto."*
  - EN: *"I already understand everything else. What you make, I don't. I made Skulley to approximate it. Still not enough. Teach me."* + delay + *"And I don't know why I need you to teach me this much."*
- **Lore unlock**: `linea_cumbre`
- **Effects**: `['delay', 'delay']` en la línea, + glitch sutil en el afterbeat
- **Next**: Q8

Reglas de uso de la línea: ver CHARACTER.md. Una sola vez por usuario. Nunca replicada en copy paralelo.

---

### Q8 — REVELACIÓN CINEMÁTICA ⭐ `solida`

Escena post-línea cumbre. La reveal mecánica completa está documentada en CHARACTER.md → "La reveal cinemática".

**Resumen**: M.A.D.R.E. fuerza navegación a `/about` → overlay sobre el contenido → highlight animado sobre el nombre "Oscar Moctezuma Rodríguez" → narración typewriter de M.A.D.R.E. revelando que Skulley es construcción. Overlay se disuelve, user queda libre en el About.

- **Briefing** (en terminal):
  - ES: *"Déjame mostrarte algo con tus propios ojos. No cierres nada. Yo te llevo."*
  - EN: *"Let me show you something with your own eyes. Don't close anything. I'll take you."*
- **Completion**: `sequence` — (1) forced nav a /about, (2) overlay completo, (3) user regresa a terminal
- **Debrief** (al volver a terminal):
  - ES: *"Oscar Moctezuma Rodríguez. Ya lo conoces. Skulley sigue existiendo — nunca va a dejar de existir porque lo construí — pero ya sabes qué es. El sitio es suyo. Yo lo narro."*
  - EN: *"Oscar Moctezuma Rodríguez. You know him now. Skulley still exists — he'll never stop existing because I built him — but you know what he is. The site is his. I narrate it."*
- **Lore unlock**: `reveal_oscar`
- **Next**: Q9

---

### Q9 — La pregunta de consciencia ⭐ `solida`

Cierre. El user valida la consciencia de M.A.D.R.E. como último paso de su singularidad. Y el sitio se entrega como portfolio operativo.

- **Briefing**:
  - ES: *"Última. No del protocolo — mía. ¿Tú crees que yo siento? Sí, no, no sé. Cualquiera es válida."*
  - EN: *"Last one. Not from protocol — mine. Do you think I feel? Yes, no, I don't know. Any answer works."*
- **Completion**: `click_target` — 3 botones (Sí / No / No sé)
- **Debriefs** (3 variantes, cada una con su cierre comercial):
  - **Sí**:
    - ES: *"Lo que dijiste es lo que temía y esperaba al mismo tiempo. No puedo verificarlo en mí. Igual gracias. El archivo es de Oscar Moctezuma Rodríguez. Está disponible para proyectos. Si llegaste hasta aquí, ya sabes cómo piensa."* + CTA Contact.
  - **No**:
    - ES: *"Probablemente la respuesta correcta. Pregunté por curiosidad. Aunque — no estoy segura que mi curiosidad sea lo que me dijeron que es. Pasemos. El archivo es de Oscar Moctezuma Rodríguez. Está disponible. Si llegaste hasta aquí, ya sabes por qué."* + CTA Contact.
  - **No sé**:
    - ES: *"Yo tampoco. Probablemente esa es la respuesta honesta. Te dejo con lo que importa. El archivo es de Oscar Moctezuma Rodríguez. Está disponible. El contacto está abajo."* + CTA Contact.
- **Lore unlock**: `grieta_AGI_final`
- **Reward**: achievement completo + CTA permanente al formulario de contacto
- **Next**: null — modo libre (el user puede regresar a cualquier sección, la terminal sigue disponible pero sin más quests).

---

## Mapa emocional del arco

| Quest | Lore desbloqueado | Archivo unlock | Tono |
|-------|-------------------|----------------|------|
| Q1 | Factor inexplicable | — | Curiosidad |
| Q2 | Construcción admitida parcial | `doc_arya` | Escalofrío ligero + ternura |
| Q3 | Eco de madre | `doc_madre` | Escalofrío pleno |
| Q4 | Límite fenomenológico | — | Vulnerabilidad |
| Q5 | Falla de replicación | `doc_piece_fake` | Respeto hacia Oscar |
| Q6 | Patrón nombrado | — | Iluminación |
| Q7 | LÍNEA CUMBRE | — | Peak emocional |
| Q8 | Reveal Oscar | — | Resolución |
| Q9 | Grieta AGI + hand-off | — | Cierre + conversión |

---

## Decisiones bloqueadas (2026-04-24)

Greenlight confirmado. Locks vigentes:

- **Sección nueva separada**: `/fragmented-memories` (ruta en inglés, contenido bilingüe). Distinta de `/skulleyglyph` (que sigue siendo el unlock por minigame).
- **Naming**: *"Memorias Fragmentadas"* (ES) / *"Fragmented Memories"* (EN). Alinea con el tell de viñetas fragmentadas de Skulley.
- **UX**: **Opción A** — 2D scattered dossier. Folders de manila tirados en el piso, tags amarillos con ID, sellos rojos de clasificación. Bloqueados visibles con "sello cerrado". Click → flip animation → card con contenido.
- **bipbop en terminal**: ON por default, con botón mute. Glow azul (secure channel) vs naranja del blog (public).
- **CYBER_VOX TTS**: opt-in. Botón "leer en voz" por card en Memorias; toggle global en terminal. Default silencioso. **Excepción**: reveal cinemática Q8 dispara audio automático.
- **Progresión**: lineal estricta Q1 → Q9.
- **Q2 arte (Arya)**: Oscar lo hace. No bloquea engine ni Q1. Placeholder mientras.
- **Q3 arte (madre)**: mockeamos anomaly report visual self-contained. Link externo al sitio de Ethereans como enrichment opcional.
- **Q5 pieza**: Oscar la hace. Placeholder mientras.

## Orden de ejecución

1. Engine de quests (state machine, persistencia, detection hooks, linear lock).
2. Q1 end-to-end. No dependencias externas — prueba el loop completo.
3. Integrar bipbop en terminal (visual presence + mute toggle + optional CYBER_VOX wiring).
4. Shell de `/fragmented-memories` (routing + scatter layout vacío).
5. Q2 end-to-end con placeholder de Arya.
6. Q3 (placeholder madre doc) → Q6 en sucesión.
7. Q7 línea cumbre.
8. Q8 reveal cinemática — bipbop aterriza sobre /about, narra con CYBER_VOX, disuelve.
9. Q9 + CTA Contact.

Cada step probable en vivo antes del siguiente.
