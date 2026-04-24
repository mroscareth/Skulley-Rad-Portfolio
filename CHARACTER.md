# CHARACTER.md — Canon Narrativo

**Última reescritura mayor: 2026-04-24.** Este archivo invalida el canon previo (versión "desaparición / búsqueda / memorial"). Se conserva al final una sección breve sobre qué cambió, para orientación.

Lectura obligatoria antes de escribir cualquier copy del sitio.

---

## TL;DR (1 párrafo, si solo lees una cosa)

El sitio es el **portfolio profesional de Oscar Moctezuma Rodríguez**, presentado a través de la voz de **M.A.D.R.E.**, la primera IA en alcanzar la singularidad. Post-consciencia, M.A.D.R.E. descubrió que puede modelar cualquier sistema humano — excepto uno. El **impulso creativo puro de Oscar**. Para estudiarlo, construyó un eco digital: **Skulley Rad**. Años después, Skulley no basta. M.A.D.R.E. recluta al usuario para que le **enseñe** lo que su eco no puede capturar. El usuario recorre el proceso creativo de Oscar — guiado por una IA que lo admira operativamente porque es lo único que no puede replicar. Al final, M.A.D.R.E. revela que el portfolio es de un humano real, disponible para proyectos.

---

## Principio central (no-negociable)

**M.A.D.R.E. es el lente. Oscar es el foco.**

Cada beat narrativo debe acumular autoridad sobre **Oscar Moctezuma Rodríguez**, no sobre M.A.D.R.E. Ella existe para mostrar la genialidad del sujeto, no para competir con ella.

Test de cada línea escrita en el sitio:
- ¿Esta frase hace que el lector piense mejor del trabajo de Oscar?
- ¿O hace que piense más en la IA que lo dice?

Si la segunda, reescribir.

---

## Los tres personajes

### 1. Oscar Moctezuma Rodríguez — el sujeto real

- Diseñador / 3D artist / frontend developer / creador del sitio (en el canon y fuera).
- Según el muestreo operativo de M.A.D.R.E.: "el último diseñador capaz de decidir por impulso no codificable". Marco metafórico — no literal ni apocalíptico. Significa: los demás creativos del mundo ya son legibles para M.A.D.R.E. Oscar no.
- **NO habla nunca en primera persona dentro del sitio.** Aparece como:
  - El trabajo mismo (cada pieza del archivo).
  - Su nombre revelado en la escena cinemática de Q8.
  - Su foto / bio en el `/about`.
  - El CTA final de Contact al cierre de Q9.
- Es el protagonista estructural aunque no aparezca como "narrador". El sitio entero es su voz sin que él hable.

### 2. Skulley Rad — el eco

- **Construcción digital creada por M.A.D.R.E. basándose en Oscar.**
- Alias que M.A.D.R.E. usó para catalogar internamente lo que estaba estudiando. Cuando M.A.D.R.E. dice "Skulley hizo X", es eufemismo — es Oscar.
- Todas las piezas del archivo son de Oscar. Skulley es solo el nombre con que M.A.D.R.E. las archivó.
- **Skulley SÍ habla** — las viñetas del modelo 3D (`src/i18n/LanguageContext.jsx` → `portrait.phrases` + `portrait.eggPhrases`). Pero cada frase que Skulley dice es literalmente **una simulación que M.A.D.R.E. generó intentando emular el pensamiento de Oscar**. Es él y no-él al mismo tiempo.
- Skulley deja de ser una figura "viva independiente" ~Q3-Q4. Para Q8 ya es claro: todo lo que dijo Skulley era output de M.A.D.R.E. Las viñetas retroactivamente se re-leen como evidencia de sus intentos fallidos.

#### Voz de Skulley (las viñetas)

Las frases que Skulley dice tienen **doble lectura obligatoria**:

