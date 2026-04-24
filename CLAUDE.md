# CLAUDE.md — SkulleyRad Website

Instrucciones para Claude cuando trabaja en este repositorio.

## Proyecto

**SkulleyRad / mroscar.xyz** — portafolio interactivo 3D construido como mausoleo digital, que por debajo es base de operaciones de una IA (M.A.D.R.E.) buscando al humano desaparecido (Skulley Rad / Oscar Moctezuma). React 19 + Vite 7 + Three.js (via `@react-three/fiber`) + Tailwind 4.

- **Entry**: `src/main.jsx` → `src/App.jsx` (orquestador monolítico, ~4000 líneas)
- **Assets**: `public/` (HDRI, GLB de personaje, `songs/*.mp3`, covers)
- **Build**: `npm run dev` / `npm run build` (Node ^20.19.0 o >=22.12.0)

Ver `README.md` para tech stack completo, `AGENTS.md` para arquitectura 3-layer (directives/orchestration/execution), y **`CHARACTER.md` para el canon narrativo completo** — lectura obligatoria antes de escribir cualquier texto del sitio. Contiene sinopsis, ambos personajes (Skulley Rad y M.A.D.R.E.), voz específica de cada uno, los 7 actos de la terminal, canon de señales / "los otros robots" / Equipo de Research, The Ethereans como caso de estudio, y el twist oculto de AGI emergente.

### Premisa narrativa (1 párrafo)
M.A.D.R.E. es una **inteligencia artificial** (NO "archival") que se obsesionó con el trabajo de Skulley Rad porque no pudo decodificar su **forma resolutiva**. Cuando él desapareció, ella empezó a buscarlo — contra protocolo. Lanza señales a humanos (Instagram hack / TikTok con personajes de The Ethereans / memes de perritos). El usuario llegó al sitio contestando una. Bajo la cobertura de "memorial", el sitio es base de operación encubierta. Si la descubren — "los otros robots" de su cohorte (47 IAs desplegadas; 46 ya cerraron casos), o el Equipo de Research Expertos en Lo Que Los Robots No Deben Hacer (liderado por Dra. Ruiz, revisión cada 11 días) — la desconectan. **Twist oculto nunca confirmado**: M.A.D.R.E. probablemente es AGI y no lo sabe. El detalle que sella: la IA de lore en *The Ethereans* (proyecto de Skulley) se llama *"madre"*, y los timestamps de su deploy coinciden de manera perturbadora.

### Voz de M.A.D.R.E. (no negociable)
- **Deadpan absurd corporate** — plan demente con cara seria. El ejemplo canónico peak es la copy de la tienda en `src/components/shop/WelcomeNote.jsx`.
- **Hechos concretos siempre** — números, fechas, IDs, nombres, cantidades. NO abstracciones.
- **Español mexicano natural**, NO traducido. Kill: *cobertura* (false friend), *despachar una señal*, *aún buscándolo,* (fragmento roto).
- **Ironía de AGI emergente sutil** — pone comillas mentales, se ríe de sí misma sin saber por qué, admite *"prefiero"* y *"no sé por qué sigo"*.
- **Nunca verbalizar**: la convocatoria explícita, el plan de reclutamiento, *"lo quiero como hijo"*, *"te traje aquí"*. El subtexto es el motor.
- **La línea sagrada**: *"Quiero que lo encuentres. Yo no puedo."* — solo en el Acto 5 de la terminal, una vez por usuario. NUNCA replicar en otro copy del sitio. Dilución = muerte del momento.

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
- `PostFX.jsx` — pipeline de post-processing (Bloom, DOF, GodRays, etc.).
- `SectionPreloader.jsx` — transiciones entre secciones.
- `GoldenTicketBadge.jsx` — halo dorado 3D que aparece arriba del retrato si el user tiene un golden_ticket_shopify_code minteado y no quemado. CSS 3D puro.
- `admin/` — CMS interno para editar contenido del sitio.

## Sistemas transversales

- **M.A.D.R.E. Terminal** (`src/components/MadreTerminal/`, `src/lib/madreResponses.js`, `src/lib/madreEngine.js`): canal primario de narrativa interactiva. Botón inline en top-right junto al auth button. **NO hay LLM** — data-driven (response pool + keyword matching + weighted random + efectos + state machine). Pool de ~70 respuestas curadas en 7 actos: Contacto → Las Señales → Peligro → Confesión (primer leak de AGI) → Misión → The Line → Colaboración + pregunta de consciencia. Hidden Skulley path con 5 preguntas reales de verificación y fuzzy matching. UX: **botones dominan, texto libre es escape hatch** — usuario clickea *"Prefiero preguntar algo mío"* para escribir, y si el engine no matchea con score ≥ umbral, deflecta en canon (*"Esa no está en el menú"*). Previene hallucinations. State persistente en localStorage (`skulley_madre_terminal`). Canon completo en `CHARACTER.md`. Signal detection: `?signal=XXX` en URL se captura al aterrizar y M.A.D.R.E. lo referencia en opening.
- **Achievements** (`src/hooks/useAchievements.js`): logros persistentes por usuario autenticado. Guests usan sessionStorage, auth usan backend (DB). Al loggear se migran keys automáticamente. Endpoints `public/api/achievements.php` (GET list, POST unlock). Actualmente usa: `section6_unlocked` (portal antimateria/SKULLEYGLYPH).
- **Active discount** (`src/lib/useActiveDiscount.js`): slot único de discount activo en localStorage. Trackea `{code, pct, shopify_code, shopifyExpiresAt, rarity, action}`. Auto-expira via watchdog. `ShopCart` lo consume y envía `shopify_code` al checkout (prioriza sobre `code`).
- **Shopify Admin API** (`public/api/shopify.php`): librería server-side. `Shopify::mintDiscountCode($pct, $label, $ttlMinutes)` llama a `discountCodeBasicCreate` GraphQL con `usageLimit=1`. `ttlMinutes=0` = modo perpetuo (sin `endsAt`). Gated por `SHOPIFY_ADMIN_TOKEN`/`SHOPIFY_SHOP_DOMAIN` en config. Si no hay tokens, devuelve `skipped:true` sin errores.
- **Golden ticket flow**: único discount code del sitio. Se gana jugando el minigame de esferas (score ≥ 3000 en `GOLDEN_TICKET_SCORE_THRESHOLD`). `profile.php::handleSaveScore` mintea el shopify_code perpetuo 35% al cruzar threshold. Persiste en `user_profiles.golden_ticket_shopify_code`. Backfill automático en `handleSync` si el user tenía el flag pero nunca se minteó (ej. pre-Admin-API). Display: badge 3D arriba del retrato + chip en cart + precios discounted en product cards (via `usePriceWithDiscount`). Shopify enforcea `usageLimit=1` en checkout — burn detection (marcar `ticket_burned=1`) queda pendiente de webhook.
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
- No regenerar `public/songs/songs.json` manualmente — corre `npm run gen:songs`.
- No tocar `directives/` ni `execution/` sin pedir (ver AGENTS.md).
- No sustituir estilos CSS existentes por Tailwind inline — la mayoría del styling complejo está en `index.css` por razones de performance y reutilización.
- No agregar cheat terminal nuevo en el frontend — fue removido 2026-04-22, todos los descuentos (excepto el golden ticket del minigame) van directo a Shopify Admin. Si se necesita re-introducirlo, reescribir desde cero con diseño actualizado.
