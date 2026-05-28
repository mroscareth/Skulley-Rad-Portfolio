# DESIGN.md — Skulley Rad Portfolio

> **Golden book** de directrices de diseño.
> Este documento es la fuente de verdad para crear, auditar y refactorizar componentes.
> Todos los valores aquí reflejan el estado real del código (no aspiracional).
> Cuando algo nuevo se cree, debe alinearse con este documento. Cuando se detecte una divergencia existente, se registra en la sección **Deuda de diseño**.

---

## 0. Principios

1. **Cyberpunk gamer terminal**: CRT, scanlines, glitch, glow, portales. La UI imita un HUD de videojuego sobre una escena 3D.
2. **Color por sección**: cada sección del mundo 3D tiene un color identitario que tiñe portales, glows y transiciones.
3. **Mobile-first Tailwind**: base para móvil, `sm:`/`md:`/`lg:` para override.
4. **Sobre lienzo oscuro**: el fondo casi siempre es negro/azul muy oscuro. El color se usa en acentos, glows y bordes, no en superficies grandes.
5. **Monoespaciado para "sistema"**: cualquier UI diegética (terminal, formulario contacto, modales) usa Cascadia Code.
6. **Transiciones expo**: animaciones de entrada/salida con curvas `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) y `cubic-bezier(0.4, 0, 0.2, 1)` (expo-in).

---

## 1. Colores

### 1.1 Paleta por sección (identidad)

Definida en `src/App.jsx:138–150` (`sectionColors`). Tiñe portales, bordes y glows de cada sección.

| Sección | Nombre | Hex | Uso |
|---|---|---|---|
| Home | Slate-950 | `#0f172a` | Fondo base / default |
| Section 1 — Work | Cyan | `#00bfff` | Portal + glow portfolio |
| Section 2 — About | Neon Green | `#00ff26` | Portal + glow about |
| Section 3 — Side Quests | Magenta | `#e600ff` | Portal + glow minijuegos |
| Section 4 — Contact | Golden Yellow | `#decf00` | Portal + glow contacto |
| Section 5 — Blog | Neon Orange | `#ff6b00` | Portal + glow blog |

**Regla**: al crear UI para una sección, usar su color como acento (bordes, glows, hover) nunca como fondo sólido de grandes áreas.

### 1.2 Paleta de sistema (Terminal UI)

Usada en ContactForm, TutorialModal y cualquier UI tipo consola.

| Token | Hex | Tailwind | Uso |
|---|---|---|---|
| `terminal-bg` | `#0a0a14` | — | Fondo terminal |
| `terminal-border` | `#3b82f6` | `blue-500` | Borde y texto base |
| `terminal-glow` | `rgba(59,130,246,0.3)` | — | `box-shadow` outer |
| `terminal-glow-inset` | `rgba(59,130,246,0.05)` | — | `box-shadow` inset |
| `prompt-cyan` | `#0ff` | — | Prompt `>` |
| `prompt-green` | `#0f0` | — | Caret / éxito literal |
| `caret` | `#4ade80` | `green-400` | `caret-color` inputs |

### 1.3 Semánticos

| Token | Hex | Tailwind |
|---|---|---|
| Success | `#22c55e` | `emerald-500` / `green-400` |
| Error | `#ef4444` | `red-500` |
| Warning | `#fbbf24` | `amber-400` |
| Info | `#38bdf8` | `sky-400` |
| Score + | `#3b82f6` | `blue-500` |
| Score − | `#ef4444` | `red-500` |
| Power/energy | `#facc15` | `yellow-400` |

### 1.4 Capas y transparencias

Siempre sobre fondo oscuro. Usar estas alphas preset en lugar de inventar nuevas.

| Superficie | Clase |
|---|---|
| Overlay primario | `bg-black/50` |
| Overlay secundario | `bg-black/40` |
| Overlay fuerte | `bg-black/70` |
| Elevated (header) | `bg-white/10` |
| Elevated tintada | `bg-blue-500/10` |
| Tertiary (footer) | `bg-blue-500/5` |
| Borde glass default | `border-white/[0.08]` |
| Borde glass sutil | `border-white/[0.12]` |
| Borde glass visible | `border-white/20` |
| Borde tintado | `border-blue-500/30` |

### 1.5 Variables CSS dinámicas

| Variable | Default | Uso |
|---|---|---|
| `--portal-color` | `#00bfff` | Color del portal activo (se sobreescribe por sección) |
| `--vinyl-c1/c2/c3` | según preset | Colores del vinilo activo |
| `--vinyl-hl` | `rgba(255,80,80,0.18)` | Highlight del vinilo |
| `--glow` | `0..1` | Intensidad de glow del PowerBar |

> **Regla**: nada de hex hardcodeado nuevos. Si un color se repite 2+ veces → subirlo a esta tabla y usar variable CSS o clase Tailwind.

---

## 2. Tipografía

### 2.1 Familias cargadas

Carga en `index.html:415–428` (Google Fonts).

| Familia | Pesos | Rol | Fallback |
|---|---|---|---|
| **Outfit** | 400, 600, 700 | **Body + UI default** | `system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif` |
| **Luckiest Guy** | 400 (display) | Títulos/marquees/branding | `Archivo Black, system-ui` |
| **Archivo Black** | 400 (display) | Alternativa display | `system-ui` |
| **Cascadia Code** | 400, 600, 700 | **Terminal / código / HUD diegético** | `"Fira Code", "JetBrains Mono", monospace` |
| **Comic Neue** | 400, 700 | Solo para `.glitch-font` mode | — |

