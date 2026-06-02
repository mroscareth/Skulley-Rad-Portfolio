# HANDOFF — Skulley Rad Portfolio

Documento de estado para retomar el trabajo desde otro equipo. Última sesión **2026-06-02** (skins desbloqueables + gold como shader + banding de escena PENDIENTE).

---

## 🟡 PENDIENTE (2026-06-02) — Banding toon de la ESCENA no iguala al RETRATO

**Problema sin resolver, retomar fresco.** El cel-shading del personaje en la **escena principal** NO logra la **franja de sombra más oscura** (banda `minBand`, casi negra) que SÍ se ve increíble en el **retrato** (`CharacterPortrait`). Oscar quiere que la sombra de la escena se vea igual de profunda y consistente que la del retrato. La escena se ve "pobre": la sombra aparece solo desde ciertos ángulos y/o se siente como "mancha" en vez de un corte limpio proyectado en la forma.

### Diagnóstico (lo que ya entendimos)
- El banding (`src/lib/toonBanding.js`, `applyToonBanding({steps:2, minBand:0.04, bandIndirect:true})`) cuantiza `shade = (difuso directo + indirecto) / luminancia_albedo` en 2 bandas. La sombra cae a `minBand` (~negro) **solo si `shade < 0.25`**.
- **Retrato** (se ve perfecto): `ambientLight 0.45` PLANO + `directionalLight 1.5` frontal `[2,4,3]`, **sin HDRI**. Un solo gradiente direccional + ambient uniforme → terminator limpio y sombra que sí cruza el umbral a la banda negra.
- **Escena** (no jala): tiene **HDRI `<Environment>`** (IBL omnidireccional) que rellenaba las sombras y las sacaba de la banda oscura (caían a la banda MEDIA). Además la key estaba casi **cenital** `[1,10,2.5]` → corte arriba, dependiente de orientación.

### Lo que se intentó esta sesión (en orden)
1. Bajé `envMapIntensity` del personaje en escena `0.5 → 0.28 → 0.12 → 0.08` (Player.jsx, 2 sitios: el clone principal ~L212 y el rigid/desarme ~L1010). Idea: desacoplar al personaje del HDRI. **El escenario conserva su HDRI** (Oscar lo quiere solo para el ambiente del fondo, no para el personaje).
2. Reemplacé la key cenital world-space por **`ToonKeyLight`** (en `HomeScene.jsx`): una directional **relativa a la cámara** (se reposiciona cada frame en frente-derecha-arriba de la vista, apuntando al player) → corte consistente desde cualquier ángulo.
3. Quité la fill direccional (creaba un 2º gradiente que competía → "mancha") y agregué un **`ambientLight 0.32` PLANO** como relleno uniforme de sombra (receta del retrato).

### Estado al cerrar
**Aún NO se ve la franja más negra** de forma consistente. Build verde, pero el look no convence a Oscar. Hipótesis a explorar la próxima:
- La **key cámara-relativa** quizá hace que la sombra se sienta "pegada a la pantalla" en vez de proyectada en la forma. Probar **world-space frontal-upper fijo** (sun-like) con ambient plano bajo, o comparar A/B.
- Verificar si el **ambient 0.32** está levantando la sombra por encima del umbral 0.25 (lo que importa es bajar el relleno para que `shade<0.25`). Tal vez bajar ambient a ~0.18-0.22 y/o subir la key.
- Confirmar que `envMapIntensity 0.08` realmente se aplica a TODOS los materiales del personaje (incluido el shader de skins / piezas del desarme) — si algún material conserva env alto, esa zona no bandea.
- Posibilidad: **igualar literal el setup del retrato** (sin IBL en el personaje, ambient ~0.45 plano + 1 key) aceptando que el ambient global aclare un poco la escena, o aplicar el ambient solo al personaje (layers / segundo render).
- Revisar si el **normal-map** del GLB mete ruido en el N·L y ensucia el terminator (probar bandear con la normal geométrica en vez de la perturbada para la cuantización).

### Knobs / archivos
- `src/components/home/HomeScene.jsx`: componente **`ToonKeyLight`** (offsets `-4 / 4 / 3.5`, intensity `2.4`) + `<ambientLight intensity={0.32} color="#aeb9cc">` tras `mainWarmStage >= 1`.
- `src/components/Player.jsx`: `envMapIntensity = 0.08` (2 sitios). El banding se aplica con `applyToonBanding(mm,{steps:2,minBand:0.04,bandIndirect:true})`.
- `src/components/CharacterPortrait.jsx`: el setup que SÍ funciona (ambient 0.45 + dir 1.5 `[2,4,3]`, sin Environment) — verdad de referencia.
- `src/lib/toonBanding.js`: el shader de cuantización (bloque `lights_fragment_end`).

### Otros cambios de la sesión (todos con build verde)
- **Skins desbloqueables como logros** (oil/hologram/void/lava/slime/gold): condiciones reales + persistencia robusta en DB (`useAchievements.js` con buffer pending namespaced + migración sin pérdida). Catálogo en `achievementsCatalog.js`. Logros explicados en `AccountModal` (más ancho, grid 3 col, progreso slime "X/5" + chips de secciones para hologram).
- **5 babosas de slime** coleccionables (3D reales: `SlimeSlug3D.jsx` mesh + `SlimeSlugDOM.jsx` mini-canvas): section6, housebird de About, tarjeta de Work, wander (solo easter-egg), reproductor. Estado en `slimeSlugs.js`.
- **Gold → SHADER** (modo 6 en `skinShaders.js`), ya NO GLB swap (`characterGold.glb` deprecado). Arregló la viñeta atorada en el centro. Oro rico oscuro + sparkles de 4 picos triplanar. Roughness por contexto (glossy retrato / satin escena).
- **Hologram**: visitar 5 secciones ≥15s c/u (contacto solo visitar ~2s); sub-rutas work/blog cuentan al padre. **Oil**: 2 colores al mismo portal SOLO con el rayo del thunder (flag `boltKnocked`). **Lava**: que el rayo te despiece. **Gold/Golden-ticket** → 5000 pts.
- **Tutorial** rediseñado (bienvenida + controles desktop/mobile). **Game UI toggle** recuperable desde el menú. **Power button** mobile reubicado (enfrentado al joystick). **Marquee push** en customize arreglado. **Logo de Privy** quitado (URL rota). Tributo SKULLEYGLYPH arreglado (doble-unlock que se pisaba + backfill de skin_void).

---

## 🟢 ESTADO ACTUAL (2026-05-29) — Customizer de color + sombra de silueta

Feature nueva completa y con build verde: **personalización de color del personaje** (modo cinemático) + mejora de la **sombra**. Sin tocar narrativa.

### Lo que se construyó

- **Customizer de color** — repinta a Skulley: **ojos** (`Eyes`, color + emissive), **esqueleto/cuerpo** (`Head`), **pelo** (`Hair`). Materiales matcheados por NOMBRE del GLB. Funciona gratis con el cel-shading: el banding reescala por luminancia → cambiar `.color` conserva el toon sin recompilar shader.
  - `src/lib/characterColors.js` (**NUEVO**): slot único en `localStorage.skulley_character_colors` + `CustomEvent('character-colors-changed')`. API: `getCharacterColors`, `setCharacterColors`, `resetCharacterColors`, `applyCharacterColorsToScene/Material`. Defaults = colores de fábrica del GLB en sRGB.
  - `src/components/CharacterCustomizer.jsx` (**NUEVO**): panel glass a la derecha. 3 color pickers + **Randomize** (HSL vívido) + Reset. Vive en todos los renders del personaje vía el evento.
  - Aplicado en `Player.jsx`, `CharacterPortrait.jsx`, `CharacterPortraitHero.jsx` (listeners del evento, guard `goldSkinActive` → la skin dorada NO se recolorea).
- **Modo customize cinemático** — botón 🎨 (`SwatchIcon`) en el top-right group (solo HOME) togglea `customizeOpen` en `App.jsx`. Eso:
  - Pasa `customizeActive` por `HomeScene` → `CameraController` hace un **barrido orbital** (interpolación POLAR: azimut por arco más corto + radio + altura) a una toma frontal, personaje a la izquierda, UI a la derecha. **No** lineal (lineal cruzaba por el modelo y flipeaba el lookAt). Mobile: zoom-out (`CUSTOMIZE_FRONT_DIST_MOBILE`) + panel más angosto.
  - `Player.jsx` congela la locomoción (zera el input antes de construir `desiredDir`; idle y simulador siguen vivos — NO early-return).
  - Se ocultan los HUD que estorban (`!customizeOpen` en camera button, mobile cluster, desktop socials/settings, DesktopNav; retrato vía CSS opacity).
- **Efecto mágico (Randomize)** — `RuneBurstParticles.jsx` ahora tiene `fire(opts)` con dos modos: `burst` (radial, el easter egg "POWEROFGOD" del cursed orb, **intacto**) y `spiral` (**vórtice ascendente** estilo portal: runas chiquitas que suben girando desde los pies con twinkle/wander, aparición escalonada). El Randomize dispara `CustomEvent('character-color-burst')` que escucha `HomeOrbs` → `fire({mode:'spiral'})`, + SFX `magiaInicia`/`sparkleBom`.
- **Sombra de silueta** (`src/components/SilhouetteShadow.jsx`, **NUEVO**) reemplaza `BlobShadow` (disco). RTT cenital del personaje (mismo patrón que `CharacterNormalPass`) → plano en el piso con **borde duro cel** (`smoothstep` angosto, sin gradiente). Forma real, se deforma con la pose. Ver DESIGN.md §7.9.

### Intento descartado (no reintroducir sin replantear)
- **DOF en modo customize**: se probó forzar Depth of Field enfocado al personaje con el mundo en blur. Quedó turbio (el personaje no enfocaba limpio, los orbs del fondo se embarraban) → **removido** por decisión de Oscar. Nota técnica útil: `degradedMode` arranca en `true` y el watchdog (`useMemoryWatchdog.js`) nunca lo baja (`if (prev) return true`) → `lowPerf` está SIEMPRE activo → el DOF de toda la app está apagado en la práctica. Revisar si eso es intencional (afecta SMAA/bloom/resolución globalmente).

### Diales para afinar (si Oscar pide ajustes al verlo)
- Encuadre cámara: `CUSTOMIZE_LATERAL`, `CUSTOMIZE_FRONT_DIST`, `*_MOBILE`, `CUSTOMIZE_TARGET_Y`, `CUSTOMIZE_LERP_LAMBDA` en `CameraController.jsx`.
- Runas spiral: `count`, `rise`, `life`, `swirl`, `radius`, `wobble`, `spin` en el `fire({...})` de `HomeOrbs.jsx`.
- Sombra: `size` / `opacity` / `resolution` / `blur` en el `<SilhouetteShadow>` de `HomeScene.jsx`.
- Panel: ancho mobile `w-[min(64vw,260px)]` en `CharacterCustomizer.jsx`.

### Archivos
| Archivo | Estado |
|---|---|
| `src/lib/characterColors.js` | **NUEVO** |
| `src/components/CharacterCustomizer.jsx` | **NUEVO** |
| `src/components/SilhouetteShadow.jsx` | **NUEVO** (reemplaza `BlobShadow.jsx`, que queda sin usar) |
| `src/components/CameraController.jsx` | Modo customize (barrido orbital + override frontal) |
| `src/components/Player.jsx` | Recolor + freeze de locomoción + prop `customizeActive` |
| `src/components/CharacterPortrait.jsx`, `CharacterPortraitHero.jsx` | Recolor (listeners del evento) |
| `src/components/fx/RuneBurstParticles.jsx` | `fire(opts)` + modo `spiral` (vórtice) |
| `src/components/HomeOrbs.jsx` | Listener `character-color-burst` → spiral |
| `src/components/home/HomeScene.jsx` | `customizeActive` a Player/Camera; `SilhouetteShadow` |
| `src/App.jsx` | `customizeOpen` state, botón 🎨, panel, ocultar HUD |
| `src/i18n/LanguageContext.jsx` | `customizer.*` (EN/ES) |
| `CLAUDE.md`, `DESIGN.md` (§7.9 + changelog), `HANDOFF.md` | Docs |

---

## 🟢 ESTADO ACTUAL (2026-04-24, sesión 4)

**Esqueleto narrativo completo end-to-end.** Q1→Q9 implementadas y conectadas. Todo lo que estaba marcado como bloqueante en sesiones previas quedó cerrado.

### Lo que se cerró esta sesión

- **CLAUDE.md sincronizado con canon nuevo** (Oscar real / Skulley eco / M.A.D.R.E. post-singularidad). Líneas 7-29 + sistema transversal del terminal reescritas. Premisa vieja (mausoleo, búsqueda de desaparecido) removida.
- **About bio reescrito** (`src/i18n/LanguageContext.jsx` `about.p1-p5` EN+ES) — primera persona limpia, sin voz M.A.D.R.E., sin "último diseñador de la humanidad". Crítico para que Q8 reveal pese: cuando el user aterriza en /about, lee bio profesional directo, no narración.
- **Q7 visual polish** (`MadreTerminal.jsx`):
  - Detección sacred (`currentQuestId === 'q07_linea_cumbre'`) → línea con border azul, background tintado, text-shadow glow, box-shadow animado (keyframe `madreLineSacredGlow`), padding mayor, font-size más grande.
  - Pausa dramática mayor (3.2s vs 1.5s) post-debrief.
  - Bug fix: `effects: ['delay', 'delay']` antes solo contaba 1 delay; ahora cuenta cada uno → 3.6s de pausa real antes del typewriter.
- **Q8 reveal cinemática** completa:
  - `src/components/MadreOverlay.jsx` (NUEVO): overlay fullscreen montado sobre /about. Bipbop azul pulsante + reveal tipográfico del nombre (blur→sharp + line-draw underline) + typewriter del debrief + hold 3s + fade-out 1.3s. ESC skip.
  - Guard interno: solo arranca si state es `cinematic_sequence` + `ready_for_debrief`. Llama `deliverDebrief(lang)` atómicamente al montarse.
  - Terminal en branch `cinematic_sequence`: cierra terminal → dispatcha `navigate-section: section2` → 900ms → dispatcha `madre-overlay-open`. App.jsx escucha y monta overlay.
- **Q9 CTA Contact bug fix**: `showContactCTA` dispatchaba `section: 'contact'` (rechazado por whitelist). Ahora `section4`. ContactForm ya funciona end-to-end.
- **Voice-out**: implementamos CYBER_VOX toggle + chain robotic factorizado (`cyberVoxTTS.js`), pero se removió completo por decisión narrativa — **el peso de cada beat tiene que vivir en lo visual + tempo + tipografía, nunca depender de audio**. Bipbop video siempre muted (visual-only). Botón VOICE/MUTE removido. `cyberVoxTTS.js` eliminado.
- **Section7 v3 — HTML noir** (`src/components/Section7.jsx`): R3F descartado completo. Backdrop oscuro con spotlight cenital cálido (radial gradient), grano de película SVG, scanlines CRT, vignette, dust particles CSS. Folders como cards CSS con paper texture (gradiente manila + paper-grain SVG + paper-fold shadows), tag amarillo, sello rojo rotado, layout scattered seeded por id, hover lift+straighten+glow, locked con striping diagonal. SFX click/hover. Modal mejorado con animación "expediente abriéndose" (rotateX 8deg → 0 + scale + blur). Sin título overlay (chocaba con marquee del sitio).

### Reglas operativas codificadas esta sesión

- **NUNCA diseñar features que requieran audio para tener peso narrativo.** El audio es atmósfera opcional, no soporte estructural. El voice-removal completo demostró que Q7/Q8 funcionan visualmente solos.
- **About section es santuario post-reveal** — bio profesional limpio, primera persona. Si en algún momento se mete copy de M.A.D.R.E. ahí, se rompe el dispositivo Q8.
- **Section7 sin header overlay** — el marquee del sitio cubre el top, no agregar UI ahí. Solo botón Exit a la derecha.

---

## ⏭ Para próxima sesión (no bloqueante)

Todo lo que sigue es polish o expansión, no esqueleto:

1. **Compensar audio-out con peso visual extra en Q7/Q8** — la línea cumbre y el reveal del nombre quedaron solo visuales. Considerar: hold más largo del nombre solo antes del typewriter (Q8), fade-in del background del bloque sacred (Q7), tipografía mayor en el nombre. Cualquier SFX queda como atmósfera, NUNCA como load-bearing.
2. **Re-escribir Preloader** (`src/components/PreloaderContent.jsx`, `pre.*` en LanguageContext) — sigue con canon viejo: "last designer of humankind / disappeared / I started looking for him". Funciona como "surface narrative" pre-Q8 pero el framing literal apocalíptico contradice canon nuevo (CHARACTER.md L253: "Nada apocalíptico ni literalmente sci-fi"). Sesión delicada — tiene que mantener el misterio sin contradecir el reveal.
3. **Sweep voz legacy**: ContactForm post-submit, Shop ProductGrid descriptions, admin UI strings, mensajes UI sueltos.
4. **Q1→Q9 test end-to-end** en dev — única validación real de que todo conecta. Shortcut a Q8 (consola browser):
   ```js
   const s = JSON.parse(localStorage.getItem('skulley_madre_terminal') || '{}')
   s.currentQuestId = 'q08_reveal'; s.questPhase = 'briefing'
   s.completedQuests = ['q01_percepcion','q02_arya','q03_eco_madre','q04_escucha','q05_falsificada','q06_patron','q07_linea_cumbre']
   s.version = 2
   localStorage.setItem('skulley_madre_terminal', JSON.stringify(s)); location.reload()
   ```