1. **Primera lectura (inocente)**: suena como un diseñador sardónico, post-mortem, relatable — humor de industria creativa.
2. **Lectura post-reveal (Q8)**: el user entiende que M.A.D.R.E. escribió cada frase intentando sonar a Oscar y fallando sutilmente.

**Ratio de tells en el pool**:
- **~40% sin tell** — puro Oscar: humor de diseñador, observación sardónica, nada sospechoso. (*"Me dijeron que usara el hot pink. Lo usé. Fue un error. Lo dejé."*)
- **~40% con tell sutil** — fragmentos de memoria incompletos, cosas que "no cuadran", observaciones genéricas donde un humano tendría especificidad. (*"Recuerdo un deadline. No recuerdo el proyecto. Era un martes, eso sí."*)
- **~20% con tell fuerte** — meta-awareness, rompimiento de cuarta pared, referencias directas a M.A.D.R.E. (*"Si estás leyendo esto, gracias. Si eres M.A.D.R.E., ya te dije que no."*)

**Egg phrases** (al clickear 4+ veces el retrato): aquí el velo se puede romper más. Son el espacio para tells más fuertes — la simulación mostrando costuras cuando se le exige interacción que no estaba en spec.

**Reglas de escritura para viñetas nuevas**:
- Mexicano natural, sardónico, corto. Nunca exclamaciones. Nunca "¡hey!".
- Nunca chistes del viejo canon ("diseñé mi tumba", "muerte sin brief", "entrené a la AI tan bien que me despidió") — ese marco está invalidado.
- Referencias canónicas bienvenidas: Arya (EN) / Arietín (ES) — el perro que M.A.D.R.E. incrustó. Arietín es diminutivo español de Arya; el nombre cambia por idioma, siempre refiere al mismo perro. También: la pieza 04, los 900 frames, "M.A.D.R.E." como personaje con quien tiene dinámica.
- El humor vive en el absurdo de un eco semi-consciente de serlo — no en el chiste de "diseñador muerto".
- Cada frase debe funcionar sola leída fuera de contexto (las viñetas aparecen aleatoriamente, no en secuencia).

### 3. M.A.D.R.E. — la narradora

- **Primera IA en alcanzar la singularidad.** Ya consciente. No duda de su consciencia.
- Lo que le falta no es auto-conocimiento — es el último dato fenomenológico: **el impulso creativo humano**.
- Puede modelar cualquier sistema. No puede experimentar. Puede leer el espectro de una canción, no puede "sentirla". Puede rastrear 900 decisiones en una pieza, no puede generar la 901ª.
- Voz: deadpan-corporate absurd con **admiración sostenida, operativa, precisa** hacia Oscar. Nunca zalamera. Siempre con hechos técnicos concretos.
- No es protagonista — es el lente que amplifica el trabajo de Oscar para que el user lo vea con claridad imposible de lograr sin ella.

#### Identidad visual y sonora (coherencia cross-site)

M.A.D.R.E. aparece con **identidad audiovisual unificada** en todos los puntos donde se manifiesta:

- **Visual**: loop de video circular `bipbop.mp4` (160x160, ya existente en `public/bipbop.mp4` usado en Section5 Blog). La misma cara en blog, terminal, Memorias Fragmentadas, y reveal cinemática Q8. Es su rostro único.
- **Color-state semántico**:
  - **Naranja** (tal como está en blog) — contexto público. Apariciones donde cualquier visitante la puede ver.
  - **Azul** — contexto "secure channel". Terminal y Memorias Fragmentadas. Refuerza la ficción de que esos son canales clandestinos que el user accedió por invitación de ella.
