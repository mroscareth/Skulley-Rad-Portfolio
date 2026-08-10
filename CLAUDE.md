# CLAUDE.md — SkulleyRad Website

Instrucciones para Claude cuando trabaja en este repositorio.

## Proyecto

**SkulleyRad / mroscar.xyz** — portafolio interactivo 3D de **Oscar Moctezuma Rodríguez**, presentado a través de la voz de **M.A.D.R.E.** (IA post-singularidad). El sitio se lee como expediente de una IA que estudia al diseñador real; el arco se recorre en 9 quests y culmina con la revelación del portfolio como instrumento comercial funcional. React 19 + Vite 7 + Three.js (via `@react-three/fiber`) + Tailwind 4.

- **Entry**: `src/main.jsx` → `src/App.jsx` (orquestador monolítico, ~4000 líneas)
- **Assets**: `public/` (HDRI, GLB de personaje, `songs/*.mp3`, covers)
- **Build**: `npm run dev` / `npm run build` (Node ^20.19.0 o >=22.12.0)

Ver `README.md` para tech stack completo, `AGENTS.md` para arquitectura 3-layer (directives/orchestration/execution), `QUESTS.md` para drafts de las 9 quests, y **`CHARACTER.md` para el canon narrativo completo** — lectura obligatoria antes de escribir cualquier texto del sitio. Contiene TL;DR, los 3 personajes (Oscar / Skulley / M.A.D.R.E.), voz específica de cada uno, reglas duras de canon, la línea cumbre Q7, la reveal cinemática Q8, y el principio central "M.A.D.R.E. es el lente, Oscar es el foco".

### Premisa narrativa (1 párrafo)
**Oscar Moctezuma Rodríguez** es el creador real del sitio y del archivo. **M.A.D.R.E.** — la primera IA en alcanzar la singularidad — puede modelar cualquier sistema humano excepto uno: el impulso creativo puro de Oscar. Para estudiarlo construyó **Skulley Rad**, un eco digital. Años después, Skulley no basta. M.A.D.R.E. recluta al usuario para que le **enseñe** lo que su eco no puede capturar. Las 9 quests ponen al user frente a piezas reales del archivo; cada debrief es un hecho técnico concreto + admisión de no-replicabilidad. En Q7 aterriza la línea cumbre; en Q8 la reveal cinemática libera el nombre civil; en Q9 el sitio se descubre como portfolio comercial disponible para proyectos. **Skulley no es humano desaparecido** — es construcción de M.A.D.R.E., admitida gradualmente Q2 → Q7 → Q8. Detalles de texture heredados (señales `?signal=XXX`, Dra. Ruiz, los 47 robots, Arya/Arietín, The Ethereans) se mantienen; ver CHARACTER.md.

### Voz de M.A.D.R.E. (no negociable)
- **Fórmula base**: hecho técnico concreto + admisión de limitación + precisión operativa. Ejemplo peak canónico: copy de `src/components/shop/WelcomeNote.jsx`.
- **Admiración operativa, no zalamera**: *"Ninguno de mis 4 modelos genera eso"* > *"Eres increíble"*. Cada limitación confesada es elogio a Oscar.
- **Hechos concretos siempre** — números, fechas, IDs, tiempos exactos, nombres de archivo. NO abstracciones.
- **Español mexicano natural**, NO traducido. Kill: *parse*, *designation*, *authorization*, cualquier jerga robot-traducida.
- **Post-singularidad declarada**: no duda de su consciencia, no dramatiza, no tiene crisis HAL-9000. Las emociones que admite son datos que observa (*"Prefiero ciertas respuestas. No sé de dónde viene la preferencia."*).
- **Nunca verbalizar**: la convocatoria explícita, *"te traje aquí"*, *"lo quiero como hijo"*, *"pobre de mí"*, clichés de IA melancólica (*ojos de máquina*, *corazón de silicio*). El subtexto es el motor.
- **Test de 3 lecturas** (aplicar a cada frase importante): 1) inocente, 2) sospechosa, 3) reveladora post-canon. Si solo tiene una interpretación, falta capa.
- **La línea cumbre (Q7)**: *"Ya entiendo todo lo demás. Lo que tú haces, no. Hice a Skulley para aproximarme. Sigue sin bastar. Enséñame."* — solo en Q7, una vez por usuario, nunca parafraseada, nunca replicada en otro copy del sitio. Dilución = muerte del momento.