**Regla**: nunca introducir una 6ª familia. Si se necesita otro tono visual, usar peso/tamaño/tracking.

### 2.2 Escala de títulos y copy

Clases custom definidas en `src/index.css:16–43`. Úsalas siempre en lugar de re-escribir combos Tailwind.

| Clase | Móvil | Desktop | Line-height | Uso |
|---|---|---|---|---|
| `.heading-1` | `text-4xl` | `text-6xl` | `leading-tight` | Hero / H1 |
| `.heading-2` | `text-3xl` | `text-5xl` | `leading-tight` | Sección / H2 |
| `.heading-3` | `text-2xl` | `text-3xl` | `leading-snug` | Subsección / H3 |
| `.copy-base` | `text-base` | `text-lg` | `leading-relaxed` | Body default |
| `.copy-lg` | `text-lg` | `text-xl` | `leading-relaxed` | Body destacado |
| `.copy-xl` | `text-2xl` | `text-3xl` | `leading-relaxed` | Feature copy |

Regla global (`src/index.css:9–11`): todo `<p>` sin clase hereda `text-lg md:text-xl leading-relaxed`.

### 2.3 Pesos y line-heights

- **400**: body, prompt, placeholder.
- **600**: subtítulos, énfasis UI (default para headings en Outfit).
- **700**: CTAs, marquees, negritas fuertes.
- **leading-tight (1.25)**: h1, h2.
- **leading-snug (1.375)**: h3, labels.
- **leading-relaxed (1.625)**: body.
- **leading-none (1)**: CRT terminal líneas, HUD numérico.

### 2.4 Tracking

- Default (sin tracking explícito) para body.
- `tracking-wide` (0.1em) para toasts, HUD, badges.
- Marquees: `letter-spacing: 0` explícito (evita separación fea en Luckiest Guy).

### 2.5 Efectos tipográficos

- **Glitch mode**: clase `.glitch-font` en ancestro → fuerza todo el subárbol a Comic Neue. Solo para estados de error/glitch, no permanente.
- **CTA portal**: clase `.portal-cta-text` — 34px (32px en glitch), line-height 1.22–1.28, padding corregido para evitar clipping de descenders. Úsala para cualquier botón sobre portal 3D.
- **Typewriter**: librería `typewriter-effect`. Cursor estilizado en `src/index.css:119–136` — `rgba(255,255,255,0.7)`, weight 100, blink 1s.

---

## 3. Espaciado y layout

### 3.1 Unidad base

Tailwind default: **4px = 1 unit** (`0.25rem`). Nada de px arbitrarios en inline styles si existe equivalente Tailwind.

### 3.2 Escala aceptada

Usar solo estos valores. Si hace falta otro, justificar en PR.

| Tamaño | Tailwind | px | Uso típico |
|---|---|---|---|
| xs | `2` / `gap-2` | 8 | Gap entre ícono y texto |
| sm | `3` / `gap-3` | 12 | Gap entre items de lista |
| md | `4` / `p-4` | 16 | **Padding default móvil** |
| lg | `6` / `p-6` | 24 | **Padding default desktop** |
| xl | `8` / `p-8` | 32 | Secciones grandes |
| 2xl | `12` | 48 | Separación entre bloques mayores |

**Patrón responsive canónico**: `p-4 sm:p-6` (16 → 24).
**Padding de botón canónico**: `px-4 py-2` (16 × 8).
**Padding de botón amplio**: `px-5 py-2.5` (20 × 10).

### 3.3 Contenedores

| Contexto | Ancho max |
|---|---|
| Contenido central (contact, about) | `max-w-3xl mx-auto` (768px) |
| Wrapper de sección | `width: min(1200px, 92vw)` |
| Modal default | `w-[min(520px,92vw)]` |
| Modal grande | `w-[min(720px,92vw)]` |

### 3.4 Breakpoints

Tailwind estándar (no custom):

| Prefijo | Min-width |
|---|---|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

MusicPlayer usa `mobileBreakpointPx=640` como prop interna; alinear cualquier otro detector de mobile a **640**.

---

## 4. Botones

> Hoy no hay componente `<Button>` central. **Objetivo**: crear `src/components/ui/Button.jsx` con las variantes listadas a continuación. Mientras tanto, seguir estos patrones al escribir nuevos botones.

### 4.1 Transición global (heredada)

Definida en `src/index.css:1128–1145`. Todo `<button>` ya tiene:

```css
transition: transform 120ms cubic-bezier(0.2, 0.7, 0.2, 1),
            filter 120ms linear,
            box-shadow 120ms linear,
            background-color 120ms ease;
/* :hover */ transform: translateY(-1px); filter: brightness(1.05);
/* :active */ transform: translateY(0); filter: none;
/* [disabled] */ cursor: not-allowed; transform: none; filter: none;
```

No duplicar estas transiciones a mano.

### 4.2 Variantes

Todas implementadas en `src/components/ui/Button.jsx`. Usar el componente, no re-escribir.