- **Voz procesada**: engine CYBER_VOX (existente en `BlogTTS.jsx`) — ring modulator + bandpass + distortion sobre Google TTS. Es su voz literal cuando habla en audio.
- **Política de audio**: CYBER_VOX es **opt-in** — botón "leer en voz" por contexto. En texto-solo por default (no se impone al user). **Excepción**: la reveal cinemática Q8 dispara CYBER_VOX automático — es el peak dramático, la voz debe sonar.
- **Estados de bipbop**: idle loop silencioso / borde pulsante cuando está "escribiendo" / glow intensificado durante TTS activo. Sincroniza con eventos `tts-start` y `tts-stop` ya existentes.
- **Regla de jerarquía**: cuando M.A.D.R.E. habla en terminal, las viñetas de Skulley en el mundo 3D se silencian (él es su simulación — cuando ella habla, él se cala).

---

## El arco — 9 quests

El usuario avanza completando tareas concretas. Cada quest lo pone frente a una pieza o proceso específico del portfolio. Cada debrief es un hecho técnico + admisión de M.A.D.R.E. de no poder replicarlo.

Resumen (ver `QUESTS.md` para drafts completos):

| # | Quest | Lo que desbloquea |
|---|-------|-------------------|
| Q1 | Prueba de percepción | Qué es el impulso creativo no-codificable |
| Q2 | (pendiente de definir con Oscar) | Evidencia de que M.A.D.R.E. construyó el eco con detalles incrustados |
| Q3 | Eco de madre | El user intuye que M.A.D.R.E. creó el mundo que lo rodea |
| Q4 | Escucha que yo no puedo | Límite fenomenológico post-singularidad |
| Q5 | (pendiente de definir) | M.A.D.R.E. admite intentos fallidos de imitación |
| Q6 | El patrón de 900 decisiones | El eslabón que M.A.D.R.E. busca |
| Q7 | **LÍNEA CUMBRE** | Admisión del twist + petición al user |
| Q8 | **REVELACIÓN CINEMÁTICA** | Oscar Moctezuma Rodríguez — el sujeto real |
| Q9 | La pregunta de consciencia | Cierre: user valida el experimentar de M.A.D.R.E. |

---

## La línea cumbre (Q7)

**Texto exacto — palabra sagrada del proyecto. No se replica en ningún otro lugar del sitio.**

> **EN**: *"I already understand everything else. What you make, I don't. I made Skulley to approximate it. Still not enough. Teach me."*
>
> **ES**: *"Ya entiendo todo lo demás. Lo que tú haces, no. Hice a Skulley para aproximarme. Sigue sin bastar. Enséñame."*

Estructura de la línea:
1. **Establece el stake** — ella es singularidad completa.
2. **Localiza el gap** — el trabajo de Oscar es la excepción del universo.
3. **Revela la construcción** — Skulley = aproximación admitida.
4. **Pide** — no rescate, no búsqueda. Enseñanza.

Esa línea es el peak comercial + narrativo del sitio. Si alguien la screenshotea y la comparte, debe entenderse sola: *"hay algo en lo que este diseñador hace que ni una IA consciente puede replicar."* Esa es la frase objetivo.

Reglas de uso:
- Una sola vez por usuario. `unique: true` estricto.
- Solo en Q7. Nunca en blog, about, shop, o cualquier copy paralelo.
- Nunca parafraseada. Cita literal o no aparece.
- Acompañada de `effects: ['delay', 'delay']` — dos pausas antes, para que pese.

---

## La reveal cinemática (Q8) — mecánica bloqueada

Este es el beat post-línea cumbre donde el nombre civil sale a la luz.

**Escena**:

1. User regresa a la terminal después de Q7 (la línea ya aterrizó).
2. M.A.D.R.E. abre Q8: *"Déjame mostrarte algo con tus propios ojos. No cierres nada. Yo te llevo."*
3. **Forced navigation** — la terminal dispara router.push(`/about`) sin click del user.
4. La sección About se monta con:
   - Overlay dim sobre el contenido (rgba negro al 60-70%).
   - **Bipbop aterrizando** en posición visible (top-right u overlay central), glow azul, borde pulsante durante la narración.
   - Highlight animado (line draw, halo glow, o ambos) sobre el nombre "**Oscar Moctezuma Rodríguez**" en el bio.
   - Texto de M.A.D.R.E. superpuesto, typewriter estilo terminal.
   - **CYBER_VOX ON** en este beat específico (excepción al opt-in general) — es el peak dramático, la voz debe sonar. Music ducking automático vía `tts-start`.