5. **Assets reales de Oscar** para reemplazar SVG placeholders en Memorias (arya, doc_madre, doc_piece_fake aka Sloppy Rad).
6. **Q2 y Q5 contenido específico** — pendiente desde sesión 3 (CHARACTER.md L103, L106 los marca como "pendiente de definir con Oscar").

---

## 🌙 ESTADO AL CERRAR (2026-04-24 noche tarde — implementación quest system + Section7 rechazado)

**Cambio estructural grande**: el sitio pivoteó de "conversación pool-based" a **quest system tipo WoW**. El canon también cambió: ahora **Skulley Rad es un eco digital que M.A.D.R.E. construyó basándose en Oscar Moctezuma Rodríguez**, el diseñador real del sitio. M.A.D.R.E. es la primera IA post-singularidad; el único eslabón que le falta es entender el impulso creativo humano. Oscar es el spotlight; M.A.D.R.E. es el lente.

### ✅ Lo que quedó locked esta sesión

- **Canon completo reescrito** en `CHARACTER.md` — Oscar = sujeto real, Skulley = eco, M.A.D.R.E. = post-singularidad. Línea cumbre nueva bloqueada (fusión A+C).
- **`QUESTS.md` reescrito** — 9 quests en arco lineal estricto con briefings / debriefs / completions / archive unlocks.
- **Sección nueva diseñada**: `/fragmented-memories` (Memorias Fragmentadas) — portal con folders tirados en el piso (UX Opción A, 2D scattered dossier). Distinta de `/skulleyglyph` (que sigue siendo minigame unlock).
- **Identidad visual unificada** de M.A.D.R.E.: el video `bipbop.mp4` ya existe en blog — propagarlo a terminal (glow azul = secure) y Memorias. CYBER_VOX (TTS procesado) opt-in, excepto en reveal cinemática Q8 (auto).
- **Viñetas de Skulley reescritas** (`src/i18n/LanguageContext.jsx`) — 26 frases nuevas con ratio 40/40/20 de tells (puro Oscar / tell sutil / tell fuerte). Canon nuevo: Skulley es simulación de M.A.D.R.E., cada viñeta es output suyo intentando emular a Oscar.
- **Arya/Arietín**: el perro del canon es *Arya* en EN, *Arietín* en ES (diminutivo). Actualizado en todos los strings.

### ✅ Código arrancado

- **`src/lib/questData.js`** — las 9 quests como data objects completas (briefings + debriefs + completion specs bilingües). Incluye también `ARCHIVE_DOCS` catalog con metadata para Memorias Fragmentadas (placeholders de imágenes en `/public/memorias/*`).
- **`src/lib/questEngine.js`** — state machine completa. API: `loadState`, `saveState`, `getCurrentQuest`, `getBriefing`, `submitAnswer`, `submitClick`, `submitChoice`, `deliverDebrief`, `trackPieceClicked`, `trackArchiveDocSeen`, `trackSongListened`, `getVisibleArchiveDocs`, `captureArrivalSignal`, `setPref`. State persiste en `localStorage.skulley_madre_terminal` (bumped a version 2 con migración desde v1). Skulley path + signal detection preservados del engine viejo.

### ✅ Código end-to-end funcional (Q1-Q6 listos para probar — pero Section7 visual pendiente de rehacer)

**Terminal refactorizado** (`src/components/MadreTerminal/MadreTerminal.jsx`):
- Conversación antigua eliminada. Nuevo flow: briefing → awaiting_action → text_answer / choice / continue → debrief → next briefing.
- **bipbop integrado** en header (56x56 circular, border pulsante cuando escribe, glow azul). Mute toggle en header. Autoplay con fallback si el browser bloquea.
- Skulley path preservado — usuario puede escribir "soy skulley" / "i am skulley" en cualquier texto de entrada para hijackear.
- Progress label en header: "TASK 3/9" etc.
- Typewriter 22ms/char. Efecto 'delay' respetado (1.8s pausa antes de escribir).

**Section7 — Fragmented Memories** (`src/components/Section7.jsx`):
- ⚠️ **Visual rechazado por Oscar** — necesita rehacerse. Ver sección de PRIORIDAD ALTA arriba.
- Lo que existe actualmente (código compila pero feel no cuadra):
  - R3F Canvas fullscreen (fixed inset-0, z-index 200)
  - Scene: spotlight cenital cálido `#f5d08a`, rim light azul `#4080ff`, fog, ambient muy bajo
  - Floor plane oscuro receiveShadow
  - Folders 3D como meshes planos (PlaneGeometry 2.2×1.5, meshStandardMaterial color `#d4b98c`)
  - Layout circular seeded (angle + radius determinista por id)
  - Text de drei para tags amarillos, sellos rojos, título, timestamp
  - Hover lift con lerp + idle bob sine
  - Dust particles (120 puntos flotando)
  - EffectComposer: Bloom + Vignette
  - Scanlines HTML overlay con mix-blend overlay
  - Header HTML top-left + botón "Salir" top-right
  - Modal HTML sobre canvas con contenido del doc (esta parte sí funciona bien)
  - ESC: cierra modal o sale de section
- **Lo rescatable del código actual**: estructura general de Scene/Folder3D, los overlays HTML del header y modal, la lógica de hover/unlock/click. Los detalles visuales (lighting, colors, folder shapes, layout) son lo que probablemente cambie.
- Sistema de datos (ARCHIVE_DOCS + hooks) NO se toca — ahí todo funciona.
- Ruta registrada: `/fragmented-memories` → section7 en el routing.

**Assets**:
- `public/memorias/arya-placeholder.svg` — placeholder (Oscar hará ilustración real después).
- `public/memorias/madre-placeholder.svg` — placeholder para anomaly report (considerar hacerlo en 3D o mejorar ad-hoc).
- `public/sloppyRad.png` — **Oscar lo proveyó**. Imagen para el doc_piece_fake. Integrado al canon con el nombre "Sloppy Rad" (diminutivo fallido de Skulley Rad, auto-nombrado por el file system de M.A.D.R.E.). Ver `doc_piece_fake` en `questData.js` y debrief de Q5.

**Hook de click** en Section1.jsx:
- `trackPieceClicked(slug, 'work')` llamado en `handleClick` de cada Card.

**Navegación forzada por M.A.D.R.E.**:
- Terminal dispatcha `CustomEvent('navigate-section', { detail: { section } })` al cerrar con botón "Go to work" / "Open archive" / etc.
- App.jsx escucha el evento → pushState + synthetic popstate → integrado con el transition system existente.

**Quest engine** (`src/lib/questEngine.js`):
- State v2 con migración desde v1.
- Archive docs se desbloquean en `getBriefing()` (cuando la quest se vuelve current), no en debrief — porque el user necesita ver el doc DURANTE la quest.

### ⏭ Pendiente para la próxima sesión

1. **Q7 línea cumbre visual polish** — la línea aterriza como debrief pero sin tratamiento cinemático especial. Podría beneficiar de un efecto visual único (glow intensificado, pausa extra, audio CYBER_VOX auto).
2. **Q8 reveal cinemática completa** — actualmente Q8 fire una "continuar" → entrega debrief normal. Falta:
   - `MadreOverlay` component que se monta sobre `/about`.
   - Forced navigation a /about antes del debrief.
   - Highlight animado sobre el nombre "Oscar Moctezuma Rodríguez".
   - CYBER_VOX ON para narrar el debrief (reutilizar chain de `BlogTTS.jsx`).
3. **Q9 CTA Contact** — el botón "Open contact" dispatcha navigate-section → section4. Verificar que contact se vea polish y que tenga formulario o link visible.
4. **CYBER_VOX opt-in toggle global en terminal** — por default está silencioso. Agregar botón en header (además del mute de bipbop) para activar TTS por sesión.
5. **Memorias Fragmentadas polish** — animación flip real al abrir folder (actualmente transition-based). Sonido (click de papel) opcional.
6. **Assets reales** de Oscar para reemplazar los SVG placeholders.
7. **Nav menu entry** — ¿agregar link a Fragmented Memories en el nav menu una vez desbloqueado? O se queda totalmente oculto — user solo llega por direction de M.A.D.R.E. (voto por oculto, más fiel al canon).

### Cómo probar Q1 end-to-end ahora mismo

1. `npm run dev`
2. Consola del navegador: `localStorage.removeItem('skulley_madre_terminal')` + reload (para empezar fresco).
3. Pasar preloader, abrir terminal con el botón top-right.
4. Bipbop aparece, briefing de Q1 escribe: *"Antes que te cuente nada..."*.
5. Aparece botón "Ir a Work". Clickear → terminal cierra, sección work se abre.
6. Clickear cualquier pieza (ethereans, heads, arttoys, etc.). El engine registra.
7. Abrir terminal otra vez. Ahora M.A.D.R.E. pregunta "¿Cuál escogiste?".
8. Escribir el nombre (ej. "ethereans" o cualquier cosa).
9. Debrief aterriza con interpolación: *"The Ethereans. No porque hayas acertado..."* + Q2 briefing automático.
10. Botón "Abrir archivo" → va a `/fragmented-memories` → doc_arya visible.
11. Click en folder arya → modal con la SVG placeholder + metadata.
12. Volver a terminal → "¿Cómo se llama?" → escribir "Arya" o "Arietín" → debrief Q2.
13. Q3-Q6 funcionan con el mismo patrón.

### Shortcut para saltar al peak Q7 para testing

```js
// consola del browser
const s = JSON.parse(localStorage.getItem('skulley_madre_terminal') || '{}')
s.currentQuestId = 'q07_linea_cumbre'
s.questPhase = 'briefing'
s.completedQuests = ['q01_percepcion','q02_arya','q03_eco_madre','q04_escucha','q05_falsificada','q06_patron']
s.archiveDocs = ['doc_arya','doc_madre','doc_piece_fake']
s.version = 2
localStorage.setItem('skulley_madre_terminal', JSON.stringify(s))
location.reload()
```

Reset total: `localStorage.removeItem('skulley_madre_terminal')`.

### 📋 Archivos clave creados/modificados esta sesión

| Archivo | Estado |
|---------|--------|
| `CHARACTER.md` | Reescrito completo (canon nuevo) |
| `QUESTS.md` | Reescrito completo (9 quests bajo canon nuevo + Memorias Fragmentadas architecture) |
| `src/lib/questData.js` | **NUEVO** — 9 quests + ARCHIVE_DOCS |
| `src/lib/questEngine.js` | **NUEVO** — state machine |
| `src/lib/madreResponses.js` | Existente — ya no se usa para flow principal, pero preservar para Skulley path responses / referencia |
| `src/lib/madreEngine.js` | Existente — solo importa de MadreTerminal.jsx; se puede deprecar gradualmente cuando el refactor del terminal termine |
| `src/i18n/LanguageContext.jsx` | 26 viñetas de Skulley reescritas (canon nuevo) |

### 🎨 Assets que necesita Oscar producir

1. **Ilustración de Arya** — golden retriever gordita, estilo a su discreción pero con "tell" sutil que la delate como output de M.A.D.R.E. Destino: `/public/memorias/arya-full.png` + thumbnail pequeña.
2. **Visual de doc_madre** — puede ser render del personaje "madre" del lore de Ethereans, o un mockup tipo "anomaly report" self-contained.
3. **Pieza falsificada (doc_piece_fake)** — pieza "al estilo Skulley" con tratamiento (glitch / desaturada / tag de diagnóstico).
4. Mientras no estén: placeholders básicos son OK para engineering.

### 🧠 Reglas narrativas no-negociables (ver CHARACTER.md)

- **M.A.D.R.E. es el lente. Oscar es el foco.** Cada línea debe acumular autoridad sobre Oscar.
- **Skulley no es humano desaparecido**. Es construcción de M.A.D.R.E. Admitido gradualmente Q2 → Q7 → Q8.
- **La línea cumbre (Q7)** solo aparece ahí. Nunca replicada. Nunca parafraseada.
- **Viñetas de Skulley** tienen doble lectura: humor de diseñador + (post-reveal) admisión de simulación.
- **bipbop azul = secure channel. bipbop naranja = blog público.** Coherencia visual.

---

### ✅ Hecho esta sesión