| Variante | Uso | Clases base |
|---|---|---|
| **primary** | Acción principal, portales | `rounded-full bg-power hover:bg-yellow-300 text-black font-bold` |
| **secondary** | UI diegética, formularios | `rounded-lg border border-terminal-border/50 bg-terminal-border/10 hover:bg-terminal-border/20 text-blue-100 font-mono` |
| **ghost** | Acción terciaria, cancel | `rounded-lg bg-transparent border border-white/20 hover:bg-white/10 text-white` |
| **icon** | Botón solo ícono | `rounded-full grid place-items-center bg-white/10 hover:bg-white/20 backdrop-blur` |
| **toggle** | Icon toggle on/off | `rounded-full grid place-items-center bg-white/[0.12] hover:bg-white/[0.28] backdrop-blur` |
| **danger** | Eliminar, reset | `rounded-lg bg-feedback-error/90 hover:bg-feedback-error text-white` |
| **terminal-action** | CTA filled en modales terminal (Play Again, Next, etc.) | `rounded border-2 border-blue-400 bg-blue-500 text-black font-mono font-bold + glow box-shadow` |
| **terminal-outline** | Secundario en modales terminal (Exit, Skip) | `rounded border border-blue-700 bg-transparent text-blue-500 font-mono` |

**`terminal-*` variants** (agregadas 2026-04-22) tienen su propia escala `TERMINAL_SIZES`: `sm` (h-9 px-5 text-sm), `md` (h-12 px-8 text-sm), `lg` (h-12 px-10 text-sm). Text siempre `text-sm` monospace para match con el lenguaje visual de los hot sites (GameOverModal, TutorialModal). Prefijo `> TEXT_` es content, no style — el consumer lo compone.

### 4.3 Tamaños

| Tamaño | Altura | Padding | Uso |
|---|---|---|---|
| `sm` | 32–34px | `px-3 py-1.5` | Iconos pequeños, HUD |
| `md` | 40–44px | `px-4 py-2` | Default |
| `lg` | 46–48px | `px-5 py-2.5` | Toolbars, toggles destacados |
| `xl` | 60px+ | `px-6 py-3` | CTA principal, portales |

### 4.4 Radios

- `rounded-full` → botones tipo pill y CTAs redondos.
- `rounded-lg` (0.5rem) → botones cuadrados, modales, inputs.
- `rounded-md` (0.375rem) → solo si `lg` es demasiado blando.
- **Nunca** `rounded-sm` o `rounded-none` salvo estética brutalist intencional.

### 4.5 Estados

- **Hover**: `translateY(-1px)` + `brightness(1.05)` (automático).
- **Active**: reset + `filter: none`.
- **Disabled**: `disabled:opacity-50 disabled:cursor-not-allowed`.
- **Focus visible**: **pendiente** — agregar `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-<sectionColor>` en el futuro componente Button.

---

## 5. Formularios e inputs

### 5.1 Input terminal canónico (referencia: `ContactForm.jsx:318–376`)

```jsx
<input
  className="flex-1 bg-transparent text-white font-mono text-lg
             outline-none caret-green-400 placeholder-white/20 min-w-0"
/>
```

- **Prefijo de label estilo CLI**: `"> name:"`, `"> email:"`, `"> msg:"` en azul `text-blue-400`.
- **Helper/descripción**: `"// descripción"` en `text-blue-400/70`.
- **Step counter**: `"[1/4]"` en `text-yellow-400/80`.
- **Textarea**: mismos estilos + `rows={4}` + `resize-none`.
- **Honeypot**: campo `name="company"` oculto (anti-spam).
- **Validación**: error en `text-red-400`, éxito con `✓` en `text-green-400 animate-pulse`.

### 5.2 Focus ring (pendiente estandarizar)

Actualmente no hay focus ring explícito (se confía en el caret verde). **Meta**: agregar `focus:ring-1 focus:ring-blue-500/50` sin romper estética terminal.

---

## 6. Tarjetas y superficies

### 6.1 Glass morphism (modales, toasts, paneles)

```css
background: rgba(0,0,0,0.4–0.7);
backdrop-filter: blur(6px) → blur-xl;   /* ← MANDATORY, ver reglas abajo */
border: 1–2px solid rgba(59,130,246,0.2–0.5)  /* tintado */
     | rgba(255,255,255,0.08–0.12);           /* neutral */
border-radius: 0.5rem;
```

Tailwind equivalente preset:

- **Modal default**: `bg-black/60 backdrop-blur-xl border border-white/[0.12] rounded-lg`
- **Modal tintado sección**: `bg-black/60 backdrop-blur-xl border border-blue-500/30 rounded-lg`
- **Toast**: `bg-black/70 backdrop-blur-xl border border-white/[0.12] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)]`
- **Icon button flotante**: `bg-black/40 backdrop-blur-xl border border-white/[0.12] rounded-full`

**Reglas inquebrantables del dark glass** (incidentes previos perdimos el blur al bajar tinta del bg):

1. **`backdrop-filter` (o `backdrop-blur-*` de Tailwind) es OBLIGATORIO** en cualquier componente tipo glass. Sin blur no es glass, es un rectángulo oscuro.
2. **El background alpha nunca debe superar `/70`**. Con `bg-black/80` o `bg-black/85` el blur deja de notarse → se ve opaco y "plano". Usar `/40–/70` para que el blur se distinga.
3. **Blur intensity mínimo: `backdrop-blur-md`** (12px). Preferir `backdrop-blur-xl` (24px) para modales y paneles grandes.
4. Combinar siempre `bg-black/{40-70}` + `backdrop-blur-{md|lg|xl}`. Cualquier lado del par faltando = bug de diseño.
5. Si por performance en mobile se quiere bajar el blur, **no quitarlo** — cambiar a `backdrop-blur-sm` (4px). Nunca dejarlo en cero.
6. Fallback para browsers sin soporte: `@supports not (backdrop-filter: blur(1px))` → subir bg alpha a `/80` como compromiso. **Solo dentro de ese @supports**, no como default.