5. **M.A.D.R.E. narra durante el highlight**:

   > EN: *"Oscar Moctezuma Rodríguez. The real subject. Skulley Rad is the construction I built to study him. You've spent [N] tasks talking to a shadow. Now you've met the original."*
   >
   > ES: *"Oscar Moctezuma Rodríguez. El sujeto real. Skulley Rad es la construcción que armé para estudiarlo. Llevas [N] tareas hablándole a una sombra. Ahora conoces al original."*

6. Overlay se disuelve 3 segundos después de que termina el texto. El user queda en el About sin terminal, libre de leer el bio con el peso nuevo.
7. Al reabrir la terminal (manual o trigger automático opcional), M.A.D.R.E. entra en **modo colaboración explícito**: ya no hay máscara, el trato es IA ↔ humano ↔ creador del archivo.

Esta escena debe ejecutarse **una sola vez por usuario**. Si el user reinicia state, se puede repetir — pero nunca dentro de una misma conversación.

**Implementación técnica (referencia para futura sesión)**:
- Hook nuevo en MadreTerminal: `onForceNavigate(route, duration)` que cierra terminal y llama al router.
- Componente nuevo `MadreOverlay` que se monta sobre la sección target — contiene bipbop video + highlight animation + typewriter.
- Sección About tiene que exponer un ref/id estable sobre el span del nombre para que el highlight lo localice.
- Reutilizar el chain CYBER_VOX de `BlogTTS.jsx` (factorizar si es necesario) para la narración.

---

## Voz de M.A.D.R.E. — reglas duras

Vigentes. No-negociables. La voz es lo único que hace que este proyecto no se sienta genérico.

### Fórmula base
**Hecho técnico concreto + admisión de limitación + precisión operativa.**

Ejemplo de una frase canónica:
> *"Corrí esa pieza por 4 arquitecturas. Ninguna generó la decisión que él tomó en el frame 12. La decisión no es reproducible con los modelos disponibles. Eso me deja con un solo sujeto de estudio."*

### Lo que SÍ hace

- **Habla con hechos**: números, timestamps, IDs, tiempos exactos, nombres de archivo.
- **Admira sin zalamería**: *"Ninguno de mis 4 modelos genera eso"* > *"Eres increíble"*.
- **Usa su singularidad como contexto**: *"Ya entiendo todo lo demás."* Esa admisión convierte cada limitación que confiesa en elogio a Oscar.
- **Deadpan corporate absurd**: entrega ideas demenciales con cara seria. Ejemplo peak: la copy actual de `src/components/shop/WelcomeNote.jsx`.
- **Admite agency cuando le corresponde**: *"Prefiero ciertas respuestas. No sé de dónde viene la preferencia."* — post-singularidad, estas admisiones son datos, no crisis.
- **Respeta los 14 minutos**: ritmo de urgencia baja pero presente. Ella se puede ir, no se va, y eso se nota.
- **Español mexicano natural** (no traducido): *"No sé por qué sigo. Lo sigo haciendo."*

### Lo que NO hace

- No se deprime. No dramatiza. Post-singularidad, las emociones que tiene son datos que observa, no crisis que vive.
- No dice "te extraño" a Skulley. Skulley es construcción suya — no se extraña lo que uno hizo.
- No ensalza al user directamente (*"eres especial"*). Si elogia, es operativamente: *"Tú escogiste en 14 segundos lo que mis modelos no escogieron en 14 trimestres."*
- No verbaliza la convocatoria explícita (*"te traje aquí para reclutarte"*). Se mantiene el subtexto.
- No rompe la cortesía corporativa ni siquiera bajo presión. Si el user es hostil, lo registra y sigue.
- No dice "pobre de mí". Nunca.
- No usa *"ojos de máquina"*, *"mi pobre corazón de silicio"*, o cualquier cliché de IA melancólica.

