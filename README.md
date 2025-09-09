## Interactive Portal Site

Proyecto React + Vite con escena 3D en WebGL usando React Three Fiber, Drei y post‑procesado. Incluye personaje animado, cámara third‑person, portales con partículas, FX globales y UI superpuesta con TailwindCSS. Además, retrato en cápsula con viñetas tipo cómic y easter egg.

### Stack
- React 19 + Vite 7
- Three.js 0.179 + @react-three/fiber 9
- @react-three/drei (helpers: useGLTF, OrbitControls, Environment, etc.)
- @react-three/postprocessing + postprocessing (Composer y efectos)
- TailwindCSS v4 con @tailwindcss/postcss (PostCSS 8)

### Scripts
- `npm run dev`: servidor de desarrollo (Vite).
- `npm run build`: build de producción.
- `npm run preview`: previsualización local del build.

### Estructura relevante
- `index.html`: favicon inline y fuente Comic Neue para viñetas.
- `src/index.css`: Tailwind (v4).
- `src/App.jsx`: orquesta Canvas, Player, Portales, PostFX, luces y UI.
- `src/components/Player.jsx`: carga GLTF del personaje, animaciones idle/walk y movimiento relativo a cámara.
- `src/components/CameraController.jsx`: cámara third‑person basada en OrbitControls (rotación/zoom y seguimiento).
- `src/components/PostFX.jsx`: EffectComposer con Bloom, Vignette, Noise, DotScreen, GodRays y DepthOfField.
- `src/components/FollowLight.jsx`: spotlight que sigue la cabeza del jugador.
- `src/components/PortalParticles.jsx`: partículas “fireflies” con comportamiento de enjambre y reacción a proximidad.
- `src/components/CharacterPortrait.jsx`: retrato en cápsula con postFX local, viñetas cómic, easter egg y cursor personalizado.

### Ejecución
1. Node requerido: 20.19+ o 22.12+. En Windows, instala nvm-windows y ejecuta:
   - `nvm install 20.19.0 && nvm use 20.19.0`
   - Alternativa: Volta: `volta pin node@20.19.0`
2. `npm i`
3. `npm run dev` y abre la URL que imprima Vite.

### Controles
- Movimiento: WASD o flechas. El personaje se orienta suave (lerp angular con wrapping) hacia la dirección de marcha.
- Cámara: OrbitControls; rotación orbital, zoom con límites (min/maxDistance) y damping.

### Portales y proximidad
- Cuatro portales alrededor del centro (±16). El `Player` calcula la distancia mínima a portales y reporta `onProximityChange`, con lo que se interpola el color global de la escena hacia `#0a132b` al acercarse.

### Post‑procesado global (PostFX)
- Efectos: Bloom, Vignette, Noise, DotScreen (con escala, ángulo, centro, opacidad y modo de mezcla), GodRays (anclado a una malla invisible) y DepthOfField (modo progresivo opcional enfocado al jugador).
- Sliders en UI plana (DOM) para todos los parámetros. Botón para copiar presets (JSON).

### Luz superior (FollowLight)
- Spotlight que sigue al jugador y apunta a su cabeza. UI DOM con sliders (altura, intensidad, ángulo, penumbra) y botón para copiar preset.

### Partículas de portal
- Sistema con distribución sesgada hacia arriba y comportamiento vivo. Al acercarse el jugador, las partículas se vuelven erráticas, pueden “enjambrear” alrededor del jugador y opcionalmente orbitar huesos (cuando está muy cerca). El radio interior del portal también tiene partículas.

### Retrato del personaje (UI)
- Canvas independiente con clon profundo del GLTF mediante `SkeletonUtils.clone` para no compartir skeleton/skin.
- Cámara encuadrada a la cabeza; luz rim “pin” trasera con UI propia (sliders y copy presets).
- PostFX local: DotScreen sincronizado con los sliders globales.
- Viñetas tipo cómic: estilo con Tailwind, cola orientada dinámicamente a la cabeza, temporizador visible y aparición aleatoria entre 4–9s. Fuente Comic Neue Bold 700.
- Easter egg del retrato: clics rápidos (>3) activan estado especial (fondo rojo, burbuja negra con texto exclusivo, supresión de burbujas normales) y tintado rojo de la escena, todo con temporizador sincronizado para volver a la normalidad.
- Cursor “slap” personalizado: `public/slap.svg` sigue el puntero dentro de la cápsula; al click crece con rebote. Sonido `public/punch.mp3` con polifonía (pool) para golpes superpuestos.

### Notas técnicas clave
- Animación y blending: se usan `setEffectiveWeight` y `setEffectiveTimeScale` para sincronizar el ritmo de la caminata con la velocidad real del personaje.
- Interpolación angular: se evita el salto al cruzar ±π con un lerp con wrapping.
- GodRays: el “sun” debe ser una malla con material válido (aunque invisible) y los sliders fuerzan remount vía `key` para reactividad inmediata.
- DOF progresivo: enfoque dinámico hacia el jugador, con controles expuestos; puede desactivarse sin coste en runtime.
- Tailwind v4: PostCSS configurado con `@tailwindcss/postcss` (CommonJS en `postcss.config.cjs`).

### Swap de texturas (mejor práctica, pendiente de activar)
1. Precarga: cargar familia “default” y “egg” (albedo/emissive en sRGB, normal/ORM en Linear, flipY=false) y configurar filtros/anisotropy.
2. Indexación: mapear materiales del GLTF por nombre o malla al montar `Player` y guardar snapshot de mapas originales.
3. Alternativa: preparar estructura paralela con los mapas y ajustes PBR “egg”.
4. Swap: reasignar `material.map`, `normalMap`, etc., ajustar PBR y marcar `material.needsUpdate = true` (sin recrear el `scene` ni el `AnimationMixer`).
5. Opcional: materiales alternos completos o crossfade con `onBeforeCompile` o malla duplicada.

### Assets esperados en public/
- `light.hdr` (HDRI para iluminación ambiental; solo ilumina, no es visible).
- `character.glb` (personaje con animaciones Idle/Walking).
- `slap.svg` (imagen del cursor personalizado en retrato).
- `punch.mp3` (sonido al click del retrato).
- `grave_lowpoly.glb` (actualmente removido de escena).

### Rendimiento
- Damping moderado en controles de cámara; culling por defecto de Three.
- Partículas optimizadas con atributos y shaders; conteo ajustable.
- Posprocesado: multisampling mínimo, resoluciones fijas para DOF.

### Troubleshooting destacado
- Error al iniciar: `TypeError: crypto.hash is not a function` o mensaje de Vite pidiendo Node 20.19+ → actualiza Node (nvm-windows recomendado). El proyecto ahora aborta con verificación automática antes de dev/build.
- Tailwind 500: usar `@tailwindcss/postcss` en `postcss.config.cjs` (no `tailwindcss` directo).
- Drei Perf no existe en el bundle: remover import o usar `r3f-perf` si se requiere.
- GodRays: requiere malla con material; si se pasa un Object3D sin material, lanza error.