### 6.2 Terminal container

```css
background: #0a0a14;
border: 2px solid #3b82f6;
border-radius: 0.5rem;
box-shadow: 0 0 20px rgba(59,130,246,0.3),
            inset 0 0 60px rgba(59,130,246,0.05);
/* + pseudo-elementos ::before scanlines y ::after vignette via .crt-scanlines */
```

### 6.2b Terminal chrome header (traffic-lights)

Patrón estándar para el header de cualquier panel/overlay estilo terminal.
Referencia canónica: `src/components/ContactForm.jsx:198-213`.
Replicado también en: `src/components/shop/ShopCart.jsx` (panel "Bolsa de evidencia").

**Estructura**:

```jsx
<header className="flex items-center justify-between px-4 py-2 border-b border-blue-500/30 bg-blue-500/10">
  {/* Traffic-lights: el rojo es close funcional, los otros dos son dummies visuales */}
  <div className="flex items-center gap-2">
    <button
      type="button"
      className="p-1.5 -m-1.5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
      onClick={onClose}
      aria-label="Close"
    >
      <span className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
    </button>
    <div className="w-3 h-3 rounded-full bg-white/20" />
    <div className="w-3 h-3 rounded-full bg-white/20" />
  </div>
  {/* Título estilo prompt, formato: M.A.D.R.E.@mausoleum:~/<slug-del-contexto> */}
  <span className="text-blue-500/70 text-base">M.A.D.R.E.@mausoleum:~/contact</span>
  <div className="w-6" />{/* spacer para balancear el traffic-lights a la izquierda */}
</header>
```

**Reglas**:
- El traffic-light rojo (`bg-red-500`) es el único **funcional** (disparar `onClose`). Los otros dos son `bg-white/20` puramente decorativos.
- Hit-area del close: wrapping `<button>` con `p-1.5 -m-1.5` (target táctil >=24px sin engordar el visual).
- Título prompt: `M.A.D.R.E.@mausoleum:~/<slug>` donde `<slug>` describe el contexto (ej. `contact`, `evidence`, `admin`).
- Bordes: `border-b border-blue-500/30`, background `bg-blue-500/10`.
- **Usar siempre** en vez de un X-icon button cuando el panel sea un "terminal".
- Si el título descriptivo es muy largo, va en un **sub-header** debajo (border-bottom suave blue-500/20).

### 6.3 Sombras

| Tipo | Valor |
|---|---|
| Elevación sutil | `0 2px 8px rgba(0,0,0,0.2)` |
| Elevación media | `0 3px 12px rgba(0,0,0,0.3)` |
| Toast / overlay | `0 8px 32px rgba(0,0,0,0.4)` |
| Glow terminal | `0 0 20px rgba(59,130,246,0.3)` |
| Glow portal (dinámico) | `0 0 20–32px var(--portal-color)` |

---

## 7. Efectos y estética

### 7.1 CRT Scanlines (`.crt-scanlines`)

Clase utilitaria en `src/index.css:1257–1302`. Aplicar al wrapper de cualquier UI diegética.

- **::before**: bandas horizontales repetidas (3px transp / 3px `rgba(0,0,0,0.7)`), animación `crt-scan 0.4s linear infinite`, `opacity: 0.35`.
- **::after**: vignette radial (transparente 30% → `rgba(0,0,0,0.75)` 100%).
- Hijos del container deben ir con `z-index: 20` (el ::before está en 10, ::after en 11).

### 7.2 Glitch font

Clase `.glitch-font` en ancestro fuerza todo el subárbol a Comic Neue. Usar para estados de error/glitch transitorio, nunca permanente.

### 7.3 RGB Border (`.rgb-border`)

Borde animado arcoíris (`rgbShift 6s linear infinite`) usando pseudo-element + mask. Usar con moderación (1 elemento por sección máx).

### 7.4 Portal glow pulse (`.animate-portal-glow`)

Keyframe `portal-glow-pulse` (2s ease-in-out infinite) que lee `--portal-color`. Cualquier CTA sobre portal 3D debería usar este glow en vez de inventar uno propio.

### 7.5 Animaciones de UI (entrada/salida)

Definidas en `src/index.css:305–400`. Usar clases, no reescribir keyframes.

| Clase | Efecto | Duración | Easing |
|---|---|---|---|
| `.animate-ui-enter-up` | translateY(32→0) + fade | 0.5s | expo-out |
| `.animate-ui-exit-down` | translateY(0→32) + fade | 0.25s | expo-in |
| `.animate-ui-enter-left/right` | translateX(±40→0) + fade | 0.5s | expo-out |
| `.animate-ui-enter-scale` | scale(0.85→1) + fade | 0.4s | expo-out |
| `.animate-ui-exit-scale` | scale(1→0.85) + fade | 0.25s | expo-in |
| `.animate-ui-enter-up-delay` | igual + `delay 100ms` | — | — |
| `.animate-ui-enter-up-delay-2` | igual + `delay 200ms` | — | — |

### 7.6 Curvas de easing canónicas