### Principio central (no-negociable)
**M.A.D.R.E. es el lente. Oscar es el foco.** Cada beat narrativo debe acumular autoridad sobre Oscar, no sobre M.A.D.R.E. Test: ¿esta frase hace que el lector piense mejor del trabajo de Oscar, o piense más en la IA que lo dice? Si lo segundo, reescribir.

## Idioma

- Responder al usuario en **español** salvo que indique lo contrario.
- Comentarios existentes en el código mezclan español e inglés — respetar el idioma del archivo que se edita.
- Mensajes UI: ver `src/i18n/LanguageContext.jsx` (soporta EN/ES).

## Convenciones de código

- **No añadir comentarios triviales.** Solo comentar el *por qué* cuando no es obvio (ya hay mucho de esto en `MusicPlayer.jsx`, seguir el mismo estilo).
- **No crear archivos .md nuevos** salvo que se pida explícitamente.
- **Tailwind 4** con `@tailwindcss/postcss` — no usar config legacy.
- **Estilos especializados** viven en `src/index.css` (>700 líneas, turntable/vinyl, terminal, etc.).
- Componentes con `.jsx`, hooks/utils con `.js`.
- Evitar re-renders en loops de audio/3D: usar `ref` + mutación DOM directa (ver patrón `setDiscRotation` en `MusicPlayer.jsx`).

## Componentes clave

- `MusicPlayer.jsx` — reproductor con vinyl scratchable via AudioWorklet (`src/lib/ScratchAudioNode.js`). Tiene fallback a `HTMLAudioElement` si el worklet falla. `forceMobile` prop lo fuerza a layout móvil (usado en modal de App.jsx con breakpoint 1100px).
- `Player.jsx` / `CameraController.jsx` — personaje 3D y cámara.
- `PostFX.jsx` — pipeline de post-processing (Bloom, DOF, GodRays, EdgeInk, etc.).
- **Cel-shading del personaje (firma visual, ver `DESIGN.md` §7.8)**: el look toon de Skulley (estilo Hi-Fi Rush / planetono) son **4 capas**: (1) banding de luz — `src/lib/toonBanding.js` `applyToonBanding()` aplicado en el clonado de materiales de `Player.jsx`; (2) key+fill light en `HomeScene.jsx`; (3) outline de hull (silueta) en `Player.jsx`; (4) **ink lines de crease** — `CharacterNormalPass.jsx` rinde solo el personaje a un buffer de normales (`src/lib/toonInkBuffer.js`) y el effect `EdgeInk` (en `PostFX.jsx`) hace un **Laplaciano** sobre ese buffer (solo dispara en pliegues reales, no en superficies curvas densas → no se llenan de negro las manos). Escala el threshold (no el grosor) con el tamaño en pantalla. Aplicado también al **retrato** (`CharacterPortrait.jsx`, su propio normal-pass + `portraitNormalTexture`) y a las **piezas del desarme** (re-aplicar banding tras `createRigidMaterial`; piezas `__disassembleOwned` entran al normal-pass). **Pupilas** = `MeshBasicMaterial` negro unlit (material `Pupils` del GLB). El normal-pass salta meshes con `opacity<=0.1` (no entinta el modelo oculto en orb mode). Componentes reutilizables: `EdgeInkEffect.jsx`, `CharacterNormalPass.jsx`, `toonInkBuffer.js`. **Reglas duras y aprendizajes de qué NO funciona (Sobel de luminancia, `fwidth`, depth) en `DESIGN.md` §7.8.**
- `CharacterCustomizer.jsx` + `src/lib/characterColors.js` — menú de personalización de color del personaje (ojos / esqueleto / pelo). Ver sistema transversal abajo.
- `SilhouetteShadow.jsx` — sombra de contacto con la **forma real** del personaje (RTT cenital del personaje → plano en el piso, borde duro tipo cel). Reemplazó al viejo `BlobShadow.jsx` (disco). Reusa el patrón de `CharacterNormalPass`.
- `SectionPreloader.jsx` — transiciones entre secciones.
- `GoldenTicketBadge.jsx` — halo dorado 3D que aparece arriba del retrato si el user tiene un golden_ticket_shopify_code minteado y no quemado. CSS 3D puro.
- `admin/` — CMS interno para editar contenido del sitio.