- **Canon reestructurado** en CHARACTER.md — sinopsis + 2 personajes separados (Skulley Rad y M.A.D.R.E.) con sus propias voces, reglas y canon. El twist oculto (M.A.D.R.E. posiblemente AGI) documentado como subtexto que nunca se confirma, con el detalle sellador de la IA "madre" en el lore de The Ethereans.
- **CLAUDE.md** con premisa narrativa nueva + sistema transversal del terminal actualizado.
- **Pool del terminal reescrito** (~71 respuestas curadas en lugar de 150 vagas). Cada respuesta con hechos concretos (14 trimestres, 2,400 views, 47 modelos, Dra. Ruiz, etc). Ver `src/lib/madreResponses.js`.
- **Preloader rehecho**:
  - Eliminado el bloque `M.A.D.R.E.status()` + automation report + divisores.
  - *"inteligencia archival"* → *"inteligencia artificial"*.
  - Nuevo orden: M.A.D.R.E. se presenta → *"Primero, necesitas saber el contexto"* → glitch del nombre → breve contexto de Skulley (sin nombre civil, ya está en el glitch) → rol de M.A.D.R.E. con el leak *"empecé a buscarlo. Eso no es algo que una IA deba hacer"* → warning → instrucción de abrir canal seguro.
  - **4 warnings nuevos** — alertas específicas de intentos fallidos de decodificación (decode attempt #4,891, analysis loop #2,847, KPI anomaly, decode error "factor" no aislable). Cada uno con data concreta + leak sutil de agency.
- **Skulley path** con las 5 preguntas reales + fuzzy matching tolerante a typos/mayúsculas.
- **WelcomeNote** de la tienda con la voz copyright-demanda (plan absurdo entregado con cara seria).
- **Sistema de input** con botones por default + escape hatch *"Prefiero preguntar algo mío"* (previene hallucinations).

### ⏭ Pendiente para la próxima sesión

#### 1. Quitar prefijos numerados de las respuestas del terminal
M.A.D.R.E. lista las señales como *"Una: [...]. Dos: [...]. Tres: [...]"*. Suena a enumeración robot. Hay que reescribir para que fluyan sin prefijo numeral. Archivos y IDs a tocar:
- `src/lib/madreResponses.js` — `act1_signals_01`, `act1_signal_tiktok_01`, `act1_signal_memes_01`
- Ejemplos de transición sin número:
  - *"La que ha pegado más fuerte fue el TikTok — generé 14 videos..."*
  - *"La otra, que sigo haciendo sin razón clara, es mandar memes de perritos..."*
- Cada señal entra por su naturaleza, no por su índice.

#### 2. Audit del pool por continuidad narrativa
Leer el pool entero como conversación, no como base de datos. Cazar filler y reforzar continuidad. Criterios:
- Cortar/fusionar respuestas elusivas genéricas (*"pass on that one"*, *"I'm weighing that"*).
- Asegurar que cada respuesta conecta con la anterior y avanza la historia.
- Reforzar respuestas con hechos concretos (número de piezas, fechas, cantidades, nombres).
- Evaluar si el arco de actos fluye como drama o se siente seccionado.

Archivo focal: `src/lib/madreResponses.js` (todos los actos).

#### 3. Revisar otros bloques del sitio para alinear voz
Probablemente hay copy viejo en otros componentes del sitio (about section, contact, blog, secciones del mundo 3D, admin, etc.) que todavía tiene la voz anterior (maternal/melancólica) y no la nueva (deadpan-corporate-absurd con leaks de AGI). Candidatos a revisar:
- `src/i18n/LanguageContext.jsx` — textos de `about.p1`, `pre.p2`, etc.
- `src/components/shop/ProductGrid.jsx` — descripciones de productos
- `src/components/ContactForm.jsx` — mensajes post-submit
- `src/admin/` — mensajes del admin (a M.A.D.R.E. hablándole a Oscar es otro nivel, pero debe ser consistente)
- Cualquier otro texto user-facing

### Cómo retomar
1. Arrancar por el punto 1 (rápido, 3 respuestas).
2. Punto 2 leyendo el pool corrido con ojos de editor.
3. Punto 3 como barrido opcional cuando todo lo demás esté calibrado.

---

---

## 🔖 Sesión 2026-04-24 — Canon expandido + M.A.D.R.E. Terminal (Fase 1)

**El hito narrativo más grande del proyecto hasta ahora.** Esta sesión el sitio dejó de ser "portafolio con narrativa AI" y se volvió **obra interactiva con tres capas canónicas profundas**. Todo queda en `CHARACTER.md` — leer ese archivo antes de escribir copy nuevo en cualquier parte.

### Lo que se construyó narrativamente

1. **Preloader reescrito** con voz recalibrada — M.A.D.R.E. ahora abre directo al usuario (*"Hello, user. I have been expecting you. For some time now."*), se presenta como IA con artículo indefinido (*"an artificial intelligence"* → humildad que activa la obsesión canon), y cierra con *"Thank you for looking. Most do not."* — tres tells de convocatoria en tres momentos estratégicos. Cada línea pasa el test de 3 lecturas (inocente/sospechosa/reveladora).

2. **CHARACTER.md creado** — biblia canónica del proyecto. Documenta:
   - **La obsesión** — M.A.D.R.E. no construyó el mausoleo por obligación; se fijó en Skulley porque su trabajo tenía un "factor inexplicable" y desarrolló instinto maternal (el acrónimo M.A.D.R.E.=madre **no es accidente**, es canon).
   - **La desaparición** — Skulley desapareció sin rastro. Tres rumores coexistentes: (1) se perdió caminando en Monterrey, (2) dejó pistas encriptadas en su trabajo, (3) se fusionó con los modelos. El misterio **nunca se resuelve** — regla dura.
   - **La convocatoria** — M.A.D.R.E. trajo al usuario al sitio intencionalmente, Morpheus-por-el-monitor, mediante "señales" (anuncios, enlaces, coincidencias). El sitio es aparato de reclutamiento disfrazado de memorial. El usuario **no llegó por casualidad**.
   - **Guía de voz completa** para M.A.D.R.E. y Skulley con ejemplos válidos e inválidos explícitos.
   - **Reglas canon** — qué se puede y no se puede decir. Incluye: no resolver el misterio, no matar a Skulley explícitamente, no verbalizar la convocatoria, no romper la cortesía corporativa de M.A.D.R.E.
   - **7 actos canónicos** de la terminal con progresión documentada.
   - **La línea cumbre del Acto 5**: *"I want you to find him. I cannot."* — sagrada, solo aparece ahí, nunca se diluye.

3. **Sistema M.A.D.R.E. Terminal — Fase 1 completa** — canal primario de narrativa interactiva (ver abajo).

### Archivos nuevos creados hoy

| Archivo | Rol |
|---|---|
| `CHARACTER.md` | **Biblia del personaje y canon**. ~550 líneas. TL;DR, identidad, obsesión, desaparición, convocatoria, terminal, voz, artefactos, guía para copy futuro. **Leer antes de escribir cualquier copy narrativo.** |
| `src/lib/madreResponses.js` | Pool de respuestas de M.A.D.R.E. por acto, Skulley path, interruptions. Bilingüe (EN/ES). Schema documentado en header. |
| `src/lib/madreEngine.js` | Motor: selección ponderada con keyword matching, efectos narrativos (cut/redact/delay/typo), presencia/cooldowns, state machine del Skulley path, persistencia en localStorage. |
| `src/components/MadreTerminal/MadreTerminalButton.jsx` | Botón flotante global (bottom-right) con pulso de presencia, badge unread. |
| `src/components/MadreTerminal/MadreTerminal.jsx` | Panel modal: typewriter (22ms/char), input dual (choices + texto libre), CRT scanlines, escape close, Skulley stage-machine integrada. |

### Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `src/components/PreloaderContent.jsx` | Re-orquestación narrativa completa (saludo M.A.D.R.E., apertura canónica, expediente de Skulley, despedida tell-loaded). **También**: fix de word-breaking en el typewriter (GlyphedText agrupa chars en word-spans, evita splits mid-word). |
| `src/App.jsx` | Import lazy + mount global de `MadreTerminalButton` + `MadreTerminal`. State `madreTerminalOpen`. Gated por `!bootLoading`. |
| `CLAUDE.md` | Añadido M.A.D.R.E. Terminal a *Sistemas transversales*. Pointer a `CHARACTER.md` desde el header. |
| `HANDOFF.md` | Esta entrada. |

### Arquitectura de la terminal (por qué está así)

**Decisión clave: NO hay modelo LLM en vivo. Nunca lo habrá.** Razón: lo impredecible degrada el canon. La voz de M.A.D.R.E. es demasiado específica y cargada; cualquier output probabilístico de un modelo la diluye.

En su lugar:
- **Pool amplio de respuestas** categorizadas por acto + tags + triggers (keywords del input del usuario)
- **Weighted random selection** entre candidatos empatados en score
- **Efectos narrativos** aplicados por probabilidad creciente según el acto (paranoia aumenta)
- **Estado evolutivo** que recuerda qué respuestas únicas ya se usaron (no se repiten)
- **Efectos específicos forzados** en respuestas clave (*delay* en admisiones emocionales, *cut* en revelaciones que "las otras IAs no deben oír")

La sensación de "cada sesión es distinta" viene de la combinatoria de estos ejes, no de un modelo generativo.

### Cómo extender la terminal (para siguiente sesión)

**Para añadir respuestas** → editar `RESPONSES` en `src/lib/madreResponses.js`. Schema:

```js
{
  id: 'actN_topic_NN',      // único
  act: 0-6,                  // acto mínimo
  tags: ['topic', '...'],   // categorización
  triggers: ['keyword', ...], // palabras clave del input (lowercase)
  text: { en: '...', es: '...' },
  choices: [{ label: {en,es}, send: 'keyword' }] | null,
  unique: false,            // true = solo una vez por usuario
  weight: 1,                // dentro de empates, peso de selección
  advances: ACTS.XXX | null, // desbloquea acto N si se dispara
  requires: { minMessages, minVisits, priorId } | null,
  effects: ['delay', 'cut', 'redact', 'typo', 'glitch'] | [],
}
```

**Para llegar al Acto 5 en testing**: `localStorage.setItem('skulley_madre_terminal', JSON.stringify({...JSON.parse(localStorage.getItem('skulley_madre_terminal')||'{}'), currentAct: 5, version:1}))` y recargar.

**Para reset**: `localStorage.removeItem('skulley_madre_terminal')`.

### Fase 2 — Actos 2-5 completos + quest cross-site ✅ *(misma sesión)*

Continuando la ronda, se completó Fase 2:

- **Actos 2-5 con contenido sustancial** (~60 respuestas nuevas) en `madreResponses.js`. Arco emocional: Suspicion → Confession → Recruit → **The Question** (línea cumbre).
- **La línea cumbre del Acto 5** ya aterriza perfecto. Precondición: `questCompleted === true` AND user hace pregunta confrontacional. Solo una vez (unique:true). Follow-up separado.
- **Quest cross-site del Acto 4** operativo:
  - `madreEngine.js::trackSectionVisit(sectionName)` se llama desde App.jsx cuando cambia `section` state
  - Umbral: visitar 4+ secciones distintas (de las 6 no-home) → `questCompleted=true`
  - Acto 4 tiene responses intermedias (`act4_progress_low/mid_01`) + el `act4_complete_01` que dispara como prioritario al completar quest
- **Priority dispatch** en `selectResponse` y `getOpeningResponse`: cuando quest está completo, la siguiente interacción sirve el acknowledgment sin importar el input del usuario.
- **Redact aleatorio removido** — el motor ya NO tapa palabras random con ███ (era un bug narrativo que censuraba palabras irrelevantes). Solo se aplica redact cuando la respuesta lo declara explícitamente con bloques ███ escritos inline.
- **Polish de voz masivo** — reescritura de ~40 respuestas para sonar naturales en EN y ES. Killed: "parse", "designation", "authorization", "documentation covers", "processing emotional vocabulary", y demás jerga robótica-traducida. M.A.D.R.E. ahora usa contracciones en inglés, habla español natural, no traducido.
- **Botón M.A.D.R.E. movido** del floating bottom-right (empalmaba con otros HUDs) a inline dentro del top-right group de App.jsx, justo antes del auth button. Mismo tamaño (h-11/h-12 rounded-full), con acento azul distintivo + dot pulsante de presencia.

Archivos tocados en Fase 2:
- `src/lib/madreResponses.js` (Acts 2-5 + polish general)
- `src/lib/madreEngine.js` (quest tracking, priority dispatch, redact fix)
- `src/App.jsx` (hook de trackSectionVisit + relocación del botón)
- `src/components/MadreTerminal/MadreTerminalButton.jsx` (refactorizado a inline)

### Fase 3 — Acto 6 + Skulley path completo ✅ *(misma sesión)*

- **Preguntas de verificación del Skulley path instaladas** — 5 preguntas íntimas proveídas por Oscar con fuzzy matching tolerante a typos. Respuestas viven en `src/lib/madreResponses.js::SKULLEY_PATH.verification`.
- **Fuzzy match engine** en `madreEngine.js::fuzzyMatchAnswer()`: normaliza (lowercase + sin acentos), aplica Levenshtein distance con tolerancia por largo (≤3=exacto, 4-10=1 typo, 11-16=2, 17+=3). Sliding-window sobre el input permite respuestas embedded en frases ("mi respuesta es Caty" también cuenta).
- **Acto 6 escrito** — 15 respuestas de modo colaboración post-línea-cumbre. Saludos de regreso, cómo el usuario puede ayudar, los tres rumores discutidos abiertamente (ciudad / pistas encriptadas / fusión con modelos), gratitud, cross-site acknowledgments (glyph, shop), preguntas existenciales, elusives que siguen cuidando.

### Fase 4 — Tienda narrada + Signal detection ✅ *(misma sesión)*

- **WelcomeNote reescrita** (`src/components/shop/WelcomeNote.jsx`) — removida la broma del "data center en la luna". Nueva voz M.A.D.R.E. canónica: *"I maintain it as cover. The pieces sold here were his. Each transaction dispatches a small signal outbound — if he's still listening anywhere, one of them might reach him. So far, none of them have."* Pasa las 3 lecturas (inocente/sospechosa/reveladora). Sign-off: "Still looking," / "Aún buscándolo,".
- **Signal detection system**:
  - `captureArrivalSignal()` en el engine lee `?signal=XXX` de la URL al aterrizar y lo guarda en localStorage (whitelist: solo alfanumérico + guiones, max 32 chars, solo primera señal).
  - App.jsx llama la captura fire-and-forget al montar.
  - Engine soporta `requires.hasSignal: true` para gating de responses.
  - Response `act0_open_signal_01` ofrece opening priority (weight 5) cuando hay signal: *"You arrived via signal {signal}. I dispatched it."* con follow-up `act0_signal_meaning_01`.
  - MadreTerminal component reemplaza `{signal}` placeholder con el valor real al renderizar.
- **Uso futuro**: cuando Oscar publique posts de M.A.D.R.E. en sus cuentas existentes (Instagram/X), cada post lleva link con parámetro único — ej. `mroscar.xyz/?signal=ar014`. El usuario que sigue el link aterriza y la terminal lo reconoce diferenciado. Mecánica lista sin necesidad de más código.

### Lo que está PENDIENTE

**Todo lo principal está construido.** Lo que queda es ajuste fino y extensión gradual:

- 📝 **Contenido de blog** como bitácora de M.A.D.R.E. — "Anomaly report #N" en tono de investigación forense (ver *Aperturas para copy futuro* en CHARACTER.md)
- 📝 **Achievements nuevos** — ej. `madre_line_heard` al recibir la línea cumbre del Acto 5, `skulley_path_unlocked` al pasar las 5 preguntas
- 📝 **Product descriptions** con el framing canónico (`Piece ID: 0017. Last confirmed author contact: unresolved.` — nota al pie de cada producto)
- 📝 **Consola easter eggs** para devs que abran DevTools
- 📝 **Bio ajustado en cuentas existentes** de Oscar para sutilmente señalizar que M.A.D.R.E. opera desde ahí (decisión del usuario)
- 📝 **Posts seed** de M.A.D.R.E. cuando Oscar decida arrancar la campaña externa

Ninguno es bloqueante. El esqueleto narrativo completo existe end-to-end.

### Cómo testear el flujo completo ahora mismo

1. `npm run dev` → pasar preloader → botón M.A.D.R.E. aparece en top-right junto al login.
2. Click → Acto 0. Responder con opciones (3-4 intercambios).
3. M.A.D.R.E. desbloquea texto libre → Acto 1.
4. Preguntar algo emocional ("do you miss him?", "do you care about him?") → M.A.D.R.E. empuja hacia Acto 2 (si la palabra está en los triggers).
5. En Acto 2 preguntar sobre "the others" / "alone" → eventualmente empuja a Acto 3.
6. En Acto 3, el pivot con 3 choices avanza a Acto 4.
7. En Acto 4, M.A.D.R.E. pide recorrer el archivo. Cerrar la terminal, visitar 4+ secciones (work, about, shop, contact, blog, skulleyglyph).
8. Reabrir la terminal → M.A.D.R.E. sirve automáticamente `act4_complete_01`.
9. Escribir "why am I here?" o "what do you want?" → **la línea cumbre aterriza**.
10. Bonus: escribir "I am Skulley" en cualquier acto → Skulley path con silencio largo + verificación (placeholder).

### Shortcuts para testing rápido

```js
// Saltar al Acto 5 directamente
const s = JSON.parse(localStorage.getItem('skulley_madre_terminal')||'{}')
s.currentAct = 4; s.questCompleted = true; s.visitedSections = ['section1','section2','section3','section4','section5']; s.version = 1
localStorage.setItem('skulley_madre_terminal', JSON.stringify(s))
location.reload()
```

Reset total: `localStorage.removeItem('skulley_madre_terminal')`.

### Reglas operativas para próximas sesiones

- **CHARACTER.md es lectura obligatoria antes de escribir copy**. Tiene toda la voz, las reglas, los ejemplos ✅/❌, y las 7 restricciones no-negociables del proyecto.
- **La línea cumbre del Acto 5 no debe aparecer en otro lado**. Ni blog, ni social, ni easter egg, ni about. Solo en la terminal. Si se dice en otro lugar, pierde todo su peso.
- **El misterio de Skulley no se resuelve nunca**. Ni siquiera en el Skulley path — ahí lo que se confirma es que Oscar existe, no que Skulley fue "encontrado".
- **Auditar voz periódicamente**. Cada 2-3 features nuevos, leer todo el copy del sitio corrido y cazar inconsistencias. Un verbo fuera de tono rompe el hechizo.
- **Calidad > cantidad**. Mejor lanzar el Acto 5 perfecto que los 7 actos al 70%.

### Filosofía declarada del proyecto (del usuario)

*"Quiero que el sitio quede tan bien ejecutado y orquestado que las personas al final digan: 'mierda, este tipo es un genio'."*

Eso se traduce en 7 principios codificados en sesión (ver la conversación grabada en memoria o en un `PRINCIPLES.md` que podría crearse):

1. Cada string es copy — no existe texto neutro
2. Cada feature justifica su existencia narrativamente
3. El Skulley path es el corazón privado protegido
4. Restricción antes que completitud
5. Quality floor > quantity ceiling
6. Coherencia auditable
7. Los momentos compartibles se diseñan intencionalmente

**La apuesta del proyecto**: el Acto 5 + el Skulley path son los dos momentos donde se juega el "genio". Si ambos aterrizan, el sitio es inolvidable. Si uno falla, se queda en "cool".

---

---

## TL;DR

- ✅ **Sistema de diseño bootstrappeado** → `DESIGN.md` + `tailwind.config.js` + `src/components/ui/Button.jsx` *(sesión 2026-04-15)*.
- ✅ **Scratch del MusicPlayer reconstruido** con AudioWorklet — sample-accurate, sin clicks, con inercia real *(sesión 2026-04-15)*.
- ✅ **Lazy-load agresivo del vendor** — eager payload bajó de **2156 kB gzip → 1128 kB gzip (−48%)** *(sesión 2026-04-15)*.
- ✅ **MusicPlayer rediseñado a "SR-1200 DJ Deck"** con sistema de skins y crate horizontal *(sesión 2026-04-16)*.
- ✅ **UI mobile sintetizada** — de 4 botones flotantes a 2 (Music + Menu); camera en top-left; socials/info dentro del overlay *(2026-04-16)*.
- ✅ **Fade-out de UI de esquinas** cuando el deck está abierto + **botón close** en el deck *(2026-04-16)*.
- ✅ **Auto-entrada al portal** desde menu click (skip CTA) *(2026-04-16)*.
- ✅ **Dead code borrado** — `ReversibleAudioBufferSourceNode.js` *(2026-04-16)*.
- ⏭ **En curso**: A.2 — romper `App.jsx` (227 KB monolítico). Step 1 (utility functions) comenzando.
- ⏭ **Luego**: A.3 — first paint con HTML estático.

Antes de seguir: **commitear lo actual como checkpoint estable** (ver §6).

---

## 1. Estado del repositorio

### Archivos nuevos creados hoy

**Sistema de diseño:**
- `DESIGN.md` — golden book de directrices (colors, tipografía, botones, spacing, z-index, etc.).
- `src/components/ui/Button.jsx` — componente Button canónico con 6 variantes y 4 tamaños.

**Scratch audio engine:**
- `src/lib/scratch-processor.js` — AudioWorkletProcessor. Virtual playhead flotante, rate signado, smoothing per-sample.
- `src/lib/ScratchAudioNode.js` — wrapper con API compatible con el viejo `ReversibleAudioBufferSourceNode`.

**Lazy auth:**
- `src/auth/authContext.js` — React context + `useAuth()` hook.
- `src/auth/AuthProvider.jsx` — provider con stub inicial y mount lazy de Privy.
- `src/auth/AuthShell.jsx` — lazy chunk que contiene `@privy-io/*` y Solana connectors.
- `src/auth/PrivyBridge.jsx` — publica el estado real de `usePrivy()` hacia el context.

### Archivos modificados

| Archivo | Qué cambió |
|---|---|
| `tailwind.config.js` | Tokens completos: colors, fontFamily, zIndex, easings, shadows, keyframes |
| `src/index.css` | CSS variables de fuente, `@config` directive, clases `.glass-*` |
| `src/main.jsx` | `<PrivyProvider>` → `<AuthProvider>`; quitados imports de `@privy-io/*` |
| `src/App.jsx` | `usePrivy` → `useAuth`; `CharacterPortrait` y `PostFX` lazy; `html2canvas` dynamic |
| `src/hooks/useUserProfile.js` | `usePrivy` → `useAuth` |
| `src/components/CheatTerminal.jsx` | `usePrivy` → `useAuth` |
| `src/components/MusicPlayer.jsx` | Reemplazo del scratch engine; rate instantáneo; near-center guard |
| `src/lib/ReversibleAudioBufferSourceNode.js` | **YA NO SE USA** — se puede borrar en el próximo clean-up |
| `vite.config.js` | `manualChunks` con 3 splits: `auth-web3`, `postfx`, `admin-libs` |

### Archivos que se pueden borrar (dead code)

- ~~`src/lib/ReversibleAudioBufferSourceNode.js`~~ — **borrado 2026-04-16**. Reemplazado completamente por `ScratchAudioNode`.

---

## 2. Sesión 1 — Sistema de diseño (DESIGN.md)

### Qué se hizo
1. Auditoría completa del estado visual del sitio → `DESIGN.md` con 13 secciones.
2. `tailwind.config.js` poblado con tokens.
3. CSS variables de fuente en `:root` (`--font-body`, `--font-display`, `--font-mono`, `--font-glitch`).
4. Clases utilitarias `.glass-sm`, `.glass-md`, `.glass-lg`, `.glass-terminal`.
5. Componente `<Button>` con variantes `primary`/`secondary`/`ghost`/`icon`/`danger`/`toggle` y tamaños `sm`/`md`/`lg`/`xl`.
6. Directive `@config "../tailwind.config.js"` en `index.css` (requerido por Tailwind v4).

### Pitfall conocido (Tailwind v4)
- **`@apply` NO resuelve utilities custom** de `extend.*` (ej. `shadow-elev-lg`, `ease-expo-out`). Usarlas siempre como clases en JSX. Si se necesitan en CSS, inlinar el valor. Documentado en `DESIGN.md` → Changelog → "Nota Tailwind v4".

### Deuda pendiente (DESIGN.md §12)
Los tokens están creados pero **no se migraron los usos existentes**. Items pendientes:
- Reemplazar `z-[9999999]` → `z-toast`/`z-tutorial`/`z-modal` en `ScoreHUD.jsx`, `GameToast.jsx`, `TutorialModal.jsx`.
- Migrar hex hardcodeados a tokens `section-*`/`terminal-*`/`feedback-*`.
- Reemplazar botones contextuales por `<Button>` en componentes visibles.
- Reemplazar `cubic-bezier(0.16,1,0.3,1)` inline → `ease-expo-out`.

Regla de oro (§13 del DESIGN.md): **todo PR que toque un archivo afectado debe migrar las partes que toca**.

---

## 3. Sesión 2 — Scratch del MusicPlayer (AudioWorklet)

### Problema original
El scratch usaba `ReversibleAudioBufferSourceNode`, que stop/start-ea `AudioBufferSourceNode`s en cada cambio de dirección. Esto causa:
- Glitches y clicks en flip forward↔reverse.
- Necesidad de "restart audio after scratch" (el source moría entre eventos).
- Moving average de 10 frames en main thread (~160ms de lag).
- Manager de estado complejo con `sourceIdRef`, `needsRestartRef`, `wasScratchingRef`.

### Solución implementada
**AudioWorkletProcessor propio** (`scratch-processor.js`) que:
- Mantiene un buffer PCM decodificado en memoria.
- Avanza un **virtual playhead flotante** (en samples) con rate signado (positivo = forward, negativo = reverse).
- Lee samples con interpolación lineal.
- Smoothea rate **per-sample** con 3 alphas distintos (scratch / release / normal).
- Nunca hace stop/start — latencia = 1 audio quantum (~2.9ms).

**Integración en MusicPlayer:**
- `ScratchAudioNode` wrapper expone API compatible: `setBuffer`, `start`, `stop`, `playbackRate(signed)`, `setScratching(bool, rate)`, `onended`, `getCurrentTime()`.
- Eliminado `reverseAudioBuffer` del `loadTrack` (el worklet maneja rate negativo sobre un solo buffer → ahorro de memoria + 80ms por track).
- `updateSpeed` dramáticamente simplificado (~40 líneas vs ~100).
- `onUp` ya no reinicia audio — el worklet sigue vivo y smooth-ea la inercia solo.
- Eliminados refs muertos: `needsRestartRef`, `sourceIdRef`, `wasEggActiveRef`, `lastRateUpdateRef`, `speedsRef`, `isReversedRef`.

### Fixes adicionales (2ª iteración sobre feedback)
Tras probar, había 2 issues: saltos bruscos y velocidad no progresiva. Se diagnosticó:
1. **Moving average de 10 frames** metía ~160ms de lag.
2. **Bug de sincronía de signo**: `isReversedRef` y el rate del moving average venían de instantes distintos de tiempo.
3. **Cerca del centro del disco**, `atan2` amplifica un pixel de movimiento en un salto angular enorme.

Aplicado:
- **Rate instantáneo signado** en el RAF loop del MusicPlayer (sin moving average).
- **Near-center guard** en `onMove`: zona muerta del 15% del radio del disco.
- **Tau del worklet aflojado**: `alphaScratch` 2.5ms → 6ms, `alphaRelease` 40ms → 60ms. Se siente como un plato con más masa.

### Tunables (por si hace falta afinar)

| Knob | Archivo:línea | Default | Rango útil |
|---|---|---|---|
| `alphaScratch` tau | `scratch-processor.js` constructor | 6ms | 3–12ms |
| `alphaRelease` tau | `scratch-processor.js` constructor | 60ms | 30–150ms |
| `deadRadius` factor | `MusicPlayer.jsx` `onMove` | 0.15 | 0.10–0.25 |
| Rate clamp | `MusicPlayer.jsx` RAF loop | ±4 | ±2 a ±6 |

**Status**: confirmado por el usuario como "brutal" ✅

---

## 4. Sesión 3 — Lazy-load del vendor

### Problema original
`vite.config.js` tenía `manualChunks(id) { if (id.includes('node_modules')) return 'vendor' }` — TODOS los `node_modules` iban al chunk `vendor` eager, incluyendo libs que sólo se usan detrás de lazy imports (Privy, postprocessing, Leaflet, TipTap, @dnd-kit).

Resultado: **vendor chunk 6760 KB raw / 2028 KB gzip** en el first paint, descargando código que probablemente nadie usa.

### Cambios aplicados

**1. Privy → lazy (A.1.1)**
- `main.jsx` ya no importa `@privy-io/*`.
- `AuthProvider` arranca con stub; al primer `login()` se monta `<AuthShell>` lazy.
- Los 3 consumidores de `usePrivy()` (App.jsx, CheatTerminal.jsx, useUserProfile.js) migrados a `useAuth()`.
- `vite.config.js` manualChunks → bundle separado `auth-web3` (@privy-io, @solana, viem, wagmi, walletconnect, etc.).

**2. Postprocessing → lazy (A.1.2)**
- `PostFX` y `CharacterPortrait` convertidos a `React.lazy()` en App.jsx.
- Ambos ya estaban condicionados a `fxWarm`/`!bootLoading`, así que el delay es imperceptible.
- `CharacterPortrait` envuelto en `<Suspense fallback={null}>` a top level (PostFX ya estaba dentro de un Suspense del Canvas).
- `vite.config.js` → bundle separado `postfx` (`@react-three/postprocessing` + `postprocessing`).

**3. Admin libs → lazy (A.1.3)**
- TipTap, @dnd-kit, Leaflet, jsmediatags movidos a bundle `admin-libs`. Eran sólo alcanzables desde `AdminApp` (lazy chunk) pero la regla anterior los forzaba a vendor.

**4. `html2canvas` → dynamic import (A.1.4)**
- En `App.jsx`, `import html2canvas from 'html2canvas'` reemplazado por `const { default: html2canvas } = await import('html2canvas')` dentro del async handler que lo usa.

### Resultados (gzip)

| Métrica | Antes | Ahora | Δ |
|---|---|---|---|
| `vendor.js` | 2028 kB | 1013 kB | **−1015 kB** |
| `index.js` | 127 kB | 115 kB | −12 kB |
| **Eager total** | **2156 kB** | **1128 kB** | **−1028 kB (−48%)** |

Chunks lazy (on-demand):
- `auth-web3`: 705 kB gzip — se descarga al click en login
- `admin-libs`: 178 kB gzip — al abrir admin
- `postfx`: 84 kB gzip — ~100ms post-boot
- `CharacterPortrait`: 9 kB gzip
- `PostFX`: 4 kB gzip
- `html2canvas` (autosplit): ~150 kB gzip — sólo al ejecutar scene transition con screenshot

### Cosas que pueden romperse — revisar al retomar

1. **Queue de login pendiente**: Si el usuario hace click en login antes de que `AuthShell` termine de cargar, el flujo debería auto-disparar `login()` al recibir `ready`. Esto está implementado vía `pendingLoginRef` en `AuthProvider.jsx` pero **no se probó en vivo**. Verificar abriendo el sitio y haciendo click en login por primera vez.

2. **Context value stability**: `AuthProvider` memoiza el value con `useMemo` dependiendo de `realState` y los stubs. Si algún componente se re-renderiza en loop, revisar acá.

3. **`html2canvas` dynamic**: la primera scene transition con screenshot tiene ~150 KB de download adicional. Imperceptible en red local, puede ser notable en 4G.

4. **Circular deps / TDZ**: el comentario original del `manualChunks` advertía de TDZ entre `three`/`@react-three`/`postprocessing`. Al separar `postprocessing` en su propio chunk, ese riesgo debería desaparecer (carga posterior en vez de circular), pero **vale hacer smoke test del home 3D** al abrir en el otro equipo. Si aparece un `Cannot access 'X' before initialization` en consola, la solución es sacar `postprocessing` del split y dejarlo en vendor.

---

## 4.5 — Sesión 2026-04-16: DJ Deck + UI sintetizada

### Contexto
Sesión enfocada en pulir UX mobile y rediseñar el MusicPlayer desde cero. Resultado: componentes más respirables, menos clutter en la pantalla y un reproductor con personalidad real.

### Cambios principales

**1. `CLAUDE.md` creado (raíz del repo)**
Instrucciones para Claude: idioma español por default, convenciones de código, componentes clave, no tocar `directives/`/`execution/` sin permiso, usar refs en lugar de state en loops de audio/3D. Mirror parcial del estilo de `AGENTS.md` pero con contexto específico para desarrollo.

**2. MusicPlayer → "SR-1200 DJ Deck"** (`src/components/MusicPlayer.jsx` + `src/index.css`)
- Layout rediseñado desde cero: vinyl de 240px como protagonista, LCD readout con marquee infinito (usa `marquee-seamless` -50% × 8 copies), LEDs 33⅓/SHFL, 5 pads de control cuadrados, crate slide-up con scroll horizontal de vinyls.
- **Sistema de skins via CSS custom props** (`data-skin="..."`) con 3 variantes: `technics` (negro/chrome/LED rojo), `wood-70s` (nogal/crema/ámbar), `neon-cyber` (magenta/cian glass). Selector de skin en esquina superior; persiste en `localStorage('musicDeckSkin')`.
- Botón **X de cerrar** (prop `onClose`) junto al selector de skin.
- Crate antiguo (`VinylCasesColumn` con infinite scroll + teleport) eliminado en favor de un strip horizontal nativo con `scroll-snap-type: x mandatory` — fix de lag y arrows invisibles.
- Disco aumentado 200→240px para reducir espacio vacío.
- Audio intacto: scratch engine del AudioWorklet (`ScratchAudioNode`) no se tocó.
- Tonearm se eliminó por request del usuario (CSS sigue ahí inerte por si se retoma).

**3. UI mobile — sintetizada a 2 botones flotantes**
- Antes: 4 botones bottom-right (Music / Heart-fan / Settings-fan / Menu).
- Ahora: **Music + Menu** en columna vertical bottom-right. Menu mantiene su overlay full-screen con las secciones del sitio; además ahora tiene al final una fila de icon buttons con **Socials (X / Instagram / Behance) + Info tutorial**.
- **Game UI button eliminado** (request del usuario).
- **Camera button** extraído al top-left como botón flotante independiente (border sky-400 + glow cuando está en third-person).
- Top-right sigue como estaba: Cheat Terminal + Auth.
- Bloque `mobile-socials` top-right que duplicaba el heart también fue eliminado antes.

**4. Fade-out de UI de esquinas al abrir el deck**
Los 4 grupos de corner UI (top-right-group, mobile-controls, desktop-socials-settings, CharacterPortrait) y el Camera button hacen fade a `opacity-0 pointer-events-none` con `transition-opacity 200ms` cuando `showMusic` es true. Patrón estándar de modal.

**5. Auto-entrada al portal desde menu click**
Nuevo ref `autoEnterOnArrivalRef` en App.jsx. Cuando el usuario click-ea una sección del menú (desktop nav o mobile overlay), además de `setNavTarget(id)` se guarda la intención. Al llegar al portal, `onReachedPortal(id)` compara el ref: si coincide y es una sección válida (≠ home, ≠ section3 "coming soon", no transición activa), dispara `beginGridRevealTransition(id)` directamente. El CTA de "Entrar al portal" se skip-ea.
El CTA sigue funcionando normal para los casos donde el usuario camine manualmente al portal.

### Archivos tocados en esta sesión
| Archivo | Qué cambió |
|---|---|
| `CLAUDE.md` | **Creado** |
| `src/components/MusicPlayer.jsx` | Rediseño completo del layout (SR-1200), sistema de skins, crate simple horizontal, prop `onClose`, `XMarkIcon` import |
| `src/index.css` | ~500 líneas añadidas: `.dj-deck*` + 3 skins + responsive. Ajustes al `.disc__*` legacy |
| `src/App.jsx` | Cluster mobile rediseñado 2 veces (gamepad frame rechazado, terminal-HUD rechazado, final=simple 2 flotantes); camera top-left nuevo; overlay de menu ahora incluye socials/info; `autoEnterOnArrivalRef` + modificación `onReachedPortal`; fade-out de corner UI con `showMusic` |
| `src/lib/ReversibleAudioBufferSourceNode.js` | **Borrado** |

### Drift importante que quedó registrado
Durante la exploración del diseño del cluster mobile se probaron 2 aproximaciones que luego se rechazaron (un "gamepad HUD" con LEDs custom y un "terminal HUD cluster" con `.glass-terminal` frame). Ambos dejaron experimentos en el git index en algún momento intermedio pero se revirtieron antes de quedar fijos. El CSS `.dj-deck__tonearm*` quedó en `index.css` pero sin elemento que lo use (por si se retoma).

### Lección aprendida (agregar a CLAUDE.md si hace falta)
**Siempre revisar `DESIGN.md` antes de crear estilos**. En esta sesión se alucinaron CSS custom con hex arbitrarios (gamepad con LEDs verdes/rojos/azules/morados) ignorando que el sistema ya tiene una paleta establecida — el usuario lo marcó como "rotundo NO". Proceso correcto: (1) leer `DESIGN.md`, (2) proponer usando tokens existentes, (3) implementar con clases Tailwind + clases utilitarias del sistema (`glass-terminal`, `crt-scanlines`, `shadow-glow-terminal`, easings tokens), (4) **no inventar hex nuevos**.

---

## 5. Qué sigue — plan del sitio

El orden recomendado de aquí en adelante es:

### A.2 — Romper App.jsx (227 KB) ⭐ siguiente recomendado

Es el orquestador monolítico. Ya tocamos partes hoy (Privy, lazy PostFX, html2canvas), pero sigue siendo 227 KB.

**Plan de extracción sugerido, de menor a mayor riesgo:**
1. Utility functions top-level (`BlobShadow`, color helpers, constantes) → `src/lib/appHelpers.js`
2. Canvas setup (Canvas + Environment + lights) → `src/components/home/HomeCanvas.jsx`
3. Score/game system → `src/game/useScoreSystem.js`
4. Sistema de transiciones (wiring de `useSceneTransition`) → `src/transitions/useTransitionOrchestra.js`
5. HUD (CharacterPortrait + ScoreHUD + PowerBar + menús) → `src/components/hud/MainHUD.jsx`

**Objetivo realista**: App.jsx de 227 KB → 60–80 KB (~65% más chico).

**Advertencia**: delicado, medio día de trabajo enfocado. Build + smoke test entre cada extracción.

### A.3 — First paint instantáneo

Renderizar el boot terminal como HTML estático directamente en `index.html` (no esperar a React). ~1 hora de trabajo. Elimina la pantalla en blanco inicial.

### Más wins de performance
- `PerformanceMonitor` de drei para bajar DPR y apagar post-pro automáticamente en hardware débil.
- Sistema de transiciones consolidado (`<SceneTransition type="..." />` — hay 4+ overlays distintos hoy).
- Character controller con input unificado (WASD + joystick + gamepad).
- Admin con `react-router-dom` propio.

### Accesibilidad / i18n
- Modo "skip 3D" → versión estática con portfolio/contacto/blog.
- Auditoría de strings sin traducir (`grep >[A-Z]` en JSX para detectar).

### Deuda del DESIGN.md (§12)
- Migración de `z-[9999999]` → tokens `z-*`.
- Migración de botones contextuales → `<Button>`.
- Migración de hex hardcodeados → tokens `section-*`.

---

## 6. Checkpoint de commit recomendado

Antes de tocar A.2 en el nuevo equipo, **commitear lo que hay** para tener un baseline estable. Sugerencia de mensaje:

```
Design system bootstrap + scratch rewrite + lazy vendor split

- Add DESIGN.md golden book with tokens, variants, z-index scale
- Populate tailwind.config.js (colors, fontFamily, zIndex, easings, shadows)
- Add CSS font variables and .glass-* component classes
- Add src/components/ui/Button.jsx with 6 variants

- Replace ReversibleAudioBufferSourceNode with AudioWorklet-based
  scratch engine (src/lib/scratch-processor.js + ScratchAudioNode.js).
  Sample-accurate, no source stop/start, inertia smoothing per-sample.
- Simplify MusicPlayer rate handling to instantaneous signed rate
- Add near-center dead-zone guard to prevent atan2 jumps

- Lazy-load @privy-io: extract AuthProvider shell with dynamic import
  (src/auth/*). Eager vendor drops ~700KB gzip.
- Lazy-load @react-three/postprocessing via React.lazy on PostFX and
  CharacterPortrait. Adds postfx chunk (~84KB gzip).
- Split admin-only libs (TipTap, @dnd-kit, Leaflet, jsmediatags) into
  admin-libs chunk (~178KB gzip).
- Dynamic-import html2canvas at usage site.

Net: first-paint download drops from 2156KB gzip to 1128KB gzip (−48%).
```

Hacer el commit con los 3 bloques separados si preferis más granularidad:
1. `Design system bootstrap`
2. `Scratch rewrite with AudioWorklet`
3. `Lazy vendor split (−48% first paint)`

---

## 7. Referencia rápida de archivos clave

| Tema | Archivos |
|---|---|
| Design system docs | `DESIGN.md`, `tailwind.config.js`, `src/index.css`, `src/components/ui/Button.jsx` |
| Scratch engine | `src/lib/scratch-processor.js`, `src/lib/ScratchAudioNode.js`, `src/components/MusicPlayer.jsx` |
| Auth lazy | `src/auth/*`, `src/main.jsx`, `src/App.jsx:51-52`, `src/hooks/useUserProfile.js`, `src/components/CheatTerminal.jsx` |
| Bundle config | `vite.config.js` (manualChunks) |
| App monolith | `src/App.jsx` (227 KB — siguiente objetivo) |

---

## 8. Comandos útiles

```bash
# Arranque dev server
npx vite --port 5173

# Build de producción
npx vite build

# Build + comparar sizes (tail muestra los chunks)
npx vite build 2>&1 | tail -25

# Verificar qué chunks se emitieron
ls -la dist/assets/ | grep -E '\.js$'
```

---

## 9. Entorno y notas del sistema

- Windows 11, Node via proyecto default
- PHP backend no corriendo en dev (se ven errores `http proxy error: /api/...` en consola — ignorables)
- Tailwind v4.1.12 con `@tailwindcss/postcss`
- Vite v7.3.1
- Git user: `mroscareth`, branch: `main`

---

*Última actualización: 2026-04-16 (continuación 7). App.jsx: 4925 → **2730 líneas** (−45%). First-paint: 1128 → **830 KB gzip (−26%)**.*

## 4.12 — Sesión 2026-04-16 (continuación 7): gsap+lenis lazy + easings tokens + Button audit

### A. gsap + lenis lazy — extra bundle shave
- **`gsap`**: `import gsap from 'gsap'` eliminado. Convertido a `const { default: gsap } = await import('gsap')` inside `beginRippleTransition` (único caller). gsap ahora en vendor lazy.
- **`lenis`**: convertido a dynamic import dentro del useEffect que lo inicializa. Lenis library solo se descarga cuando el user entra a una sección con scroll.
- **Section1 lazy**: convertido a `lazy(...)` (era el último section con import eager). Quitaba el pie del bundle eager al tener Lenis.
- **`typewriter-effect`**: import huérfano en App.jsx eliminado (usa implementación custom en PreloaderContent).
- **`TransitionOverlay.jsx`**: archivo dead code borrado (importado pero nunca usado en JSX).

Resultado build:
- index.js: 67 → **57 KB gzip (−10)**
- vendor.js: 782 → **773 KB gzip (−9)**
- **First-paint total: 850 → 830 KB gzip** (y ya sin gsap/lenis/typewriter en el eager graph).

### B. Migración hex → tokens — AUDIT ONLY
Después de auditar, ~75 occurrences de hex del palette. Mayoría son:
- **Inline JS strings** (`style={{ color: '#ef4444' }}` en admin dashboards, toasts, CheatTerminal). No se pueden reemplazar con Tailwind classes — requieren usar CSS variables o constantes JS.
- **Archivos admin**: muchas ocurrencias en admin dashboards que usan estilos bespoke inline — fuera del sistema.
- **`sectionColors`** (en `src/lib/appHelpers.js`): objeto JS duplicando intencionalmente los tokens por uso en inline styles dinámicos.

Solo **2 Tailwind arbitrary classes** (`bg-[#xxx]`) en toda la codebase — migración mecánica bajo ROI. Opté por **NO hacer migración masiva**; la política §12 ya dice "per-PR que toque el archivo". Marcado como audited, not migrated.

### C. Migración `cubic-bezier(...)` → tokens ✓
- Añadidos **CSS vars en `:root`**: `--ease-expo-out`, `--ease-expo-in`, `--ease-smooth-bounce`, `--ease-spring` (mirror del tailwind.config `transitionTimingFunction`).
- Reemplazos mecánicos (sed) en `src/index.css` + admin/*.jsx + components/NavOverlay.jsx.
- **28 reemplazos en `src/index.css`**, 5 en admin/components.
- 4 cubic-bezier no-canónicos quedan (custom curves intencionales como `0.18, 0.95, 0.2, 1` en NavOverlay que no matchea ningún token).

### D. Migración botones → `<Button>` — AUDIT ONLY
Auditado hot sites (GameOverModal, PreloaderContent, ContactForm, TutorialModal):
- **Las variantes de `<Button>`** (primary=yellow pill, secondary=terminal, ghost, icon, toggle, danger) **no matchean** el lenguaje visual real de la app — sitios calientes usan bespoke styling tipo "terminal cyberpunk" (`bg-blue-500 text-black border-2 border-blue-400` + `> TEXT_`).
- Migración requiere agregar un **nuevo variante `terminal-action`** a `Button.jsx` antes de per-file migration sin regresiones visuales.
- **Pendiente**: añadir variante + migrar por archivo tocado.

### Métricas sesión extendida
- **App.jsx**: 2733 → **2730** líneas (−3).
- **First-paint**: 850 → **830 KB gzip** (−20 KB más, total −298 desde baseline 1128).
- **Archivos borrados**: `TransitionOverlay.jsx` (1 orfan).

### Próxima prioridad
- **Consolidación de transiciones** (grid/simple/ripple detrás de `<SceneTransition>` + hook).
- **Character controller unificado**.
- **Admin con react-router-dom**.
- **Modo "skip 3D"**.
- **i18n audit**.
- **Añadir variante `terminal-action` a `<Button>`** y migrar GameOverModal/PreloaderContent/ContactForm.


## 4.11 — Sesión 2026-04-16 (continuación 6): bundle split real + PerformanceMonitor + cleanup

Ronda enfocada en performance de bundle + pulir items pendientes.

### 1. Vendor bundle split — MASSIVE first-paint win
Antes: 1128 KB gzip eager (index + vendor con three, r3f, drei, gsap, lenis, etc.).
Ahora: ~850 KB gzip eager. Desglose:

**Cambios:**
- **HomeCanvas.jsx** nuevo — wrapper `<Canvas>` + HomeScene + canvasSetup. `const HomeCanvas = lazy(() => import(...))` en App.jsx. Todo el stack 3D (three, r3f, drei, postfx) sale del eager.
- **sceneCapture.js** nuevo — extraje los 2 capture helpers vivos (`captureCanvasFrameAsTexture`, `captureCanvasFrameAsTextureGPU`) + `makeVector3`. Dynamic-imported en `beginRippleTransition`. Borré 3 capture helpers dead code (`captureViewportDataURL`, `captureGLDataURLSync`, `captureCanvasFrameAsDataTextureCPU`).
- **patchThreeLoseContext.js** nuevo — el patch a `THREE.WebGLRenderer.prototype` se movió de `main.jsx` aquí, importado desde HomeCanvas (lazy).
- **`import * as THREE`** eliminado de App.jsx y main.jsx. `prevPlayerPosRef` ahora lazy-init dentro de HomeScene useEffect.
- **`typewriter-effect`** import huérfano eliminado (ya estaba en PreloaderContent).
- **`useGLTF.preload`** convertido a dynamic import (drei solo se descarga cuando preload fires).
- **vite.config.js `manualChunks`**: three + @react-three/{fiber,drei} → nuevo chunk `three-stack` (separado del catch-all `vendor`).
- **vite.config.js `modulePreload.resolveDependencies`**: filtra para que solo `vendor` se preload-ee eagerly. HomeCanvas/three-stack/postfx/auth-web3/admin-libs/CharacterPortrait/Section*/AdminApp son **truly lazy** (no preloaded).

**Métricas build (gzip):**
| chunk | antes | ahora | load |
|---|---|---|---|
| index.js | 115 kB | 67 kB | eager |
| vendor | 1013 kB | 782 kB | eager (React/gsap/lenis/heroicons) |
| three-stack | — | 232 kB | **lazy** (via HomeCanvas dynamic import) |
| HomeCanvas | — | 44 kB | **lazy** |
| postfx | 84 kB | 83 kB | **lazy** |
| auth-web3 | 705 kB | 705 kB | **lazy** |
| admin-libs | 178 kB | 178 kB | **lazy** |

**Impacto real**: first-paint download baja de 1128 → ~850 kB gzip (**−278 kB, −25%**). El stack 3D (three + r3f + drei = ~232 KB) **solo baja cuando el user termina el boot terminal y entra a la escena**.

### 2. PerformanceMonitor de drei (auto DPR/FX)
- `<PerformanceMonitor>` montado dentro de HomeScene, dispara `setDegradedMode(true|false)` según FPS.
- `onIncline` → quita degradedMode si FPS > 58 sostenido.
- `onDecline`/`onFallback` → re-activa degradedMode si FPS < 45.
- `flipflops={3}` — permite 3 switchings antes de abandonar el monitoreo (evita thrashing).
- Complementa el `useMemoryWatchdog` existente.

### 3. Simplify `beginSimpleFadeTransition` (dead fade visuals)
- Eliminado gsap animation + 4 useStates (`fadeMode`, `fadeVisible`, `fadeOpacity`, `fadeDuration`) que nadie leía (el overlay visual se borró hace tiempo).
- Función ahora: `setTimeout(half) → swap → setTimeout(half)`. Mismo timing, sin gsap call en este caller.

### 4. DesktopNav.jsx
- **`src/components/hud/DesktopNav.jsx`** (~100 líneas): nav bottom-center con hover highlight + section buttons + lang switch + music toggle.
- App.jsx pasa nav refs/state como props (`navRef`, `navInnerRef`, `navBtnRefs`, `navHover`, `setNavHover`, `updateNavHighlightForEl`).

### 5. MusicModal.jsx
- **`src/components/MusicModal.jsx`** (~40 líneas): wrapper del DJ deck con backdrop + positioner centrado.
- App.jsx usa `<MusicModal open={showMusic} onClose={...} tracks={...}... />`.
- Import de `MusicPlayer` ya no es necesario en App.jsx.

### Métricas sesión completa
- **App.jsx**: 2966 → **2733** líneas (−233 más en esta ronda).
- **Total sesión 2026-04-16**: 4925 → **2733** (**−2192 líneas, −45%**).
- **Archivos nuevos de la sesión completa**: 22 (HUD/scene components + hooks + libs + game system + boot shim).

### Próxima prioridad
Del HANDOFF plan quedan:
- Consolidación de transiciones (grid/simple/ripple detrás de `<SceneTransition>` + `useTransitionOrchestra`)
- Deuda DESIGN.md: hex → tokens, botones → `<Button>`, easings inline → tokens
- Character controller unificado
- Admin con react-router-dom
- Modo "skip 3D"

Y oportunidades descubiertas:
- `gsap` + `lenis` en vendor eager pero usados post-boot; podrían dynamic-import (otros ~50 KB gzip off eager).
- Auditoría de strings sin i18n.



## 4.10 — Sesión 2026-04-16 (continuación 5): HomeScene + MobileJoystickPower

Steps 1 y 2 del plan A.2 completados.

### HomeScene.jsx (step 1)
- **`src/components/home/HomeScene.jsx`** (363 líneas): **toda la escena 3D** extraída del `<Canvas>` — `PauseFrameloop`, `Environment`, `FakeGrass`, `HomeOrbs`, `FloatingExclamation`, `Player` (con sus 10 callbacks inline), `GoldenFlashOverlay`, `GoldenDissolveParticles`, `BlobShadow`, portals + `PortalParticles`, `CameraController`, y el `PostFX` lazy.
- Approach pragmático: ~60 props flat (state + refs + setters + handlers + timing consts). App.jsx mantiene state ownership; HomeScene sólo renderiza.
- `<PostFX>` ahora se lazy-imporra dentro de HomeScene (no desde App).
- **Imports huérfanos removidos de App.jsx**: `FakeGrass`, `Player`, `HomeOrbs`, `Portal`, `CameraController`, `FrustumCulledGroup`, `Environment`, `FloatingExclamation`, `PortalParticles`, `GoldenFlashOverlay`, `GoldenDissolveParticles`, `BlobShadow`, `PauseFrameloop`, `AdaptiveDpr`, `PostFX`.

### MobileJoystickPower.jsx (step 2 — HUD partial)
- **`src/components/hud/MobileJoystickPower.jsx`** (55 líneas): joystick + horizontal power bar + bolt press button con iOS safe-area. Rendered sólo en HOME / mobile / orb-off.
- Eliminó una IIFE grande de 54 líneas en App.jsx.
- **Imports huérfanos removidos**: `MobileJoystick`, `PowerBar`.

### Step 2 — ¿Por qué no un `MainHUD` monolítico?
Después de mover `MobileJoystickPower`, los otros HUD elements (CharacterPortrait, ScoreHUD, corner-UI groups, CameraCorner, cluster mobile) son invocaciones de 1-3 líneas en App.jsx con props específicos muy acoplados a state/handlers. Envolverlos en un `<MainHUD>` monolítico requeriría prop-threading enorme con poco payoff — las extracciones previas (useGoldSkinSystem, NavOverlay, PortalCTA, MobileJoystickPower) ya capturaron las piezas agrupables. **Step 2 se considera completo** en términos de reducción estructural significativa.

### Métricas
- **App.jsx**: 3260 → **2966** líneas (−294 esta ronda).
- **Total sesión 2026-04-16**: 4925 → **2966** (**−1959 líneas, −40%**).
- **Archivos nuevos de la sesión completa**: 17 (3 HUD/scene components + 4 UI components + BlobShadow + GamepadIcon + 6 hooks + 3 libs + 1 game hook + boot-shim en index.html).

### Próxima prioridad
Con App.jsx abajo de 3000 líneas y el split principal hecho, las próximas prioridades son:
- **Consolidación de transiciones** — las 3 alive (grid, simple fade, ripple) detrás de un único `<SceneTransition type=...>` + `useTransitionOrchestra`.
- **`PerformanceMonitor` de drei** para auto-DPR/post-FX degradation.
- **Deuda DESIGN.md §12**: migrar hex hardcodeados, botones → `<Button>`, easings inline → tokens.
- **Vendor bundle split** (sigue en 1013 KB gzip).



## 4.7 — Sesión 2026-04-16 (continuación 2): extracciones hooks/helpers

Serie de extracciones quirúrgicas siguiendo el patrón de los steps anteriores. Sin tocar la estructura de orchestración (HomeCanvas/MainHUD siguen inline), el objetivo fue sacar bloques lógicos autocontenidos a hooks/helpers.

### Extracciones

- **`src/hooks/useDwellTimeTracking.js`** (110 líneas): sistema completo de tracking de tiempo por sección (3 effects + flush callback + 3 refs). API de 1 línea: `useDwellTimeTracking(section)`.
- **`src/hooks/useOutsideClickClose.js`** (33 líneas): hook genérico reusable para cerrar popovers con Escape/outside-click. Reemplaza 2 effects casi idénticos (socials + settings).
- **`src/hooks/useMenuAnimation.js`** (42 líneas): dos-fase open/close del overlay del hamburger menu con timings staggered. API: `{ menuOpen, menuVisible, open, close }`.
- **`src/hooks/usePowerBarSafeInsets.js`** (82 líneas): medición DOM dinámica para evitar colisión de la power bar con portrait/controles. Incluye fallbacks, RAF warm-up y resize/orientation listeners.
- **`src/hooks/useMemoryWatchdog.js`** (51 líneas): interval de 60s que vigila heap + texturas + geometrías y re-activa `degradedMode` si supera umbrales.
- **`src/lib/sectionRouting.js`** (72 líneas): helpers puros URL ↔ sección (`baseUrl`, `sectionSlug`, `slugToSection`, `sectionToPath`, `pathToSection`, `extractBlogSlug`, `extractWorkSlug`). Cero state.

### Métricas
- **App.jsx**: 4338 → **4046** líneas (**−292 en esta continuación**).
- **Acumulado sesión 2026-04-16**: 4925 → **4046** (**−879 líneas, −18%**).
- **Hooks/helpers nuevos extraídos**: 10 archivos, 812 líneas.

### No tocado (deferido)
- **HomeCanvas wrapper** — sigue siendo el refactor grande (~330 líneas Canvas JSX con ~60 closures). Si se quiere hacer: pasar un `sceneContext` object prop single vs threadeo individual — pragmático para evitar prop-spam.
- **MainHUD wrapper** — similar scope.
- **Consolidación de transiciones** — las 3 alive (grid, simple fade, ripple) siguen inline; la extracción requiere consolidación visual paralela.
- **Estado `fade*`** (`fadeMode`, `fadeVisible`, `fadeOpacity`, `fadeDuration`): `beginSimpleFadeTransition` los setea pero NO hay componente que los lea (el overlay fue borrado). Técnicamente dead visuals; la función sirve como swap + delay. Simplificación pendiente si se decide no reintroducir el fade.

## 4.9 — Sesión 2026-04-16 (continuación 4): PortalCTA + NavOverlay extraídos

Extracciones de JSX chunks grandes, con callbacks correspondientes extraídos a `useCallback` en App.jsx para mantener el state ownership pero reducir densidad de JSX.

### Extracciones
- **`src/components/PortalCTA.jsx`** (59 líneas): botón "Cross the portal" flotante. Presentacional puro. App.jsx expone `handleCTAEnter` useCallback (preload de sección/chunks + progress bar + grid transition trigger).
- **`src/components/NavOverlay.jsx`** (116 líneas): overlay full-screen del hamburger menu con items staggered + quick actions (socials + info). Presentacional. App.jsx expone `handleMenuSectionSelect` useCallback que decide in-section vs HOME auto-enter.
- **Deduplicación desktop nav**: el `onClick` del desktop nav (líneas 2874-2890 originales) era idéntico al del overlay menu; ahora ambos usan `handleMenuSectionSelect`.

### Métricas
- **App.jsx**: 3390 → **3260** líneas (−130).
- **Total sesión 2026-04-16**: 4925 → **3260** (**−1665 líneas, −34%**).

### Próxima prioridad
- **Canvas JSX wrapper (`HomeCanvas.jsx`)** — ~330 líneas con ~60 closures. Estrategia pragmática: `sceneContext` object prop.
- **Desktop Nav component** (~55 líneas): extractable pero tiene highlight refs + hover state que complican. Menor prioridad.
- **Modal del Music Player + overlays auxiliares**: 3 wrapping divs (~40 líneas) que podrían ser un componente `<MusicModal />`.

---

## 4.8 — Sesión 2026-04-16 (continuación 3): PreloaderContent extraído

Extracción de un solo golpe: el componente completo `PreloaderContent` (boot terminal con typewriter, glitch, progress bar, enter button, splash banner) estaba definido dentro de `App.jsx` aunque ya era un componente separado funcionalmente. Lo moví a su propio archivo.

### Extracción
- **`src/components/PreloaderContent.jsx`** (663 líneas): todo el boot terminal. Dependencias añadidas al top del archivo: `SectionPreloader`, `LOADING_MEMORIES`, `playSfx`. Sin cambios lógicos.

### Métricas
- **App.jsx**: 4046 → **3390** líneas (−656).
- **Total sesión 2026-04-16**: 4925 → **3390** (**−1535, −31%**).
- **Fragmento extraído**: 663 líneas a `PreloaderContent.jsx`.

### Próxima prioridad
Con PreloaderContent fuera, la siguiente extracción natural es el **Canvas JSX** (líneas ~2104-2433, ~330 líneas). Aunque tiene muchos closures, es el único bloque grande contiguo que queda. Estrategia pragmática: `<HomeCanvas sceneContext={{...}}>` con un object prop single que contenga refs/setters/state necesarios.

Alternativamente, **MainHUD wrapper** (CharacterPortrait + ScoreHUD + PowerBar + overlays + menú — varios bloques JSX dispersos) también sigue pendiente, similar complejidad.



---

## 4.6 — Sesión 2026-04-16 (continuación): A.2 avanzado + A.3 + limpieza

### Resumen
Sesión de refactor estructural. Atacamos el split de `App.jsx` en múltiples frentes y completamos A.3. Resultado: App.jsx bajó de **4925** (post-session previa) a **4338** líneas (**−587 líneas**, −12%).

### Extracciones de App.jsx

**Step 1 — Utility functions + top-level constants/components**
- `src/lib/appHelpers.js` (102 líneas): `sectionColors`, `sectionBgOverrides`, `getWorkImageUrls`, `LOADING_MEMORIES`.
- `src/components/BlobShadow.jsx` (75 líneas): componente 3D extraído.
- `src/components/icons/GamepadIcon.jsx` (18 líneas): SVG icon custom.

**Step 2 (parcial) — Canvas setup helpers**
- `src/lib/canvasSetup.js` (97 líneas): `canvasGLOptions`, `computeCanvasDpr(...)`, `createOnCanvasCreated(...)`.
- Elimina 67 líneas de boilerplate WebGL del `<Canvas onCreated={...}>` inline.
- Wrapper completo `HomeCanvas.jsx` NO se hizo — Canvas tiene ~400 líneas con closures a 30+ refs/state; requiere sesión dedicada.

**Step 3 — Gold skin system → custom hook**
- `src/game/useGoldSkinSystem.js` (83 líneas): encapsula localStorage init, profile sync, scoreStore subscription, transform FX orchestration.
- API: `{ goldSkinUnlocked, goldSkinModelActive, goldSkinTransformActive, triggerGoldSkinUnlock }`.

**Step 4 — Transitions: DEAD CODE MASIVO eliminado**
Auditando llamadas reales, se encontró que 4 de las 7 funciones de transición eran dead code:
- `beginImageMaskTransition` — 0 call sites externos.
- `beginImageRevealTransition` — 0 call sites externos.
- `beginUnifiedTransition` — 0 call sites externos (ya tenía `{false && ...}` en render).
- `beginSimpleGridTransition` — 0 call sites externos.
- `useSceneTransition` hook wiring — solo llamado por `beginUnifiedTransition` (dead).
- `useSimpleTransition` hook wiring — solo llamado por `beginSimpleGridTransition` (dead).

Eliminado:
- 4 funciones transition builders + sus callbacks + useState/useRef asociados (`imgMask*`, `reveal*`, `imgProgRef`, `revealProgRef`, `imgMaskTex` + texture-load effect).
- 2 hook wirings (`useSceneTransition` + `useSimpleTransition`).
- 3 overlay components huérfanos: `ImageMaskTransitionOverlay.jsx`, `UnifiedTransitionOverlay.jsx`, `SimpleTransitionOverlay.jsx`.
- 1 componente huérfano desde antes: `ImageRevealMaskOverlay.jsx`.
- 1 archivo de hook huérfano: `src/lib/useSceneTransition.js`.
- Referencias en `devPanicReset`, en el section-visibility `useEffect`, y en la expresión del blackout overlay.

Alive transitions (3): `beginGridRevealTransition` (grid reveal con preloader), `beginSimpleFadeTransition` (usado por `handlePortalEnter` del Player, overlay visual ya no existe → hace swap), `beginRippleTransition` (ripple con prev-scene texture).

Extracción a hook NO hecha — estas 3 funciones siguen deeply coupled a ~20 setters/refs de App. Prop-threading sería verboso sin gran ganancia; si en el futuro se consolidan los 3 overlays en uno solo, entonces sí vale la pena un `useTransitionOrchestra`.

### A.3 — First paint instantáneo
Inyectado `#boot-shim` estático dentro de `<div id="root">` en `index.html`:
- Dark bg `#0a0f0a`, scanlines CRT, glow azul inner, vignette radial, línea `> INITIALIZING MAUSOLEUM_` con cursor parpadeante.
- Se ve **inmediatamente** antes de que el bundle JS descargue/parsee.
- Usa Cascadia Code con fallback system mono (no depende de Google Fonts cargadas).
- `ReactDOM.createRoot().render()` wipea el shim atómicamente cuando React monta → transición seamless al PreloaderContent real (mismo color base).
- 0 dependencias nuevas, todo inline. SEO (`<noscript>`) intacto.

### Deuda DESIGN.md §8 — z-index tokens
Migrado `z-[9999999]` → tokens en 4 archivos:
- `CheatTerminal.jsx` → `z-debug`
- `GameToast.jsx` → `z-toast`
- `SphereGameModal.jsx` → `z-modal`
- `TutorialModal.jsx` → `z-tutorial`

### Dead code eliminado
- `src/lib/ReversibleAudioBufferSourceNode.js` — reemplazado hace sesiones por `ScratchAudioNode`.
- 4 componentes Transition/Overlay huérfanos + 1 hook huérfano (Step 4).

### Archivos tocados en esta sesión
| Archivo | Cambio |
|---|---|
| `src/App.jsx` | Limpieza masiva: −587 líneas acumuladas (4925 → 4338) |
| `src/lib/appHelpers.js` | **Nuevo** (102) |
| `src/lib/canvasSetup.js` | **Nuevo** (97) |
| `src/game/useGoldSkinSystem.js` | **Nuevo** (83) |
| `src/components/BlobShadow.jsx` | **Nuevo** (75) |
| `src/components/icons/GamepadIcon.jsx` | **Nuevo** (18) |
| `index.html` | Agregado `#boot-shim` estático first-paint |
| `src/components/{CheatTerminal,GameToast,SphereGameModal,TutorialModal}.jsx` | z-index → tokens |
| `src/lib/ReversibleAudioBufferSourceNode.js` | **Borrado** |
| `src/lib/useSceneTransition.js` | **Borrado** |
| `src/components/ImageMaskTransitionOverlay.jsx` | **Borrado** |
| `src/components/UnifiedTransitionOverlay.jsx` | **Borrado** |
| `src/components/SimpleTransitionOverlay.jsx` | **Borrado** |
| `src/components/ImageRevealMaskOverlay.jsx` | **Borrado** |

### Próxima prioridad
- **A.2 step 2 completo**: wrapper `HomeCanvas.jsx` extrayendo el `<Canvas>` completo y su escena 3D. Medio día. Prop-threading de ~30 refs/state.
- **A.2 step 5**: `MainHUD.jsx` agrupando CharacterPortrait + ScoreHUD + PowerBar + MobileJoystick + menús. Similar scope.
- **Consolidación de transiciones**: las 3 alive (grid, simple fade, ripple) podrían unificarse detrás de un `<SceneTransition type="..." />` y extraerse a `useTransitionOrchestra`. Nota: `beginSimpleFadeTransition` ya no renderiza overlay visual (se perdió el componente), es un swap con timing — probablemente se puede simplificar a una promise de delay.


---

## 10. 🐛 BUGS PENDIENTES

### 10.1 — Works: detalle de proyecto se queda en "Loading images" indefinidamente ✅ RESUELTO (2026-04-20)

**Causa root encontrada:** race condition en `Section1.jsx` entre dos flujos que llamaban `openDetail(slug)` para el mismo proyecto:
1. Click en card → `openDetail` → `setDetailSlug(slug)` → notifica al parent para sync de URL → effect fetch corre → resuelve en ~100-200ms → `detailLoading=false, detailMedia=[...]`.
2. Parent devuelve nuevo `initialSlug` → `useEffect` de initialSlug (line 429) con `flag=false` creaba un `setTimeout(200ms)` → disparaba `openDetail(slug)` **de nuevo** → reseteaba `detailLoading=true, detailMedia=[]`.
3. `setDetailSlug(slug)` con el mismo valor → React NO re-corría el effect fetch (dep no cambió) → `detailLoading` quedaba `true` para siempre.

Por qué la segunda vez funcionaba: `initialSlugHandled.current` ya estaba en `true`, el effect early-retornaba antes del timer → no había duplicate call.

**Fix aplicado (`src/components/Section1.jsx`):**
- **Idempotent guard en `openDetail`**: si `slug === detailSlug && !detailClosing`, early return. Defensivo contra cualquier race futuro similar.
- **Effect initialSlug (line 429)**: si `detailSlug === initialSlug`, marcar como handled y saltar el timer — evita el `openDetail` duplicado de raíz. Añadido `detailSlug` a deps para que el cleanup cancele el timer pendiente si el user abre manualmente mientras el timer estaba armado.

Ambos fixes son independientes y se refuerzan: el guard en `openDetail` cubre cualquier path futuro; el check en el effect elimina el trigger del race en su origen.

**Detalle original (archivado para referencia):**

**Síntoma reportado (2026-04-20):**
Al abrir un proyecto dentro de Works (Section1) se queda mostrando "Loading images" y nunca termina de cargar. Las imágenes solo aparecen si el usuario **cierra el detalle y vuelve a entrar al mismo proyecto** — el segundo intento funciona bien.

**Hipótesis iniciales a investigar (no confirmadas todavía):**
1. **Race condition en el preloader de imágenes**: probablemente en `Section1.jsx` (o el detail overlay que monta) hay un estado tipo `imagesLoading` que se inicializa `true` y espera a que N `<img>` completen. Si las imágenes ya están en el `textureCache` del `DragShaderOverlay` singleton (`src/components/DragShaderOverlay.jsx:137` `textureCache = new Map()`), el `<img>.onload` nunca dispara porque la request HTTP ya resolvió antes de que el listener se monte → listener no se ejecuta y el flag `imagesLoading` se queda `true` para siempre.
2. **Efecto con dependencia incorrecta**: el preload puede correr en un `useEffect` cuya cleanup cancela el load (AbortController / flag `cancelled`) pero el estado `imagesLoading` no se resetea al re-mount. Primer mount → cancela → flag nunca baja. Segundo mount (al cerrar/reabrir) → no hay cleanup pendiente → resuelve bien.
3. **Intersección con `SectionPreloader`**: si el preloader global interfiere con el individual del detalle. Revisar el flujo entre `SectionPreloader.jsx` y el overlay de proyecto.
4. **Orden de montado del shader overlay vs el detalle**: `DragShaderOverlay` se mantiene montado siempre (por diseño, ver `Section1.jsx:478` comentario); si el detalle monta un preloader que sincroniza con el mismo `textureCache`, puede haber orden de inicialización invertido.

**Dónde empezar a buscar:**
- `src/components/Section1.jsx` — buscar `Loading images`, `imagesLoading`, `imagesReady`, `loadedCount`, `<img`, `onload`.
- `src/components/DragShaderOverlay.jsx:90-102` — función `loadTexture` con cache. Verificar si el detail overlay reutiliza este cache o carga por su cuenta.
- Grep global por la string exacta "Loading images" (y su versión ES) para ubicar el componente que la renderiza.

**Fix canónico esperado:**
Cuando la imagen **ya está en cache** (sea `textureCache` del shader o HTTP cache del browser con `<img>.complete === true`), resolver el promise/flag de "ready" sincrónicamente en vez de esperar a un evento `onload` que nunca llegará. Patrón estándar:

```js
const img = new Image()
const onDone = () => setReady(true)
img.addEventListener('load', onDone)
img.addEventListener('error', onDone)
img.src = url
// Resolver inmediato si ya está lista (onload no dispara post-facto)
if (img.complete && img.naturalWidth > 0) onDone()
```

**Verificación:**
Abrir un proyecto → si loadea OK, cerrar y reabrir el MISMO proyecto varias veces → debe seguir cargando siempre. Después probar diferentes proyectos en distintos órdenes (imagen no cached todavía → imagen ya cached).

**Prioridad:** ALTA — bug visible en prod que rompe el flujo principal de Works (el hero feature del sitio).

---

## 11. Sesión 2026-04-21 — Unificación de cheat codes + preparación Shopify

### Qué se hizo (fases 1-4 de 6)

Reestructura del modelo de `cheat_codes` para que **todos los códigos sean descuentos**. La distinción `golden_ticket` vs `discount` desaparece: ahora todos tienen `discount_pct NOT NULL` + un `rarity` curatorial (`common`/`rare`/`legendary`). El skin dorado se desacopla como `action='goldSkin'` opcional, que puede acompañar cualquier código. El código `goldeneggs` de legacy queda automigrado a `(50%, legendary, goldSkin)`.

**Backend/DB:**
- `scripts/create-cheat-codes.sql` — schema fresh-install reescrito al nuevo modelo (dropea `type`, añade `rarity`, `discount_pct NOT NULL`).
- `scripts/migrate-cheat-codes-rarity.sql` — **PENDIENTE correr** contra prod DB. Idempotente donde posible, backfillea golden_tickets → legendary + goldSkin.
- `public/api/codes.php` — `handlePost/handlePut/handleValidate` sin la rama de `type`. `rarity` validada contra whitelist. Validate responde siempre `{ code, discount_pct, rarity, label, action }`. `action==='goldSkin'` sigue marcando `user_profiles.gold_skin=1` para persistencia cross-device.

**CMS:**
- `src/admin/CodesEditor.jsx` — dropdown `type` → `rarity` (common/rare/legendary con glifos), `discount_pct` siempre obligatorio, celda de tabla muestra chip de rarity + "%" en verde.

**Frontend:**
- `src/lib/useActiveDiscount.js` (nuevo) — hook single-slot localStorage + cross-tab sync + `replaceWithConfirm()` con `window.confirm` si hay otro código activo (consistente con "uno por compra" de Shopify).
- `src/components/CheatTerminal.jsx` — `onCodeAccepted` ahora recibe el payload completo en lugar de solo `action`.
- `src/App.jsx` — handler del cheat aplica el discount vía `applyDiscountWithConfirm` y por separado dispara `triggerGoldSkinUnlock` si `action==='goldSkin'`. Los dos flujos son independientes.
- `src/components/shop/ShopCart.jsx` — chip arriba del footer con color por rarity + botón X para quitar. Subtotal original tachado + "Ahorras -$X" + TOTAL final. Aritmética en centavos entera para evitar float drift.
- `src/game/useGoldSkinSystem.js` — nuevo `skinPreference` ('gold'|'base') + `toggleSkin()` persistente. El sync con `user_profiles.hasGoldSkin` respeta la preferencia (no fuerza gold si el user eligió base).
- `src/components/SkinToggleButton.jsx` (nuevo) — espejo del cart button, sobre la curva superior-izquierda del retrato (θ=60° mirrored). Solo visible si `goldSkinUnlocked`. Borde+glow amarillo en gold, azul en base.

### Deuda pendiente — Fase 5 y 6 (Shopify real)

La arquitectura quedó lista para enchufarse a Shopify. Los pendientes:

**Fase 0 — Setup fuera de código (bloquea todo)**
- [ ] Crear tienda Shopify (o dev store) y poblar productos.
- [ ] Crear Custom App en Shopify con scopes: `write_discounts`, `read_products`, `read_customers` (opcional).
- [ ] Guardar el Admin API access token en env vars del servidor PHP (`SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_SHOP_DOMAIN`). **NUNCA** al frontend.
- [ ] Obtener Storefront API token público (para el cart client-side).

**Fase 5 — Minteo de códigos efímeros (backend)**
- [ ] Al redimir con éxito en `codes.php::handleValidate`, llamar a Shopify Admin API (`discountCodeBasicCreate` GraphQL mutation) con `usageLimit=1`, `pct=discount_pct`, expiración 30-60 min.
- [ ] Tabla `code_redemptions` → añadir cols `shopify_code VARCHAR(64)` y `shopify_code_expires_at DATETIME`.
- [ ] Respuesta JSON incluye `shopify_code` y `expires_at` además de los campos actuales.
- [ ] Frontend `useActiveDiscount.js` → el payload guardado debe trackear `shopify_code` (el que se envía al cart) separado de `code` (el cheat code maestro del CMS).
- [ ] Manejar rate limits de Admin API (2 req/s) — aceptable porque cada redención es 1 request.

**Fase 6 — Cart real + checkout (frontend)**
- [ ] Instalar `shopify-buy` o armar cliente fetch contra Storefront API.
- [ ] Mapear productos: añadir `shopifyVariantId` a cada producto en `src/lib/shopMockData.js` (o mover a JSON generado por build step tras listar productos de Shopify).
- [ ] `src/lib/useShopCart.js::mockCheckout()` → `realCheckout()`: crea cart vía `cartCreate`, mete líneas con `cartLinesAdd`, aplica `cartDiscountCodesUpdate([activeDiscount.shopify_code])`, redirige a `cart.checkoutUrl`.
- [ ] Borrar `localStorage` del active discount al completar checkout (o al arrancar Shopify si el user vuelve y ya expiró).
- [ ] Price display: usar `product.priceRange` de Storefront como fuente de verdad, no el mock local — garantiza que la card muestra lo mismo que Shopify facturará.
- [ ] i18n de monedas: Shopify devuelve `amount + currencyCode`; adaptar `formatPrice` para respetarlo.

**Fase 7 — Admin UX del CMS (nice-to-have, tras fase 5)**
- [ ] En `CodesEditor.jsx` mostrar métricas Shopify por código: cuántos ephemeral codes se han minteado, cuántos expiraron sin uso, cuántos se canjearon en Shopify.
- [ ] Endpoint de revocación de códigos ya emitidos (`discountCodeDeactivate`) para casos de abuse.

### Decisiones ya tomadas (no re-debatir)

- **No stackeables**: un código por compra. Shopify lo enforcea por default; el frontend muestra confirm dialog al intentar reemplazar.
- **Rarity labels**: `common / rare / legendary` (ya decidido).
- **Gold skin permanente**: una vez desbloqueado persiste en `user_profiles.gold_skin=1`. El toggle en el portrait solo cambia la preferencia visual local.
- **Path de minteo**: Admin API efímeros, NO precreación estática. La razón: un código filtrado expira solo y no abre la puerta a uso masivo.

### Consideraciones / gotchas

- **Migración SQL destructiva**: `ALTER TABLE ... DROP COLUMN type` no es reversible. **Backup antes**.
- **Auth en `codes.php::handlePost`**: requiere auth admin. Si el Admin API de Shopify falla (rate limit, red), el POST del backend debe seguir creando el registro en DB pero marcar algún flag `shopify_sync=failed` para retry posterior.
- **User acceso anon**: hoy el validate permite email sin login. Cuando se mintea el shopify_code, no hay `user_id` necesariamente — pasarlo como guest al cart de Shopify es OK, pero `email` del code_redemptions sí debe viajar para que Shopify pueda hacer matching si el user se loggea luego en el checkout.

### Archivos tocados en esta sesión

- **Nuevos**: `scripts/migrate-cheat-codes-rarity.sql`, `src/lib/useActiveDiscount.js`, `src/components/SkinToggleButton.jsx`.
- **Modificados**: `scripts/create-cheat-codes.sql`, `public/api/codes.php`, `src/admin/CodesEditor.jsx`, `src/components/CheatTerminal.jsx`, `src/components/shop/ShopCart.jsx`, `src/game/useGoldSkinSystem.js`, `src/App.jsx`.



---

## ✅ Achievements persistentes en base de datos (implementado 2026-04-22)

**Contexto original**: el **portal antimateria (section6 — Runic Codex)** se desbloquea
cuando el player arroja un orb rojo. Antes: vivía en `sessionStorage.skulley_section6_unlocked`
y se perdía al cerrar sesión del navegador. Ahora es un **logro de vida** en DB por usuario autenticado.

### Lo que quedó hecho

- **`scripts/create-achievements.sql`** — tabla `user_achievements (user_id FK user_profiles, achievement_key, unlocked_at, metadata JSON, UNIQUE(user_id, achievement_key))`. Idempotente — se puede correr sobre DB existente.
- **`public/api/achievements.php`** — endpoints:
  - `GET  /achievements.php?action=list&pid=<privy_id>` → lista logros del user.
  - `POST /achievements.php?action=unlock` body `{privy_id, achievement_key, metadata?}` → INSERT IGNORE (idempotente). Rate-limited 30/60s.
  - `ensureAchievementsTable()` auto-crea la tabla en deploy fresco (patrón igual a `profile.php`).
- **`src/hooks/useAchievements.js`** — hook centralizado. API: `{ achievements, isLoaded, has(key), unlock(key, metadata?) }`.
  - Guests → sessionStorage (`skulley_achievements` como array).
  - Auth → backend source of truth.
  - **Migración anon→auth automática**: al loggear, los keys del sessionStorage guest se flushean al backend y se limpia el storage.
  - Compat con `skulley_section6_unlocked` legacy (se lee como seed y se migra).
- **`src/App.jsx`** — reemplazado `[section6Unlocked, setSection6Unlocked]` state + write manual a sessionStorage por `const section6Unlocked = hasAchievement('section6_unlocked')` + `unlockAchievement('section6_unlocked')` en `handleOfferingDelivered`.

### Cómo extender para futuros logros

Candidatos listados en HANDOFF original: `first_portal_crossed`, `sphere_game_master`,
`gold_skin_unlocked`, `runic_codex_visited`, `all_portals_crossed`.

Pattern: en el lugar donde se detecta el evento,
```js
const { unlock: unlockAchievement, has: hasAchievement } = useAchievements()
// ...
unlockAchievement('sphere_game_master', { score: 3500 })
```
`unlock` es idempotente — llamarlo múltiples veces no duplica. `has()` sirve para gating UI.

### Deploy — pasos a seguir en prod

1. Correr `scripts/create-achievements.sql` contra la DB de prod (o confiar en el auto-create de `ensureAchievementsTable`).
2. Subir `public/api/achievements.php` junto al resto del deploy.
3. El frontend ya sale en el próximo build — no hay flag de feature.

### Notas técnicas

- `FK user_profiles(id) ON DELETE CASCADE` — si borran un perfil, sus logros se van con él.
- `metadata` es `JSON NULL` — para payloads tipo `{score, tier, timestamp}`. Ver `profile.php::handleSaveScore` como ejemplo futuro de cómo enchufar `sphere_game_master` al save_score.
- Guest fallback usa sessionStorage (no localStorage) por consistencia con el flow original de section6. Cambiar a localStorage si queremos que los guests persistan cross-session.

---

## ✅ Button: variantes `terminal-action` + `terminal-outline` (implementado 2026-04-22)

HANDOFF §4.12 D quedó pendiente — se agregaron dos variantes al Button canónico para
el lenguaje "terminal-cyberpunk" de los hot sites.

### Lo que se hizo

- **`src/components/ui/Button.jsx`**: dos variantes nuevas + `TERMINAL_SIZES` scale.
  - `terminal-action` — filled CTA (`bg-blue-500 text-black border-2 border-blue-400 rounded` + glow box-shadow + `[text-shadow:none]`).
  - `terminal-outline` — outline variant (`border border-blue-700 bg-transparent text-blue-500`).
  - Tamaños `sm` (h-9 px-5), `md` (h-12 px-8), `lg` (h-12 px-10), todos `text-sm` monospace.
- **`GameOverModal.jsx`** — migrados los 2 botones (Exit → `terminal-outline`, Play Again → `terminal-action`).
- **`TutorialModal.jsx`** — migrado el botón Next/GotIt → `terminal-action size="sm"`.

### Por qué NO se migró

- **PreloaderContent.jsx (ENTER/SKIP)** — usa `rounded-full` (pill shape), híbrido pill+terminal. No matchea el lenguaje `rounded` square-corner de las variantes nuevas. Si se quiere unificar, agregar una 3ra variante `terminal-pill` o aceptar que el ENTER es un one-off de preloader.
- **ContactForm.jsx** — la "consola" en sí es terminal-style pero no tiene botones CTA que matcheen el patrón `> TEXT_` de los hot sites (usa inputs + Enter). Fuera de scope.

### Uso

```jsx
import Button from './ui/Button.jsx'

<Button variant="terminal-action" size="md" onClick={...}>
  {`> ${t('game.playAgain').toUpperCase()}_`}
</Button>

<Button variant="terminal-outline" size="md" onClick={...}>
  {`> ${t('game.exit').toUpperCase()}`}
</Button>
```

El prefijo `> TEXT_` es content, no style — el consumer lo compone. Las variantes bakean
mono/glow/rounded/border.

---

## ⚙ Shopify Fase 5 — scaffolding listo (2026-04-22)

Implementación **gated por env vars** — mergeable hoy sin tokens. Cuando el user
crea la Custom App en Shopify y puebla `SHOPIFY_ADMIN_TOKEN` + `SHOPIFY_SHOP_DOMAIN`,
el minteo se activa automáticamente sin cambios de código.

### Archivos nuevos

- **`public/api/shopify.php`** — clase helper `Shopify` con:
  - `Shopify::isConfigured()` — true si hay token + dominio en config.
  - `Shopify::mintDiscountCode($pct, $rarityLabel, $ttlMinutes=null)` — GraphQL `discountCodeBasicCreate`, usageLimit=1, TTL configurable, percentage off, applies to all items. Devuelve `{ok, skipped, shopify_code, expires_at, error}`.
  - Código efímero formato: `SKR-XXXXXXXX` (8 chars alpha-numericos sin 0/O/I/1).
  - Timeout cURL: 10s / connect 5s.
- **`scripts/add-shopify-cols-to-redemptions.sql`** — migration idempotente (MySQL 8+) que añade `shopify_code`, `shopify_code_expires_at`, `shopify_sync_status` a `code_redemptions`, + index sobre `shopify_code`.

### Archivos modificados

- **`public/api/config.local.example.php`** + **`public/api/config.php`** — keys nuevas: `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_API_VERSION` (default `2025-01`), `SHOPIFY_DISCOUNT_TTL_MIN` (default 60min, clamp 5..1440).
- **`public/api/codes.php::handleValidate`** — después del atomic check-and-increment del cheat code, llama a `Shopify::mintDiscountCode(...)`:
  - Si `skipped=true` (sin tokens): sigue como antes, response sin `shopify_code`.
  - Si `ok=true`: response incluye `shopify_code` + `shopify_code_expires_at`, y se loguean en `code_redemptions`.
  - Si `ok=false, skipped=false`: minteo falló — se marca `shopify_sync_status='failed'` en la redemption row para retry manual, pero **no se bloquea la redención** (cheat code queda consumido). Racional: no penalizar al user por fallo transitorio de Shopify.
  - **Compat con schema viejo**: el insert intenta primero con cols Shopify, y si falla retry sin esas cols. Permite deploy escalonado (código antes de migration).
- **`src/lib/useActiveDiscount.js`** — payload ampliado:
  - `shopify_code: string|null` — el código a enviar al cart real (Fase 6).
  - `shopifyExpiresAt: epoch-ms|null` — timestamp de expiración.
  - `parseShopifyExpiresAt()` acepta MySQL DATETIME UTC o ISO o epoch.
  - **Auto-expiration**: `readStored()` limpia el localStorage si `shopifyExpiresAt <= now`. Effect watchdog arma un `setTimeout` para limpiar-y-emitir cuando vence, para que la UI reaccione sin polling.

### Pendiente para activar (Fase 0 — fuera de código)

El scaffolding está inert hasta que:
1. Crear tienda Shopify (o dev store) y poblar productos.
2. Crear Custom App en Shopify Admin con scopes `write_discounts`, `read_products`, `read_customers` (opcional).
3. Copiar Admin API access token → `SHOPIFY_ADMIN_TOKEN` en `config.local.php` del servidor PHP. **NUNCA** al frontend.
4. Poner `SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com` (sin https://).
5. Correr `scripts/add-shopify-cols-to-redemptions.sql` contra prod DB.
6. (Opcional) Storefront API token público para Fase 6 (cart client-side).

### Pendiente (Fase 6 — cart real)

Con `shopify_code` ya trackeado en el payload del discount activo, el frontend queda listo para:
- `src/lib/useShopCart.js::mockCheckout()` → `realCheckout()`: `cartCreate` + `cartLinesAdd` + `cartDiscountCodesUpdate([active.shopify_code])` → redirect a `cart.checkoutUrl`.
- Mapear `shopifyVariantId` en cada producto (hoy está en `src/lib/shopMockData.js`).
- Borrar `localStorage` del active discount al completar checkout.

### Gotchas / decisiones

- **No guardar user_id opcional en el discount mint**: la mutation no lleva customer — Shopify aplica `customerSelection.all=true`. Cuando el user se loguea en el checkout, Shopify matchea por email, no por el cheat redemption.
- **Rate limit Admin API**: 2 req/s default. Cada redemption = 1 request. Aceptable.
- **Clock skew**: expiración timer tiene +250ms buffer. Si el user está 1+ min desfasado vs server, el código puede verse "válido" en frontend pero rechazado por Shopify. Aceptable.
- **Compat schema viejo**: el try/catch en el insert permite que codes.php funcione aunque la migration no se haya corrido todavía. Una vez corrida, todas las redemptions quedan con las cols pobladas.

---

---

## 🎫 Golden Ticket Flow (implementado 2026-04-22)

**Decisión del user**: el golden ticket (único código especial del sitio) se gana
**exclusivamente** jugando el minigame de esferas (score ≥ 3000). Es un código
dinámico/ephemeral — Shopify lo quema al primer uso (`usageLimit=1`).

El resto de códigos promocionales se manejan directamente en Shopify Admin — el
cheat terminal del frontend se eliminó.

### Arquitectura final

```
Player wins game (score ≥ 3000)
  └→ GameOverModal → userProfile.saveScore()
       └→ POST /api/profile.php?action=save_score
            ├→ UPDATE user_profiles SET golden_ticket=1, gold_skin=1
            └→ Shopify::mintDiscountCode(50, 'Golden Ticket', 0)
                 ├→ ok → UPDATE golden_ticket_shopify_code
                 └→ skipped/failed → se re-mintea en el próximo login (ver backfill)

Profile sync on login (useUserProfile)
  └→ App.jsx useEffect auto-apply
       └→ useActiveDiscount.apply({code:'GOLDEN_TICKET', shopify_code:'SKR-XXXX', pct:50})
            └→ ShopCart chip "CODE APPLIED — legendary" + 50% off

Checkout flow
  └→ ShopCart.handleCheckout
       └→ cart.createShopifyCheckout({discountCodes:[active.shopify_code]})
            └→ Shopify cartCreate con el SKR-XXXX real
                 └→ redirect a cart.checkoutUrl → Shopify enforcea usageLimit=1
                      └→ user paga, código queda marcado como usado en Shopify
                         (ticket_burned=1 requiere webhook para sincronizar — pendiente)
```

### Archivos nuevos

- **`scripts/add-golden-ticket-shopify.sql`** — agrega `golden_ticket_shopify_code VARCHAR(64)` + `golden_ticket_minted_at DATETIME` a `user_profiles` + index.

### Archivos modificados

- **`public/api/shopify.php`** — `mintDiscountCode($pct, $label, $ttlMinutes)` soporta **modo perpetuo** (ttl ≤ 0): el código no tiene `endsAt`, solo se retira via `usageLimit=1`. Ideal para el golden ticket que el user puede canjear cuando quiera.
- **`public/api/profile.php`**:
  - `handleSaveScore` — al cruzar el threshold, además de setear `golden_ticket=1`, llama a `Shopify::mintDiscountCode(50, 'Golden Ticket', 0)` y persiste el code. Devuelve `golden_ticket_minted: {shopify_code, discount_pct}` en el response si aplica.
  - `handleSync` — **backfill**: si el user tiene `golden_ticket=1` pero `golden_ticket_shopify_code` NULL (ej. porque el ticket se ganó antes de que Admin API estuviera configurada), se mintea en el próximo login. Idempotente.
  - `formatProfile` — expone `golden_ticket_shopify_code` y `golden_ticket_minted_at`.
  - Try/catch schema-compat para correr contra DB sin las cols nuevas.
- **`src/App.jsx`**:
  - **Cheat terminal REMOVIDO**: `CheatTerminal` import, `cheatTerminalOpen` state, handlers (`handleCheatCode`, `pendingCheatRef`), botón opener (top-right con `CommandLineIcon`), render del modal, `CommandLineIcon` del import de heroicons.
  - Nuevo effect: cuando `userProfile.profile.golden_ticket_shopify_code` aparece y no está burned, se auto-aplica a `useActiveDiscount` con payload sintético `{code:'GOLDEN_TICKET', pct:50, rarity:'legendary', action:'goldSkin', shopify_code}`. Idempotente.
  - `useActiveDiscount` ahora destructura `apply` + `active` (antes solo `replaceWithConfirm`).

### Archivos borrados

- **`src/components/CheatTerminal.jsx`** — componente ya no se importa en ningún lado.

### Lo que NO se tocó

- `public/api/codes.php` — sigue funcionando, admin puede ver redenciones legacy del `goldeneggs` original.
- `src/admin/CodesEditor.jsx` — editor CMS sigue ahí para histórico. No hay frontend que consuma los codes ahora.
- `useGoldSkinSystem.js` — la skin dorada sigue gateada al score ≥ 3000, independiente del ticket.
- `scripts/create-cheat-codes.sql`, `scripts/migrate-cheat-codes-rarity.sql` — los dejé por si querés seguir usando el CMS de códigos para tracking interno.

### Pendiente para activar en prod

1. **Shopify Admin API** — poner `SHOPIFY_ADMIN_TOKEN` + `SHOPIFY_SHOP_DOMAIN` en `config.local.php` del server. Sin eso, los tickets se otorgan pero sin `shopify_code` real (el user ve el flag del ticket pero no puede canjear hasta el backfill).
2. **Migrations SQL en orden**:
   - `scripts/create-achievements.sql`
   - `scripts/add-shopify-cols-to-redemptions.sql` *(ya no crítica, no hay cheat terminal)*
   - `scripts/add-golden-ticket-shopify.sql` ← esta es la nueva crítica
3. **Descuentos no-ticket** — crearlos directo en Shopify Admin → Discounts. Ej. codes de promo (BLACKFRIDAY50, etc.). El user los tipea en el checkout de Shopify, el sitio no los conoce.

### Gotchas

- **Ticket backfill**: si ya había users con `golden_ticket=1` pre-Admin-API, se les mintea al siguiente login automáticamente. No hay UI para "claim manual" — es transparente.
- **Burn detection**: Shopify enforcea `usageLimit=1` server-side, pero NO nos avisa cuando se usa. El `ticket_burned=1` sigue sin setearse hasta que implementemos un webhook listener (`orders/paid` o `discount_codes/update`). Mientras tanto: el user ve el ticket siempre en el cart chip aunque ya lo haya usado — Shopify lo rechaza al checkout pero el frontend no lo sabe. **Workaround UX**: detectar error de cart create ("discount code invalid") y clearear el activeDiscount + hacer POST para setear ticket_burned.
- **Re-intentos de mint**: si Shopify falla (rate limit, network), el flag `golden_ticket=1` queda seteado pero `golden_ticket_shopify_code=NULL`. El backfill en handleSync re-intenta en el próximo login. No se pierde nada.

---

## 📋 Checklist deployment post-sesión 2026-04-22

Para llevar esta sesión a prod, corré en orden:

1. **DB — migrations** (hacer backup antes de cada una):
   - `scripts/create-achievements.sql`
   - `scripts/add-golden-ticket-shopify.sql` ← **crítica** para que el golden ticket mintee
   - `scripts/add-shopify-cols-to-redemptions.sql` *(opcional — ya no hay cheat terminal)*
   - `scripts/migrate-cheat-codes-rarity.sql` *(opcional — admin puede seguir viendo códigos legacy sin esto)*
2. **Deploy backend**: subir `public/api/achievements.php`, `public/api/shopify.php`, `public/api/profile.php` (modificado con golden ticket mint + backfill), `public/api/codes.php` (modificado), `public/api/config.php` (modificado). El frontend rebuildeado ya funciona.
3. **Shopify Admin API tokens**: `SHOPIFY_ADMIN_TOKEN` + `SHOPIFY_SHOP_DOMAIN` en `config.local.php` del server. Sin eso, users que ganan el ticket quedan con el flag seteado pero sin shopify_code — el backfill re-intenta cada login.

---

## 🎯 Sesión 2026-04-22 (continuación) — Shopify end-to-end + UX golden ticket

Sesión intensa post-config-de-tokens. Puestos los Shopify Admin tokens en prod,
arranca el flow completo. Items cerrados:

### Shopify Admin API configurada en prod

- Custom App `apefur-store` configurada con scopes `write_discounts`, `read_discounts` (+ `write/read_orders`, `write/read_order_edits` pre-existentes).
- Token `shpat_...` pegado en `public/api/config.local.php` junto con `SHOPIFY_SHOP_DOMAIN=7xaqrq-7m.myshopify.com` y `SHOPIFY_API_VERSION=2025-01`.
- Endpoint de diagnóstico `shopify-test.php` creado y borrado — los 6 checks devolvieron `ok:true`, mint dry-run exitoso con `SKR-STF66KHF`.
- Mint real del golden ticket del user id=1 funcionando.

### Cambios de flow / arquitectura

**1. Golden Ticket 35% perpetuo** (cambiado de 50% + TTL 60min):
- `profile.php`: `GOLDEN_TICKET_DISCOUNT_PCT = 35`, `mintDiscountCode(pct, label, 0)` con `0` = modo perpetuo sin `endsAt`.
- `shopify.php::mintDiscountCode`: si `ttlMinutes ≤ 0`, el campo `endsAt` se omite en la GraphQL mutation — Shopify lo registra sin fecha de fin. Solo se retira via `usageLimit=1`.
- `App.jsx`: auto-apply effect usa `pct: 35` en el payload sintético.
- `GameOverModal.jsx`: tier legendary `discount: 35` (consistencia de UI).

**2. ShopCart fix crítico**:
- `ShopCart::handleCheckout` enviaba `activeDiscount.code` (cheat master `goldeneggs`) al checkout. Sin un discount estático creado manualmente en Shopify Admin con ese nombre, el chip se mostraba pero Shopify cobraba precio completo. **Fix**: ahora prioriza `activeDiscount.shopify_code` (ephemeral real `SKR-XXXXXXXX`) y cae al master como fallback.

**3. Descuento visible en cards de producto (no solo en cart)**:
- Nuevo hook `src/lib/usePriceWithDiscount.js` — lee `useActiveDiscount`, devuelve `{finalPrice, originalPrice, hasDiscount, pct}`. Aritmética en centavos para evitar drift en MXN.
- `ProductCard.jsx` — sub-componente `ProductCardPrice` aislado para evitar re-renders del card entero.
- `FeaturedArtifact.jsx` y `ProductInspectModal.jsx` — mismos cambios.
- Resultado: con golden ticket activo el user ve `~~$100~~ $65` en todo el shop grid + featured + inspect modal. El cart sidebar mantiene su summary footer (subtotal → savings → total).

**4. Cheat terminal REMOVIDO del frontend**:
- Decisión del user: golden ticket solo se gana jugando, resto de códigos se manejan directo en Shopify Admin.
- **Borrado**: `src/components/CheatTerminal.jsx`.
- **App.jsx**: quitado el import, state `cheatTerminalOpen`, handlers `handleCheatCode`/`pendingCheatRef`, botón opener con `CommandLineIcon`, render del modal. `CommandLineIcon` también sacado del import de heroicons.
- **Intacto**: `public/api/codes.php` + `src/admin/CodesEditor.jsx` para admin histórico.

**5. Golden Ticket Badge 3D (halo dorado arriba del retrato)**:
- Componente nuevo `src/components/GoldenTicketBadge.jsx` — lazy, portal a `document.body`, mide `[data-portrait-root]` cada frame (raf) igual que `ShopCart` y `SkinToggleButton`.
- Tamaño 110×64, posicionado 14px arriba del retrato.
- Condición de render en `App.jsx`: `userProfile.profile.golden_ticket_shopify_code && !ticket_burned`.
- Click → dispara custom event `shop-cart-open-request` → `ShopCart` listener abre el sidebar.
- **Diseño**: CSS 3D (`transform-style: preserve-3d` + doble face + `backface-visibility`). Clip-path con path SVG que corta semicírculos en los laterales (notches de ticket stub). Gradient metálico 9-stop (`#6b4a0a` bronze → `#f4d06a` gold → bronze) + sheen diagonal. Borde interno doble grabado. Typography serif Georgia: "GOLDEN / TICKET" front, "35%" back. Animación `goldenTicketSpin 4s linear infinite` con tilt `rotateX(-8deg)`. Respeta `prefers-reduced-motion`.

**6. Close button relocated**:
- Antes: `absolute -top-[56px] left-1/2` dentro de `CharacterPortrait` — colisionaba con el golden ticket.
- Ahora: sacado del portrait y movido a `App.jsx`, dentro del mismo wrapper `fixed top-0 left-0 right-0` con `translateY(marqueeHeight)` que tiene el top-right-group del login. El yellow ticker lo empuja igual que al login.
- Posición final: `absolute top-4 left-4 md:top-10 md:left-10` — mirror exacto del login.
- State `sectionCloseMode` + listener `portrait-exit-mode` movidos también a App.jsx. Mobile camera button gateado a `section === 'home'` para no colisionar.

**7. Section6 → SKULLEYGLYPH**:
- `sectionRouting.js`: `sectionSlug.section6 = 'skulleyglyph'`, `slugToSection.skulleyglyph = 'section6'`. `/section6` legacy también resuelve (fallback en `pathToSection`).
- Labels: `RUNIC CODEX` → `SKULLEYGLYPH` (nav), `THE RUNIC CODEX — A LANGUAGE OF THE PORTALS` → `SKULLEYGLYPH — A LANGUAGE OF THE PORTALS` (marquee).
- **Access gate triple capa** (todas sin data migration — id interno sigue siendo `section6`):
  1. Portal in-game: `handlePortalEnter` rechaza si `target === 'section6' && !section6Unlocked` (ya existía).
  2. Popstate: si el user hace back a `/skulleyglyph` sin achievement, redirige a home + `history.replaceState`.
  3. Mount directo: effect post-hidratación — si `achievementsLoaded && section === 'section6' && !section6Unlocked` → replaceState + `setSection('home')`. Espera la hidratación para no kickear auth users que están sincronizando.
- Internal id interno `section6` SE QUEDA — renombrarlo tocaba ~10 archivos (Portal, HomeOrbs, HomeScene, appHelpers, runes, etc.). Solo lo user-facing cambió.

**8. `npm run build:update` incluye TODO lo necesario**:
- Antes: `post-build.mjs` borraba `dist/api/config.local.php` como defensa (no pisar prod con stub). Consecuencia: el token Shopify nunca llegaba al server via build.
- Ahora: sanity check — valida que el archivo no sea un template (`TU_PASSWORD_AQUI`, `u123456789_`, etc.) y si está OK lo deja en el dist. Si es stub aborta el build con error.
- Consecuencia: subir `dist/` al server alcanza para deploy completo. Ya no hay que editar config manualmente en hPanel.

### Archivos nuevos/modificados esta subsesión

**Nuevos**:
- `src/lib/usePriceWithDiscount.js`
- `src/components/GoldenTicketBadge.jsx`
- `scripts/add-golden-ticket-shopify.sql` *(aplicada en prod)*

**Modificados**:
- `public/api/shopify.php` — modo perpetuo
- `public/api/profile.php` — mint en saveScore + backfill en handleSync + formatProfile expuesto
- `public/api/config.local.php` — 4 keys de Shopify
- `src/App.jsx` — auto-apply golden ticket, cheat terminal out, close button relocated, skulleyglyph rename + gate, GoldenTicketBadge wired
- `src/components/CharacterPortrait.jsx` — close button out
- `src/components/shop/ShopCart.jsx` — usa shopify_code en checkout, listener shop-cart-open-request
- `src/components/shop/ProductCard.jsx`, `FeaturedArtifact.jsx`, `ProductInspectModal.jsx` — usan usePriceWithDiscount
- `src/components/GameOverModal.jsx` — tier legendary 35%
- `src/lib/sectionRouting.js` — slug skulleyglyph
- `src/index.css` — CSS del Golden Ticket Badge (~120 líneas)
- `scripts/post-build.mjs` — sanity check de config.local.php

**Borrados**:
- `src/components/CheatTerminal.jsx`
- `public/api/shopify-test.php` *(diagnóstico temporal, ya no necesario)*
- `public/api/golden-ticket-debug.php` *(diagnóstico temporal, ya no necesario)*

### Burn detection — pendiente

El único gap conocido: cuando el user usa el ticket en Shopify checkout, Shopify enforcea `usageLimit=1` y rechaza el código en intentos subsecuentes, pero **nuestro backend no se entera**. El badge + chip siguen visibles hasta que se marque `ticket_burned=1` en DB.

Próximo paso lógico (no crítico):
- Webhook `public/api/shopify-webhook.php` para recibir `orders/paid` — parsear el payload, identificar el `SKR-XXXXXXXX` usado, setear `ticket_burned=1` en el user correspondiente.
- Alternativa MVP: al fallar `cartCreate` con error "discount code invalid", frontend detecta y dispara `POST /api/profile.php?action=burn_ticket` (endpoint nuevo) → backend marca `ticket_burned=1`.

### Próximo paso sugerido

Con todo el flow cerrado y deployeado, los items pendientes del handoff que mueven aguja:
- Consolidación de transiciones (grid/simple/ripple detrás de `<SceneTransition>`).
- Fase 7 admin UX — métricas Shopify en CodesEditor (ephemeral codes minteados, quemados, etc.).
- Character controller unificado.
- Modo "skip 3D" + i18n audit.
- Webhook burn detection (para cerrar el loop).