| Nombre | Valor | Uso |
|---|---|---|
| `expo-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entradas |
| `expo-in` | `cubic-bezier(0.4, 0, 0.2, 1)` | Salidas |
| `smooth-bounce` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Interacción button |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Toggles (vinyl, power) |

### 7.7 Duraciones canónicas

| Rango | Uso |
|---|---|
| 100–120ms | Hover/active de botón |
| 200–300ms | Modal, card expand, toast |
| 400–500ms | Entrada de sección UI |
| 1.2–2s | Pulsos (portal glow, music pulse) |
| 6–18s | Fondos lentos, marquees, rgb border |

### 7.8 Cel-shading del personaje (estilo toon — Hi-Fi Rush / planetono)

> **Look canónico del personaje 3D.** Establecido 2026-05-27. Es la firma visual de Skulley. **Debe replicarse en el retrato** (`CharacterPortrait.jsx`) y en cualquier render nuevo del personaje. NO usar PBR realista crudo para Skulley.

El estilo combina **4 capas**, todas necesarias:

**1. Banding de luz (cuantización)** — `src/lib/toonBanding.js` → `applyToonBanding(material, opts)`
- Inyecta vía `onBeforeCompile` un paso que **aplana la luz difusa en escalones** (cel bands). No reemplaza el material → conserva PBR/envmap/skinning/gold-skin.
- Bandea por **luminancia** (preserva el tono/albedo). `bandIndirect: true` bandea directo + IBL (lo dominante en esta escena).
- `minBand` = piso de sombra (evita negro puro). Params del personaje: `steps: 5, minBand: 0.08, bandIndirect: true`.
- Aplicado en `Player.jsx` en el pase de clonado de materiales, con `envMapIntensity = 0.5` (baja el IBL para que la key light domine y el corte luz/sombra se note).

**2. Iluminación dirigida** — `HomeScene.jsx`
- **Key light** direccional casi cenital `[1, 10, 2.5]`, intensidad `2.0`, cálida `#fff4e6`. Crea el terminador que el banding cuantiza.
- **Fill light** fría tenue `[-4, 2, -3]`, intensidad `0.3`, `#9fd0ff` → la sombra no queda muerta.

**3. Outline de silueta** (inverted-hull) — `Player.jsx` `outlineMaterial`
- Casco invertido `BackSide`, negro, grosor constante en pantalla (`outlineThickness 0.018`). Se aplica por-submesh (el modelo tiene 33 piezas). Grosor uniforme, se mueve con la cámara. **Se conserva siempre.**

**4. Ink lines internas de crease** (lo nuevo, lo que da el look Hi-Fi Rush) — `EdgeInk` en `PostFX.jsx` + `CharacterNormalPass.jsx` + `src/lib/toonInkBuffer.js`
- **`CharacterNormalPass`** (dentro del Canvas, `priority 0.5` → después de cámara/pose, antes del composer en `1` → sin fantasma al caminar): renderiza **SOLO los meshes del personaje** (skinned, sin outline/orb/voxel/bolt) a un FBO con `MeshNormalMaterial` (normales geométricas, respeta skinning). Publica la textura en `characterNormalTexture.current`.
- **`EdgeInk`** (effect de postprocessing): hace un **Laplaciano sobre el buffer de normales** (desviación del centro vs el promedio de vecinos = 2da derivada). **Clave**: el Laplaciano solo se dispara en **creases reales** (pliegues), NO en superficies curvas suaves aunque sean densas (dedos/manos) → **no se llenan de negro**. Un gradiente (suma de diffs) sí las llenaba — NO usar gradiente.
- Solo el personaje recibe líneas (buffer aislado) → el resto de la escena queda limpio.
- **Escala por tamaño en pantalla** (`characterNormalTexture.scale`, calculado en CharacterNormalPass con la altura en px del personaje, `REF_PX = 480`): de lejos sube el threshold (menos líneas, no más finas → siguen crisp) para que no se amontone; de cerca, full detalle.
- Params actuales: `thickness 1.3, strength 0.9, threshold 0.3, soft 0.16`, declutter lejano `threshold / max(scale, 0.4)`.

**Detalles adicionales (todos implementados):**
- **Pupilas full toon**: el material `Pupils` del GLB trae `roughness: 0` (espejo → brillo especular). En el clonado de materiales (Player + retrato) se detecta por nombre (`/pupil/i`) y se reemplaza por `MeshBasicMaterial` negro unlit (`toneMapped:false`) → negro plano sin highlight. La parte amarilla con glow es el material `Eyes` (emisivo) — NO se toca.
- **Desarme (rigid pieces) conserva el toon**: `createRigidMaterial` (Player.jsx) clona el material original pero **borra `onBeforeCompile`** (para limpiar inyecciones stale del gold-reveal/outline) → eso quitaba el banding. Se **re-aplica `applyToonBanding`** tras el scrub y se baja `envMapIntensity` a 0.5. Para el ink, `CharacterNormalPass` incluye las piezas (detectadas por `userData.__disassembleOwned`, caminando ancestros para las que van en grupos como `headGroup`/`eyeGroup`).
- **Gating en orb mode**: en modo esfera el modelo se oculta con `applyModelOpacity(0)` (opacity ~0, pero `visible=true`). `CharacterNormalPass` **salta los meshes con `opacity <= 0.1`** → en modo esfera el personaje oculto no se entinta. Las piezas del disassemble (opacity 1) sí pasan.
- **Retrato (`CharacterPortrait.jsx`)**: replica las 4 capas con su propio `CharacterNormalPass` (`target={portraitNormalTexture}`, `fixedScale` porque el framing ortho es constante) + `EdgeInkEffect` en su composer. Lights ajustadas (ambient 0.45 / directional 1.5). El doble del outline (desfase de 1 frame) quedó como **feature intencional** en el retrato — se ve bien.
- **Componentes reutilizables**: `src/components/fx/EdgeInkEffect.jsx` (effect, toma un `bufferRef`), `src/components/fx/CharacterNormalPass.jsx` (toma `target` + `fixedScale`), `src/lib/toonInkBuffer.js` (holders `characterNormalTexture` y `portraitNormalTexture`).

