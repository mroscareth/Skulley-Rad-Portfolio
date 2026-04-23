# CLAUDE.md — SkulleyRad Website

Instrucciones para Claude cuando trabaja en este repositorio.

## Proyecto

**SkulleyRad / mroscar.xyz** — portafolio interactivo 3D construido como "mausoleo digital". React 19 + Vite 7 + Three.js (via `@react-three/fiber`) + Tailwind 4.

- **Entry**: `src/main.jsx` → `src/App.jsx` (orquestador monolítico, ~4000 líneas)
- **Assets**: `public/` (HDRI, GLB de personaje, `songs/*.mp3`, covers)
- **Build**: `npm run dev` / `npm run build` (Node ^20.19.0 o >=22.12.0)

Ver `README.md` para tech stack completo y `AGENTS.md` para la arquitectura 3-layer (directives/orchestration/execution).

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
