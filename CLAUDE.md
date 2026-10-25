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
- **Física de las esferas** (`src/lib/orbPhysics.js`): constantes (`ORB_PHYS`), impulso de la patada (`kickContact`, tipo billar: el pie viaja por la línea de puntería y la esfera sale por la normal de contacto), choque entre esferas (`resolveOrbHit`, restitución 0.92, masa ∝ radio^1.5, anti-túnel con `sweptContactT`) y la simulación `simulateOrbPath`. La usan el paso real de `HomeOrbs` y la predicción `HomeOrbs.predictKick`, que dibuja `fx/KickTrajectory.jsx` mientras cargas: enseña solo los próximos 1.2 s (`HORIZON`, la perilla de dificultad), marca una caída solo si la esfera de verdad voló (sube más de 0.3 u) y el choque con aro fantasma si pasa dentro del horizonte. Se prueba en Node sin navegador.
- `SilhouetteShadow.jsx` — sombra de contacto con la **forma real** del personaje (RTT cenital del personaje → plano en el piso, borde duro tipo cel). Reemplazó al viejo `BlobShadow.jsx` (disco). Reusa el patrón de `CharacterNormalPass`.
- `SectionPreloader.jsx` — transiciones entre secciones.
- `GoldenTicketBadge.jsx` — halo dorado 3D (CSS 3D puro) para el golden ticket. Hoy no se monta: el estado del ticket vive en el carrito y en Mi Cuenta.
- `admin/` — CMS interno para editar contenido del sitio. **Sistema visual propio en `src/admin/admin.css`** (tokens `--a-*`, clases `a-*`; DESIGN.md §15): mismo lenguaje editorial + toon que la Store, sin estética de terminal (nada de CRT, glow, monoespaciada, prompts `>`/`//` ni `snake_case`). UI del CMS en **español mexicano** (DESIGN.md §15.6, glosario), Sentence case; tarjetas con la anatomía de la tienda (§15.5).

## Sistemas transversales