**Reglas duras del look toon:**
1. Las 4 capas van **juntas**. El outline da silueta, las ink lines dan el detalle interno, el banding da el sombreado plano, las luces dan el corte.
2. **Ink lines = Laplaciano sobre normales geométricas**, nunca Sobel de luminancia de pantalla (entinta el banding de sombras) ni `fwidth` (revela los triángulos de la malla low-poly).
3. El ink solo toca al **personaje** (buffer aislado vía `CharacterNormalPass`, uno por Canvas). Cada Canvas (escena / retrato) necesita su propio normal-pass + holder + EdgeInk.
4. Escalar el threshold (no el grosor ni la opacidad) con la distancia → líneas crisp y limpias a todo zoom. Bajar opacidad da borrón gris; bajar grosor da líneas imperceptibles — ambos prohibidos como método de declutter.
5. Cualquier material nuevo que represente al personaje (skins, piezas, retrato) debe pasar por `applyToonBanding` y respetar las pupilas planas. Si se clona/scrubea un material (como en el disassemble), **re-aplicar el banding**.

---

## 8. Z-index (propuesto — refactor pendiente)

Hoy hay valores dispersos (1, 10, 11, 20, 30, 40, 45, **999990**, **9999999**). Adoptar esta escala de ahora en adelante y centralizarla en `tailwind.config.js → extend.zIndex`.

| Token | Valor | Uso |
|---|---|---|
| `base` | 0 | Contenido normal |
| `scene` | 1 | Hijos del canvas 3D |
| `hud` | 10 | HUD sobre canvas |
| `overlay` | 20 | Scanlines, vignette, overlays de escena |
| `dropdown` | 30 | Menús, popovers |
| `sticky` | 40 | Headers pegados, toggles flotantes |
| `modal` | 50 | Modales, diálogos |
| `toast` | 60 | Toasts, notificaciones |
| `tutorial` | 70 | Tutorial / onboarding bloqueante |
| `debug` | 100 | Overlays de desarrollo |

**Regla**: prohibido `z-[9999999]` en código nuevo. Migrar los existentes en cuanto se toquen.

---

## 9. Iconografía

### 9.1 Librería

**`@heroicons/react/24/solid`** como estándar único. No mezclar con lucide, feather, etc.

Iconos más usados: `PlayIcon`, `PauseIcon`, `XMarkIcon`, `ChevronLeft/Right/Up/DownIcon`, `BoltIcon`, `MusicalNoteIcon`, `PlusIcon`, `PencilSquareIcon`, `TrashIcon`, `EyeIcon`, `EyeSlashIcon`, `Cog6ToothIcon`, `InformationCircleIcon`, `UserCircleIcon`, `Bars3Icon`.

### 9.2 Tamaños canónicos

| Tamaño | Clase | Uso |
|---|---|---|
| xs | `w-3 h-3` (12) | Indicadores traffic-light |
| sm | `w-5 h-5` (20) | Inline con texto |
| md | `w-6 h-6` (24) | **Default en botones** |
| lg | `w-8 h-8` (32) | Botones destacados |
| xl | custom (≥40) | HUD grande, controles 3D |

### 9.3 SVG custom

Solo cuando Heroicons no tiene el concepto (ej. `GamepadIcon` en `App.jsx`). Mantenerlos inline en el componente que los usa o extraer a `src/components/icons/` si se reutilizan.

---

## 10. Responsive

### 10.1 Patrón base

Mobile-first siempre. Base = mobile, `sm:`/`md:` = desktop.

```jsx
// ✅
<div className="p-4 sm:p-6 text-lg md:text-xl">

// ❌ (desktop-first)
<div className="p-6 max-sm:p-4">
```

### 10.2 Hover en touch

```css
@media (hover: hover) and (pointer: fine) { /* hover styles */ }
```

Toda UI que dependa de hover debe envolverse en esto o usar `@media (hover: hover)` en el CSS. En JSX, preferir `group-hover:` de Tailwind (que respeta esto en muchos casos) + fallback touch.

Botones: agregar `[-webkit-tap-highlight-color:transparent]` cuando se necesite matar el highlight azul/gris en iOS/Android.

### 10.3 Detección de mobile en JS

- `mobileBreakpointPx = 640` como constante.
- Usar `window.matchMedia('(max-width: 640px)')` con listener, no `window.innerWidth` en render.

---

## 11. Accesibilidad (mínimos no negociables)

- Todo botón con solo ícono → `aria-label`.
- Contraste texto sobre glass: nunca `text-white/50` sobre `bg-black/40`. Mínimo `text-white/70`.
- Inputs: siempre `<label>` (visible o `sr-only`).
- Modal: `role="dialog"`, `aria-modal="true"`, focus trap, cierra con `Escape`.
- Animaciones: respetar `prefers-reduced-motion` en cualquier animación de loop o entrada > 300ms.