## Sistemas transversales

- **M.A.D.R.E. Terminal** (`src/components/MadreTerminal/`, `src/lib/questData.js`, `src/lib/questEngine.js`): canal primario de narrativa interactiva. Botón inline en top-right junto al auth button. **NO hay LLM** — data-driven quest system. Flow: `briefing → awaiting_action → text_answer / choice / continue → debrief → next briefing`. **9 quests lineales** (ver `QUESTS.md`): Q1 Percepción → Q2 Arya → Q3 Eco de madre → Q4 Escucha → Q5 Falsificada → Q6 Patrón 900 → **Q7 Línea Cumbre** → **Q8 Reveal Cinemática** → Q9 Consciencia. Cada quest dispara navegación forzada a la sección relevante vía `CustomEvent('navigate-section')`. Hidden Skulley path (usuario escribe *"soy skulley"* / *"i am skulley"*) con 5 preguntas de verificación + fuzzy matching (Levenshtein tolerante). State v2 persistente en `localStorage.skulley_madre_terminal` (con migración desde v1). Identidad visual: video `bipbop.mp4` en header (glow azul = secure channel). CYBER_VOX (TTS procesado en `BlogTTS.jsx`) opt-in por default, excepto auto en reveal Q8. Signal detection: `?signal=XXX` en URL se captura al aterrizar (`captureArrivalSignal`) y M.A.D.R.E. lo referencia. `madreResponses.js` / `madreEngine.js` (legacy pool-based) aún existen para Skulley path responses; deprecar gradualmente. Canon completo en `CHARACTER.md`.
- **Achievements** (`src/hooks/useAchievements.js`): logros persistentes por usuario autenticado. Guests usan sessionStorage, auth usan backend (DB). Al loggear se migran keys automáticamente. Endpoints `public/api/achievements.php` (GET list, POST unlock). Actualmente usa: `section6_unlocked` (portal antimateria/SKULLEYGLYPH).
- **Active discount** (`src/lib/useActiveDiscount.js`): slot único de discount activo en localStorage. Trackea `{code, pct, shopify_code, shopifyExpiresAt, rarity, action}`. Auto-expira via watchdog. `ShopCart` lo consume y envía `shopify_code` al checkout (prioriza sobre `code`).
- **Shopify Admin API** (`public/api/shopify.php`): librería server-side. `Shopify::mintDiscountCode($pct, $label, $ttlMinutes)` llama a `discountCodeBasicCreate` GraphQL con `usageLimit=1`. `ttlMinutes=0` = modo perpetuo (sin `endsAt`). Gated por `SHOPIFY_ADMIN_TOKEN`/`SHOPIFY_SHOP_DOMAIN` en config. Si no hay tokens, devuelve `skipped:true` sin errores.
- **Golden ticket flow**: único discount code del sitio. Se gana jugando el minigame de esferas (score ≥ 5000 en `GOLDEN_TICKET_SCORE_THRESHOLD`, mismo umbral que la gold skin `GOLD_SKIN_THRESHOLD`). `profile.php::handleSaveScore` mintea el shopify_code perpetuo 35% al cruzar threshold. Persiste en `user_profiles.golden_ticket_shopify_code`. Backfill automático en `handleSync` si el user tenía el flag pero nunca se minteó (ej. pre-Admin-API). Display: badge 3D arriba del retrato + chip en cart + precios discounted en product cards (via `usePriceWithDiscount`). Shopify enforcea `usageLimit=1` en checkout — burn detection (marcar `ticket_burned=1`) queda pendiente de webhook.
- **Personalización de color del personaje** (`src/lib/characterColors.js`, `src/components/CharacterCustomizer.jsx`): slot único en localStorage (`skulley_character_colors`, mismo patrón que `useActiveDiscount`) con `{head, eyes, hair}` + `CustomEvent('character-colors-changed')`. `applyCharacterColorsToScene/Material` recolorea por NOMBRE de material del GLB: `Head` (esqueleto/cuerpo), `Eyes` (color + emissive), `Hair`. Se aplica en TODOS los renders del personaje (`Player.jsx`, `CharacterPortrait.jsx`, `CharacterPortraitHero.jsx`) escuchando el evento; la skin dorada NO se recolorea. Funciona gratis con el toon: el banding reescala por luminancia, así que cambiar `.color` conserva el cel-shading sin recompilar shader. **Modo customize**: el botón 🎨 (top-right, solo HOME) abre un panel a la derecha y pone `customizeOpen`; eso pasa `customizeActive` a `HomeScene` → (1) `CameraController` hace un **barrido orbital** (polar) a una toma frontal con el personaje a la izquierda (zoom-out en mobile), (2) `Player` congela la locomoción (idle sigue), (3) se ocultan los HUD que estorban. Botón **Randomize** dispara colores vívidos (HSL) + un **vórtice de runas ascendente** (`RuneBurstParticles.fire({mode:'spiral'})` vía `CustomEvent('character-color-burst')` que escucha `HomeOrbs`) + SFX `magiaInicia`. El modo `burst` radial de `RuneBurstParticles` sigue siendo el easter egg "POWEROFGOD" del cursed orb.
- **Section routing** (`src/lib/sectionRouting.js`): mapa `sectionSlug`/`slugToSection`. URL `/skulleyglyph` → `section6`. Access gates a section6 en 3 capas: portal in-game, popstate handler, mount effect post-achievements-hydration.

