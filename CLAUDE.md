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
- `admin/` — CMS interno para editar contenido del sitio.

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

## No hacer

- No commit automático — solo commitear cuando el usuario lo pida.
- No regenerar `public/songs/songs.json` manualmente — corre `npm run gen:songs`.
- No tocar `directives/` ni `execution/` sin pedir (ver AGENTS.md).
- No sustituir estilos CSS existentes por Tailwind inline — la mayoría del styling complejo está en `index.css` por razones de performance y reutilización.