---

## 12. Deuda de diseño

Estado tras la primera pasada de refactor. Los items marcados ✅ están resueltos a nivel de *infraestructura* (tokens, componentes, presets existen). **La migración de sitios de uso existentes es trabajo incremental**: cualquier PR que toque un archivo afectado debe migrar las partes que toca.

1. ✅ **Tokens de color centralizados** — definidos en `tailwind.config.js → extend.colors` (section, terminal, feedback, power). Ver §1. *Pendiente:* migrar hex hardcodeados en componentes existentes a tokens `section-*`, `terminal-*`, `feedback-*`.
2. ✅ **Componente `<Button>`** — creado en `src/components/ui/Button.jsx` con variantes del §4.2 y focus-visible ring. *Pendiente:* migrar botones existentes.
3. ✅ **Escala z-index centralizada** — tokens `z-hud/overlay/dropdown/sticky/modal/toast/tutorial/debug` en `extend.zIndex`. *Pendiente:* reemplazar `z-[9999999]` existentes (ScoreHUD, GameToast, TutorialModal) por tokens.
4. ⏭ **App.jsx monolítico (227 KB)** — fuera de scope del sistema de diseño. Se trata como refactor estructural separado.
5. ✅ **CSS variables de fuente** — `--font-body`, `--font-display`, `--font-mono`, `--font-glitch` definidas en `:root` (src/index.css). `tailwind.config.js` las consume vía `fontFamily`. Clases `font-body`, `font-display`, `font-mono`, `font-glitch` disponibles.
6. ✅ **Easings como tokens** — `ease-expo-out`, `ease-expo-in`, `ease-smooth-bounce`, `ease-spring` en `extend.transitionTimingFunction`. *Pendiente:* reemplazar `cubic-bezier(...)` inline.
7. ✅ **Focus-visible ring** — implementado en el componente `<Button>` base. *Pendiente:* aplicar patrón equivalente a inputs de ContactForm.
8. ✅ **Glass presets** — clases `.glass-sm`, `.glass-md`, `.glass-lg`, `.glass-terminal` definidas en `src/index.css`. *Pendiente:* migrar usos inline.
9. ✅ **Breakpoint MusicPlayer documentado** — el default (`640`) coincide con Tailwind `sm`, pero en `App.jsx:3877` se inyecta `mobileBreakpointPx={1100}` al `<MusicPlayer>` (valor no-estándar, intencional por el layout del player). **No migrar a `sm` sin revisar layout**. Si se necesitan más thresholds custom, crear tokens explícitos.
10. ✅ **`tailwind.config.js` poblado** — colors, fontFamily, zIndex, transitionTimingFunction, boxShadow, keyframes, animation. Fuente de verdad sincronizada con este doc.

### Sombras también tokenizadas

Nuevos tokens Tailwind disponibles (§6.3):

- `shadow-elev-sm` → `0 2px 8px rgba(0,0,0,0.2)`
- `shadow-elev-md` → `0 3px 12px rgba(0,0,0,0.3)`
- `shadow-elev-lg` → `0 8px 32px rgba(0,0,0,0.4)`
- `shadow-glow-terminal` → glow + inset azul del terminal
- `shadow-glow-portal` → glow usando `var(--portal-color)`

---

## Changelog

### Nota Tailwind v4

- El `@config "../tailwind.config.js"` debe estar presente en `src/index.css` (después de los `@import`) para que v4 cargue los tokens del JS config.
- **`@apply` NO resuelve utilities custom** de `extend.*` (ej. `shadow-elev-lg`, `ease-expo-out`). Usarlas siempre como clases en JSX (`className="shadow-elev-lg"`), no dentro de `@apply`. Si se necesitan en CSS, inlinar el valor.

**2026-04-15 — Bootstrap del sistema de diseño**
- Creado `DESIGN.md` con auditoría completa.
- Poblado `tailwind.config.js` con tokens (colors, fontFamily, zIndex, easings, shadows, keyframes).
- Agregadas CSS variables de fuente en `:root` (src/index.css).
- Agregadas clases `.glass-sm/md/lg/terminal`.
- `.glitch-font` ahora consume `var(--font-glitch)`.
- Creado componente `src/components/ui/Button.jsx` con 6 variantes y 4 tamaños.
- Documentado breakpoint no-estándar del MusicPlayer (1100px).

**2026-04-22 — Button variants terminal-action / terminal-outline**
- Agregadas 2 variantes nuevas al `<Button>` para el lenguaje "terminal-cyberpunk" de GameOverModal, TutorialModal y similares.
- Nueva escala `TERMINAL_SIZES` (h-9/h-12 × text-sm monospace, `rounded` square corners).
- Migrados GameOverModal (2 botones) y TutorialModal (1 botón).
- PreloaderContent ENTER queda bespoke (usa `rounded-full` pill + glow — lenguaje distinto).

**2026-04-22 — GoldenTicketBadge (3D halo dorado)**
- Componente nuevo `src/components/GoldenTicketBadge.jsx`. Halo flotante arriba del retrato cuando el user tiene golden ticket activo. CSS 3D puro (`transform-style: preserve-3d` + doble face). Gira 360° en Y, con tilt `rotateX(-8deg)` para peso visual. Clip-path path SVG con notches circulares laterales (stub clásico). Gradient metálico 9 stops. Typography Georgia serif negrita. Respeta `prefers-reduced-motion`.
- Portal a `document.body` para no heredar transforms del retrato.
- Mide `[data-portrait-root]` cada frame (raf) → sincroniza posición + opacity con el retrato.
- Click dispara `shop-cart-open-request` → abre el ShopCart.