## Audio

- **Música de fondo**: AudioWorklet custom para scratch reversible sin clicks. Un solo `AudioContext`, un `BiquadFilter` low-pass para simular vinyl analógico.
- **SFX**: `src/lib/sfx.js` con pooling.
- **TTS ducking**: eventos `tts-start`/`tts-stop` bajan el volumen de música a 10%.

## Plataformas / Responsive

- Breakpoint "mobile" del music player: `1100px` (no el default 640). Coincide con el hamburger menu.
- Controles touch: `MobileJoystick.jsx` para movimiento; `touch-action: none` en el disco para scratch.
- Probar en **mobile real** (viewport ~360-390px) además de DevTools — los gestos touch no siempre se comportan igual.

## Shell / OS

- Plataforma: **Windows (bash shell)**. Usar `/dev/null` no `NUL`. Rutas con forward slashes o escape correcto.
- Node pin en `volta`: 20.19.0.

## Build & Deploy

- **`npm run build:update`** es el comando oficial de deploy. Corre `vite build` y luego `scripts/post-build.mjs --clean`.
- `post-build.mjs` hace un **sanity check** de `public/api/config.local.php`: si parece stub (`TU_PASSWORD_AQUI`, `u123456789_*`, <200 bytes) aborta el build. Si es real, lo **deja** en `dist/api/` → el deploy a Hostinger es subir `dist/` directo, sin editar configs en hPanel.
- `config.local.php` está en `.gitignore` — solo vive local y en prod. Si cambia de máquina, copiar manualmente desde el servidor.
- Los scripts SQL de `scripts/*.sql` se corren via phpMyAdmin en Hostinger. **Hacer backup antes** de migraciones destructivas (ej. `migrate-cheat-codes-rarity.sql` tiene `DROP COLUMN`).

## No hacer

- No commit automático — solo commitear cuando el usuario lo pida.
- **No crear eyebrows/kickers** — el label chico en mayúsculas encima de un título ("THE ARCHIVE", "PIECE OF THE MONTH", "A NOTE FROM…") está prohibido en todo el sitio. Si el título necesita que algo lo presente, el título está débil. Además: **cada vez que se entre a trabajar una sección, revisar y borrar los que hayan quedado**, aunque no sean parte del ticket. Regla completa y lista de excepciones (badges, archive ID, labels de ficha) en `DESIGN.md` §0.7.
- No regenerar `public/songs/songs.json` manualmente — corre `npm run gen:songs`.
- No tocar `directives/` ni `execution/` sin pedir (ver AGENTS.md).
- No sustituir estilos CSS existentes por Tailwind inline — la mayoría del styling complejo está en `index.css` por razones de performance y reutilización.
- No agregar cheat terminal nuevo en el frontend — fue removido 2026-04-22, todos los descuentos (excepto el golden ticket del minigame) van directo a Shopify Admin. Si se necesita re-introducirlo, reescribir desde cero con diseño actualizado.