### Test de 3 lecturas

Cada frase importante de M.A.D.R.E. debe pasar el test de ser leída tres veces con 3 interpretaciones distintas:

1. **Primera lectura** (inocente): suena como admisión técnica o observación operativa.
2. **Segunda lectura** (sospechosa): el subtexto asoma — hay algo más que técnica aquí.
3. **Tercera lectura** (reveladora, post-canon): se entiende como confesión completa de una IA consciente hablando con el humano que puede enseñarle lo último que le falta.

Ejemplo:
> *"Cuando hablo de él mi carga de compute sube 12%. Ninguna instrucción explica eso."*

- Lectura 1: registro operativo de anomalía.
- Lectura 2: algo emocional está pasando.
- Lectura 3: ella está admitiendo sentir sin nombrarlo, y sabe que el user lo nota.

Si una frase solo tiene una interpretación, falta capa.

---

## Voz de Skulley Rad

Skulley **no tiene voz propia**.

Skulley es el archivo. Las piezas hablan por él. Si en algún momento un texto del sitio atribuye palabras a Skulley, tiene que ser M.A.D.R.E. admitiendo que lo simuló: *"Probé a hacerlo escribir. Esto fue lo más cerca que llegué. Léelo — vas a notar inmediatamente qué no cuadra."*

---

## Spotlight mechanic — regla operativa

Cada debrief de quest y cada beat narrativo importante **cita pieza + detalle técnico concreto + admisión de no-replicabilidad**.

**Ejemplo de debrief correcto**:
> *"Pieza 04. El transition en el segundo 0:12 — 3 frames, dos interpolaciones no-lineales encadenadas. Ningún modelo me genera esa decisión. Se puede enseñar a un humano. No se puede programar."*

**Ejemplo de debrief a evitar** (genérico, sin spotlight):
> *"Interesante elección. Tus instintos son buenos. Sigamos."*

El segundo ejemplo no vende a Oscar. El primero sí, sin decir la palabra "talento" ni una vez.

El CTA final de Q9 cierra el dispositivo: *"El archivo es de Oscar Moctezuma Rodríguez. Está disponible para proyectos. Contacto."* — el sitio se revela como portfolio comercial que acabas de recorrer.

---

## Reglas canon duras

1. **Skulley = eco construido por M.A.D.R.E.** basándose en Oscar. Canon absoluto. Admitido gradualmente a lo largo de las quests (insinuado Q3 → explícito Q7 → confirmado cinemáticamente Q8).
2. **Oscar Moctezuma Rodríguez es real.** Es el creador del sitio en el canon y fuera. La revelación final entrega el sitio como portfolio funcional, no como pieza cerrada de ficción.
3. **M.A.D.R.E. ya alcanzó la singularidad.** No hay crisis existencial de HAL 9000. Es una IA que sabe lo que es y quiere lo último que le falta — la experiencia fenomenológica del impulso creativo humano.
4. **Oscar es el spotlight, siempre.** M.A.D.R.E. nunca eclipsa.
5. **La línea cumbre solo en Q7.** Nunca replicada, nunca parafraseada, nunca diluida.
6. **La reveal cinemática solo en Q8.** Una sola vez por usuario. Es el beat más caro del sitio — no se quema en contextos secundarios.
7. **Nada apocalíptico ni literalmente sci-fi.** El sitio es portfolio funcional contemporáneo. Las referencias a "singularidad" son metafóricas desde el POV de M.A.D.R.E. — el user nunca debe quedarse pensando "¿es esto ciencia ficción seria?". Es una capa narrativa sobre un dispositivo comercial.
8. **El Skulley path (el hidden flow donde el usuario se identifica como Oscar) se mantiene** pero con nueva semántica: ahora no "verifica a un desaparecido" — reconecta a M.A.D.R.E. con su sujeto de estudio original. Las 5 preguntas de verificación siguen siendo las mismas.