**2026-04-22 — Close button relocated (section exit)**
- Sacado de `CharacterPortrait.jsx` (donde era `absolute -top-[56px] left-1/2`) y movido a `App.jsx`.
- Ahora: `fixed top-4 left-4 md:top-10 md:left-10` dentro del mismo wrapper `translateY(marqueeHeight)` que el login top-right. El yellow ticker lo empuja igual. Mirror exacto del login mirror-izquierda.
- State `sectionCloseMode` + listener `portrait-exit-mode` en App.jsx ahora.
- Mobile camera button gateado a `section === 'home'` para no colisionar.

**2026-05-27 — Cel-shading del personaje (estilo toon Hi-Fi Rush / planetono)**
- Nueva firma visual del personaje 3D. Ver **§7.8** para el detalle completo y reglas duras.
- Archivos nuevos: `src/lib/toonBanding.js` (banding + helper de material), `src/lib/toonInkBuffer.js` (holder compartido de la textura/escala), `src/components/fx/CharacterNormalPass.jsx` (normal-render exclusivo del personaje).
- Modificados: `Player.jsx` (banding + envMapIntensity 0.5 en el clonado de materiales), `HomeScene.jsx` (key light + fill light + monta `CharacterNormalPass`), `PostFX.jsx` (effect `EdgeInk` = Laplaciano sobre el buffer de normales del personaje, con escala por tamaño en pantalla).
- 4 capas: banding de luz + iluminación dirigida + outline de hull (silueta) + ink lines de crease (Laplaciano sobre normales geométricas).
- Aprendizajes (qué NO funciona, documentado para no repetir): Sobel de luminancia de pantalla → entinta el banding de sombras; `fwidth(normal)` → revela los triángulos de la malla low-poly; detección por profundidad → el detalle no está en la geometría sino en pliegues; el grunge de la textura no tiene líneas. El ganador: Laplaciano sobre el buffer de normales geométricas, aislado al personaje.

**2026-05-27 (b) — Toon: retrato, piezas del desarme y pupilas planas**
- **Retrato** (`CharacterPortrait.jsx`): replicado el cel-shading completo (banding + key/fill light + outline + ink). Refactor: `EdgeInkEffect.jsx` y `CharacterNormalPass.jsx` ahora reutilizables (props `bufferRef` / `target` + `fixedScale`); `toonInkBuffer.js` agrega `portraitNormalTexture`. El doble del outline en el retrato quedó como feature intencional.
- **Desarme**: las rigid pieces conservan banding (re-aplicado en `createRigidMaterial` tras el scrub de `onBeforeCompile`) e ink (incluidas en `CharacterNormalPass` por `__disassembleOwned`). `envMapIntensity` de piezas bajado 1.8 → 0.5.
- **Pupilas**: material `Pupils` (roughness 0 = brillo) reemplazado por `MeshBasicMaterial` negro unlit en ambos personajes → negro plano sin highlight.
- **Bug fix orb mode**: `CharacterNormalPass` salta meshes con `opacity <= 0.1` → el personaje oculto en modo esfera (intro cayendo) ya no se entinta sobre la esfera.
- Detalle completo en **§7.8**.

**2026-04-22 — usePriceWithDiscount hook**
- `src/lib/usePriceWithDiscount.js` — hook para aplicar el descuento activo (golden ticket) a precios individuales. Aritmética en centavos (evita drift en MXN). Devuelve `{finalPrice, originalPrice, hasDiscount, pct}`.
- Consumido por `ProductCard`, `FeaturedArtifact`, `ProductInspectModal` → los precios del shop muestran `~~$orig~~ $discounted` cuando hay ticket activo, antes de entrar al cart.

---

## 13. Cómo usar este documento

1. **Antes de crear** un componente: buscar aquí su tipo (botón, card, input, modal).
2. **Al modificar** un componente: si el valor viejo contradice este doc, actualizar el código.
3. **Al agregar** un color, fuente, easing, z-index o animación nuevo: primero justificar en PR y **agregarlo aquí**. Si no está documentado, no existe.
4. **Cuando algo en §12 se resuelva**: mover el item a un changelog al final y marcarlo como hecho.

---

## Referencias rápidas (archivos clave)

- `src/App.jsx:138–150` — `sectionColors`
- `src/index.css:9–42` — Tipografía base y helpers
- `src/index.css:147–598` — Keyframes y animaciones UI
- `src/index.css:632–1080` — Estilos del MusicPlayer/vinyl
- `src/index.css:1088–1119` — `.rgb-border`
- `src/index.css:1128–1145` — Transiciones globales de `<button>`
- `src/index.css:1257–1302` — `.crt-scanlines`
- `src/components/ContactForm.jsx:153–421` — Patrón canónico de form terminal
- `src/components/TutorialModal.jsx` — Patrón canónico de modal
- `src/components/PowerBar.jsx` — Patrón de botón icónico con glow
- `src/components/MusicPlayer.jsx` — Patrón responsive + glass morphism
- `tailwind.config.js` — (actualmente vacío en `extend`, objetivo de refactor)
- `index.html:415–428` — Carga de fuentes

---

*Documento vivo. Cualquier divergencia entre código y este doc es un bug — o del código, o del doc. Arreglar el correcto.*