- **M.A.D.R.E. Terminal** (`src/components/MadreTerminal/`, `src/lib/questData.js`, `src/lib/questEngine.js`): canal primario de narrativa interactiva. Botón inline en top-right junto al auth button. **NO hay LLM** — data-driven quest system. Flow: `briefing → awaiting_action → text_answer / choice / continue → debrief → next briefing`. **9 quests lineales** (ver `QUESTS.md`): Q1 Percepción → Q2 Arya → Q3 Eco de madre → Q4 Escucha → Q5 Falsificada → Q6 Patrón 900 → **Q7 Línea Cumbre** → **Q8 Reveal Cinemática** → Q9 Consciencia. Cada quest dispara navegación forzada a la sección relevante vía `CustomEvent('navigate-section')`. Hidden Skulley path (usuario escribe *"soy skulley"* / *"i am skulley"*) con 5 preguntas de verificación + fuzzy matching (Levenshtein tolerante). State v2 persistente en `localStorage.skulley_madre_terminal` (con migración desde v1). Identidad visual: video `bipbop.mp4` en header (glow azul = secure channel). CYBER_VOX (TTS procesado en `BlogTTS.jsx`) opt-in por default, excepto auto en reveal Q8. Signal detection: `?signal=XXX` en URL se captura al aterrizar (`captureArrivalSignal`) y M.A.D.R.E. lo referencia. `madreResponses.js` / `madreEngine.js` (legacy pool-based) aún existen para Skulley path responses; deprecar gradualmente. Canon completo en `CHARACTER.md`.
- **Achievements** (`src/hooks/useAchievements.js`): logros persistentes por usuario autenticado. Guests usan sessionStorage, auth usan backend (DB). Al loggear se migran keys automáticamente. Endpoints `public/api/achievements.php` (GET list, POST unlock). Actualmente usa: `section6_unlocked` (portal antimateria/SKULLEYGLYPH).
- **Active discount** (`src/lib/useActiveDiscount.js`): slot único **en memoria** (no localStorage) que refleja en la UI si el golden ticket va en esta compra (`{code, pct, label, rarity, action}`). Cada carga arranca sin descuento; solo App.jsx lo enciende cuando el perfil del servidor confirma un ticket vivo, y lo apaga sin sesión. Persistirlo mostraba precios rebajados a visitantes sin sesión en un navegador donde alguien había entrado con ticket. Quitarlo del carrito lo "guarda para después" (`skulleyGoldenTicketSaved`, eso sí en localStorage: solo apaga, nunca enciende) y App.jsx deja de auto-aplicarlo. El descuento real lo decide el backend.
- **Tienda (Stripe + MySQL)** — Shopify se eliminó por completo (2026-10-20). MySQL es la fuente de verdad del catálogo y los pedidos; Stripe solo cobra (Checkout hospedado, precios inline por sesión, nada que sincronizar).
  - Backend: `shop-lib.php` (esquema auto-creado, stock, `markPaid`/`release`), `stripe.php` (cliente cURL sin SDK + firma de webhook), `shop.php` (catálogo público), `shop-checkout.php` (valida stock/precios en servidor y aparta), `shop-webhook.php` (única fuente de verdad del pago), `shop-orders.php` (cliente por token + gestión admin), `shop-admin.php` (CRUD), `shop-download.php` (digitales), `shop-mailer.php` (correos). Llaves: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` en `config.local.php` (local: `.env` → docker-compose).
  - **Stock = estante − apartado**: un pedido `pending`/`awaiting_payment` vigente aparta sus unidades; así una pieza 1/1 no se puede pagar dos veces. Ediciones: `unique` (1/1, sin opciones), `limited` (tiraje), `open`. Stock `NULL` = sin límite.
  - **Regiones** (`shop_zones`, editables en el CMS): México→MXN, USA→USD, Latinoamérica→USD. La región elige moneda y destino de envío; productos sin precio en esa moneda no se muestran ahí. Cada variante tiene `price_mxn` y `price_usd` propios.
  - **Digitales**: archivos fuera del document root (`Shop::privateDir`), links con caducidad y máximo de descargas emitidos al confirmarse el pago.
  - CMS: `src/admin/shop/` (ProductsPanel, OrdersPanel, StoreSettingsPanel) + `ShopEditor.jsx` (banners/featured). Frontend: `shopApi.js`, `shopProduct.js` (adapter), `shopDataContext.jsx`, `useShopCart.js`, `OrderStatusModal.jsx` (regreso de Stripe vía `?pedido=TOKEN`).
- **Golden ticket flow**: único descuento propio del sitio. Se gana jugando el minigame de esferas (score ≥ 5000 en `GOLDEN_TICKET_SCORE_THRESHOLD`, mismo umbral que la gold skin `GOLD_SKIN_THRESHOLD`) → `user_profiles.golden_ticket=1`. `shop-checkout.php` aplica un cupón de Stripe del 35% (`SHOP_GOLDEN_TICKET_PCT`, creado solo la primera vez) y el webhook lo quema (`ticket_burned=1`) al confirmarse el pago. Un solo checkout abierto por ticket. Display: chip en cart + precios con descuento en product cards (`usePriceWithDiscount`). **Identidad**: el backend nunca acepta un `privy_id` del body; lo saca del access token de Privy verificado (`privy-auth.php`, header `X-Privy-Token`, `useAuth().getAccessToken`). **Score**: cada partida pide un boleto (`profile.php?action=game_start`, `src/lib/gameSession.js`) y `save_score` rechaza puntajes imposibles para el tiempo jugado.
- **Personalización de color del personaje** (`src/lib/characterColors.js`, `src/components/CharacterCustomizer.jsx`): slot único en localStorage (`skulley_character_colors`, mismo patrón que `useActiveDiscount`) con `{head, eyes, hair}` + `CustomEvent('character-colors-changed')`. `applyCharacterColorsToScene/Material` recolorea por NOMBRE de material del GLB: `Head` (esqueleto/cuerpo), `Eyes` (color + emissive), `Hair`. Se aplica en TODOS los renders del personaje (`Player.jsx`, `CharacterPortrait.jsx`, `CharacterPortraitHero.jsx`) escuchando el evento; la skin dorada NO se recolorea. Funciona gratis con el toon: el banding reescala por luminancia, así que cambiar `.color` conserva el cel-shading sin recompilar shader. **Modo customize**: el botón 🎨 (top-right, solo HOME) abre un panel a la derecha y pone `customizeOpen`; eso pasa `customizeActive` a `HomeScene` → (1) `CameraController` hace un **barrido orbital** (polar) a una toma frontal con el personaje a la izquierda (zoom-out en mobile), (2) `Player` congela la locomoción (idle sigue), (3) se ocultan los HUD que estorban. Botón **Randomize** dispara colores vívidos (HSL) + un **vórtice de runas ascendente** (`RuneBurstParticles.fire({mode:'spiral'})` vía `CustomEvent('character-color-burst')` que escucha `HomeOrbs`) + SFX `magiaInicia`. El modo `burst` radial de `RuneBurstParticles` sigue siendo el easter egg "POWEROFGOD" del cursed orb.
- **MCP remoto / conector de Claude** (desde 2026-10-24): `https://mroscar.xyz/mcp` (`public/api/mcp-remote.php`). Un colaborador lo agrega en Claude como *custom connector*; Claude descubre el OAuth del sitio (`mcp-oauth.php` + `mcp-oauth-lib.php`: registro dinámico, PKCE S256, tokens de 1 h que rotan) y abre `/oauth/authorize`, donde se pega una **llave** creada en CMS → Access keys (`mcp-tokens.php`, solo con sesión: una llave nunca crea otra). Permisos por llave: `read` < `shop` (tienda) < `write` ("Everything": además crea/edita proyectos y posts y publica). Revocar la llave corta sus conexiones. Las herramientas llaman por loopback a los endpoints de siempre (`mcp.php`, `mcp-write.php`, `shop-admin.php`, `shop-orders.php`, `shop-coupons.php`) con la misma credencial → mismas validaciones y bitácora (`private/mcp.log`). Ninguna llave reembolsa ni mueve dinero. `.mcp.json` del repo apunta al remoto: Claude Code se autentica igual (OAuth + llave). Para agregar una herramienta: el endpoint y su permiso en `McpAuth`, y la entrada en `$TOOLS` de `mcp-remote.php`.
  - **Archivos por el conector** (desde 2026-10-24): MCP no transporta bytes, así que `create_upload_link` (`mcp-upload.php`) da un enlace `https://mroscar.xyz/subir/{token}` para UN destino (galería o portada de proyecto, fotos de producto, portada de entrada), que vence en 1 h, tiene tope de archivos y muere si se revoca la llave. Claude Code sube con `curl -F file=@ruta URL`; en claude.ai el usuario abre el enlace y arrastra (página en español con pasos y reglas). Todo pasa por `upload-lib.php`, la misma librería que `upload.php` del CMS (WebP 2400 px, miniatura, 10 MB imagen / 50 MB video). La galería se acomoda con `list_project_media`, `reorder_project_media`, `set_project_cover` y `remove_project_media` (`mcp-media.php`; quitar manda el archivo a `uploads/_trash/`, bloqueado con su propio `.htaccess` porque `uploads/.htaccess` apaga mod_rewrite). **Objetivo de Oscar: que Claude haga todo por el conector, sin abrir el CMS.**
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
- No agregar cheat terminal nuevo en el frontend — fue removido 2026-04-22. Los códigos promocionales se crean en el Dashboard de Stripe (Coupons → Promotion codes) y el comprador los escribe en el checkout. Si se necesita re-introducirlo, reescribir desde cero con diseño actualizado.
- No mandar precios, totales ni descuentos desde el navegador al checkout: el servidor los recalcula desde MySQL. Tampoco marcar pedidos como pagados fuera del webhook de Stripe.
