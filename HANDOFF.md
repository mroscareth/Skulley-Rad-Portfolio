# HANDOFF — Skulley Rad Portfolio

Documento de estado para retomar el trabajo desde otro equipo. Última sesión **2026-04-16**.

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

