# HANDOFF — Skulley Rad Portfolio

Documento de estado para retomar el trabajo desde otro equipo. Refleja la sesión del **2026-04-15**.

---

## TL;DR

- ✅ **Sistema de diseño bootstrappeado** → `DESIGN.md` + `tailwind.config.js` + `src/components/ui/Button.jsx`.
- ✅ **Scratch del MusicPlayer reconstruido** con AudioWorklet — ahora sample-accurate, sin clicks, con inercia real.
- ✅ **Lazy-load agresivo del vendor** — eager payload bajó de **2156 kB gzip → 1128 kB gzip (−48%)**.
- ⏭ **Próximo recomendado**: A.2 — romper `App.jsx` (227 KB monolítico) ó A.3 — first paint con HTML estático.

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

- `src/lib/ReversibleAudioBufferSourceNode.js` — reemplazado completamente por `ScratchAudioNode`. Sin imports vivos.

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

*Última actualización: 2026-04-15. Siguiente sesión: retomar con A.2 (App.jsx split) tras commit del checkpoint.*