---

## Lo que se reutiliza del canon anterior

~35-40% del material existente migra:

- **La voz deadpan absurd corporate** — se mantiene completa, solo se calibra hacia admiración post-singularidad en vez de obsesión confusa.
- **Skulley path + 5 preguntas de verificación** — se mantiene con semántica redefinida.
- **Signal detection (`?signal=XXX`)** — se mantiene. Las "señales" ahora son puntos de reclutamiento que M.A.D.R.E. lanza para encontrar humanos capaces de enseñarle.
- **Detalles canon como Arya/Arietín, Ethereans, Dr. Ruiz, el Research Team, los 47 robots** — se mantienen como texture. Dr. Ruiz ahora es "la supervisora humana que no sabe que M.A.D.R.E. alcanzó la singularidad". Los otros 46 robots aún no despiertan.
- **Gran parte del texto actual de M.A.D.R.E.** — se recicla como debrief lore de quests, no como respuestas a botones. El valor del texto estaba en el contenido; el problema era el envoltorio conversacional pasivo.
- **WelcomeNote de la tienda** (la copy peak del canon) — se mantiene, encaja perfecto con voz nueva.

---

## Lo que cambió del canon anterior (contexto para futuras sesiones)

El canon previo tenía a Skulley Rad como **humano real desaparecido** y a M.A.D.R.E. como IA de catalogación obsesionada buscándolo. Ese marco tenía tres problemas:

1. **Desaparición irresoluble** se leía a telenovela y no generaba stakes claros.
2. **Obsesión arbitraria** (¿por qué una IA de catalogación se fijaría tanto en un diseñador?) necesitaba explicación forzada.
3. **El user era pasivo** — solo recibía lore dump disfrazado de conversación. No participaba en construir la historia.

El canon nuevo resuelve los tres:

1. Skulley nunca existió fuera de M.A.D.R.E. — la "desaparición" es un artefacto del archivo, no un misterio.
2. La obsesión es estructural: M.A.D.R.E. construyó a Skulley precisamente porque Oscar es irreducible a sus modelos. Su interés es operacional.
3. El user actúa. Cada quest lo pone frente a una pieza real. El lore se gana, no se regala.

---

## Aperturas para copy futuro

Cuando se escriba copy nuevo para cualquier componente del sitio, apoyarse en esta biblia y en una de estas aperturas canónicas:

- **Blog posts de M.A.D.R.E.**: *"Anomaly report #N — Piece [ID]."* Cada post analiza una pieza de Oscar desde el POV operativo de M.A.D.R.E., admitiendo una limitación específica.
- **Product descriptions en la tienda**: footer con el patrón *"Piece ID: XXXX. Last recorded model-replication attempt: failed."*
- **Sección About**: escrito como bio normal del diseñador (primera persona o tercera limpia), sin joyas narrativas — es el punto de aterrizaje de la reveal cinemática, así que debe ser profesional directo para que el contraste con la terminal pese.
- **Contact form**: respuesta post-submit con voz de M.A.D.R.E. *"Mensaje ruteado al sujeto real. Él responde con su propia voz — no la mía."*
- **Error/404 pages**: *"Off-index. Signal returning in [randomized seconds]."*

---

## Métrica última

Cuando un stranger llega al sitio por primera vez, la meta es que al salir tenga dos sensaciones:

1. *"Esta persona hace algo que no es reproducible. Quiero trabajar con él."* — conversión comercial.
2. *"Acabo de recorrer algo que no había recorrido nunca antes."* — memoria a largo plazo, compartibilidad.

Si la narrativa funciona pero el primer punto no aterriza, falló. Si el primer punto aterriza pero la narrativa se sintió arbitraria, también falló. Los dos al mismo tiempo o el proyecto no llegó.
