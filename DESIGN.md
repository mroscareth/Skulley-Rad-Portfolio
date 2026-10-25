# DESIGN.md — Skulley Rad Portfolio

> **Golden book** de directrices de diseño.
> Este documento es la fuente de verdad para crear, auditar y refactorizar componentes.
> Todos los valores aquí reflejan el estado real del código (no aspiracional).
> Cuando algo nuevo se cree, debe alinearse con este documento. Cuando se detecte una divergencia existente, se registra en la sección **Deuda de diseño**.

---

## 0. Principios

1. **Editorial + toon en todo el sitio** (desde 2026-10-23): superficies planas, bordes sólidos de 2px, display en Luckiest Guy, cuerpo en Outfit, **cero glow, cero scanlines, cero lenguaje de consola**. Es la traducción 2D del cel-shading del personaje (§14.2). El sistema completo vive en **§14** (nació en la Store) y el CMS lo aplica en §15. El lenguaje "cyberpunk terminal" (CRT, prompts `>`, traffic-lights, monoespaciada, glow azul) **se eliminó del sitio** — ver Changelog 2026-10-23. Los efectos del **mundo 3D** (portales, shaders, partículas) no son UI y siguen su propia lógica.
2. **Color por sección**: cada sección del mundo 3D tiene un color identitario que tiñe portales, glows y transiciones.
3. **Mobile-first Tailwind**: base para móvil, `sm:`/`md:`/`lg:` para override.
4. **Sobre lienzo oscuro**: el fondo casi siempre es negro/azul muy oscuro. El color se usa en acentos, glows y bordes, no en superficies grandes.
5. **Monoespaciado prohibido en UI.** Cascadia solo para código literal (`<code>`/`<pre>` dentro de un post del blog) y para IDs/SKUs/slugs en el CMS. Cifras que cambian (puntajes, porcentajes, contadores) van en Outfit con `tabular-nums`.
6. **Transiciones expo**: animaciones de entrada/salida con curvas `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) y `cubic-bezier(0.4, 0, 0.2, 1)` (expo-in).
7. **Sin eyebrows** (regla dura, todo el sitio) — ver §0.7 abajo.

### 0.7 Prohibición de eyebrows

**Un "eyebrow" (o kicker) es el label chico en mayúsculas que se pone encima o al lado de un título para categorizarlo.** Ejemplos de los que se eliminaron: *"The archive"*, *"A note from the archivist"*, *"Piece of the month"*, *"4 pieces recovered"*, la metadata `OPENHOUSE 001 — 04/22/2026` del banner.

**Regla**: no se crean eyebrows nuevos. Nunca. Si el título no se explica solo, el problema es el título, no la falta de una etiqueta arriba. Un título grande que necesita un cartelito que lo presente es un título débil.

**Regla de mantenimiento**: **cada vez que se entre a trabajar una sección, revisar y eliminar los eyebrows que hayan quedado**, aunque no sean parte del ticket. No se acumulan.

**Qué NO es un eyebrow** (y por lo tanto sí se permite):

| Permitido | Por qué |
|---|---|
| Badge de categoría sobre la foto del producto | Taxonomía funcional del item, no presentación de un título |
| Archive ID | Metadata identificatoria del objeto |
| Aviso de stock bajo | Información de estado, cambia con los datos |
| Labels de una ficha técnica (`<dt>`) | Son la mitad izquierda de un par clave/valor |
| Chips de filtro | Controles, no rótulos |

El test: **¿esto existe solo para anunciar el título que viene abajo?** Si sí, es un eyebrow y se borra.

---

## 1. Colores

### 1.1 Paleta por sección (identidad)

Definida en `src/App.jsx:138–150` (`sectionColors`). Tiñe portales, bordes y glows de cada sección.

| Sección | Nombre | Hex | Uso |
|---|---|---|---|
| Home | Slate-950 | `#0f172a` | Fondo base / default |
| Section 1 — Work | Cyan | `#00bfff` | Portal + glow portfolio |
| Section 2 — About | Neon Green | `#39ff14` | Portal + acento about |
| Section 3 — Store | Magenta | `#e600ff` | Portal + acento global (botón primario, chip activo) |
| Section 4 — Contact | Neon Yellow | `#f5ff00` | Portal + acento contacto |
| Section 5 — Blog | Neon Orange | `#ff6b00` | Portal + acento blog |

**Regla**: dentro de su sección, la UI usa el color de la sección como acento **plano** (fill del botón primario con texto `#0a0510`, chip activo, borde de foco, barra de progreso), nunca como glow ni como fondo de grandes áreas. Lo global (tutorial, Mi Cuenta, carrito, preloader) usa el magenta. Los diálogos del juego de esferas usan el amarillo Argus `#f5ff00` (§14).

### 1.2 Paleta de sistema (Terminal UI) — eliminada

Se eliminó el 2026-10-23 junto con todo el lenguaje terminal. Ya no existen los tokens `terminal-*` en `tailwind.config.js` ni `shadow-glow-terminal`. Superficies y bordes: §14.3.

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
| **Cascadia Code** | 400, 600, 700 | **Solo código literal** (blog) e IDs en el CMS — nunca UI (§0.5) | `"Fira Code", "JetBrains Mono", monospace` |
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
- **leading-none (1)**: HUD numérico.

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

### 3.5 Marquee push (UI anclada arriba)

**Regla (no negociable):** cuando hay un **marquee de sección** visible en el top, TODA la UI/botón anclado arriba (login, customize, account, exit, HUD top, etc.) debe ir **DEBAJO** del marquee — el marquee los **empuja hacia abajo**. Nunca se empalman con el texto del marquee.

**Cómo:** App mide la altura del marquee (`marqueeHeight`, vía `ResizeObserver` sobre `marqueeRef`; **nunca se resetea a 0** para que el offset sobreviva las transiciones cuando el marquee se desmonta). Los grupos top se posicionan con ese offset:

- **Wrapper `translateY(marqueeHeight)`** (patrón canónico): el `top-right-group` (login/customize/account) y el botón close de sección viven en un wrapper que se traslada por `marqueeHeight`.
- **Offset directo**: elementos en overlays separados (ej. el botón **Salir** del `CharacterCustomizer`) reciben `marqueeHeight` por prop y se posicionan con `style={{ top: Math.max(marqueeHeight, 96) + gap }}` (el `Math.max` cubre el caso en que aún no se midió ningún marquee).

**Excepción — la tienda (`section3`, desde 2026-10-24) y Memorias (`section5`, lista y detalle, desde 2026-10-25):** el marquee **no acompaña el scroll**. Sube con el contenido hasta salir de pantalla, y los botones de arriba (salir o regresar, moneda, carrito, cuenta) suben con él hasta quedar **pegados al borde superior** (`top-4` / `md:top-10`) mientras se scrollea: son secciones largas y el espacio limpio deja ver las piezas y leer. Mecánica: el `onScroll` del section-scroll escribe `--section-marquee-off` (scroll topado a la altura del marquee) y el marquee y los dos wrappers de botones lo aplican con la propiedad CSS `translate` — no `transform`, que ya usan la entrada/salida y el empuje. Sin setState por frame. Qué secciones lo hacen lo decide `MARQUEE_SCROLLS_AWAY` en `App.jsx`. El resto de las secciones conserva la regla de arriba.

**Marquees no-sección** (ej. el de modo CUSTOMIZE) usan el mismo `.title-banner` → misma altura, así que reusar `marqueeHeight` es correcto. Si un marquee nuevo tuviera otra altura, medirlo y alimentar el mismo mecanismo.

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

Clases CSS del bloque "SHOP v2" en `src/index.css` (§14.5). Ya no hay componente `<Button>`: `src/components/ui/Button.jsx` se borró el 2026-10-23 (nadie lo importaba y sus variantes eran del sistema terminal).

| Variante | Uso | Clases |
|---|---|---|
| **primary** | Acción principal | `shop-btn shop-btn--primary` (magenta plano, texto `#0a0510`) |
| **primary de sección** | Acción principal dentro de una sección con acento propio | `shop-btn` + fill plano del color de la sección + texto `#0a0510` (ej. Contact `bg-section-contact`) |
| **primary de juego** | Diálogos del juego de esferas | `shop-btn argus-btn--primary` (amarillo `#f5ff00`) |
| **ghost** | Secundaria, cancelar, volver | `shop-btn shop-btn--ghost` (outline blanco) |
| **icon** | Cerrar / acción solo ícono | `w-11 h-11 rounded-full border-2 border-white/40 bg-black/50`, invierte a blanco en hover (patrón de `OrderStatusModal`) |
| **toggle (chip)** | Filtros, tabs, opciones | `shop-chip` con `aria-pressed` / `aria-selected` |

Alto y padding van por uso con Tailwind (`min-h-[48px] px-6 text-sm`). Hit target mínimo 44px.

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

- **Hover**: `translateY(-1px)` + `brightness(1.05)` (automático, §4.1); los botones de la Store abren el tono del fill.
- **Active**: reset + `filter: none`.
- **Disabled**: `opacity: 0.35` + `cursor: not-allowed` (`.shop-btn:disabled`).
- **Focus visible**: `outline` de 2px en el acento del contexto (magenta global, color de la sección dentro de una sección) con `outline-offset` de 2–4px. Es un anillo, no el borde.

### 4.6 Orden y color de las acciones (regla dura, desde 2026-10-24)

Pedido por Oscar: **la acción importante va de color y siempre a la derecha, al final**, cuando convive con otros botones. Aplica en todo el sitio y el CMS: pies de formulario y de modal, confirmaciones, encabezados de página, tarjetas, barras de herramientas.

1. **Una sola** acción principal por grupo, con fill de color: `shop-btn--primary` en el sitio (o el primary de su sección / de juego, §4.2), `a-btn--primary` en el CMS. Las demás van en ghost/secondary.
2. **Va al final**: el grupo se alinea a la derecha (`flex flex-wrap items-center justify-end gap-3`) y la principal es el último botón. Cancelar, Volver, Vista previa… van antes. Única excepción de alineación: dentro de una columna de texto editorial (la ficha de un proyecto) el grupo sigue el borde del texto, pero la principal igual va al final.
3. **El orden se arregla en el JSX**, no con `order` ni `flex-row-reverse`: así el orden del foco con teclado es el mismo que se ve (WCAG 2.4.3).
4. **Lo destructivo no es vecino de la principal**: Eliminar, Archivar, Cancelar pedido van como botón de ícono o separados en el extremo izquierdo (`mr-auto`). Excepción: en una confirmación cuyo propósito ES lo destructivo, ese botón es el principal (`a-btn--danger-solid` / rojo plano) y va al final.
5. **En tarjetas**: lo informativo (precio, estado) a la izquierda; a la derecha los botones de ícono y al final el de texto con color (el `+` de la tienda, "Editar" en el CMS).
6. **En móvil también va en fila**, alineada a la derecha. **Nunca un botón a todo lo ancho** ("se ve terrible", Oscar, 2026-10-24): si no cabe, el grupo envuelve y la principal sigue siendo la última.
7. **Mismo nivel, mismo tamaño**: las acciones secundarias de un grupo no son botoncitos aparte; van en el mismo renglón y a la misma altura que la principal, como botones de ícono (44–48 px) con `aria-label`. Ejemplo: en la ficha de proyecto, copiar enlace · LinkedIn · Facebook · y al final el pill de color.

---

## 5. Formularios e inputs

### 5.1 Input toon (referencia: `ContactForm.jsx`)

- Fondo `#150a1d`, borde sólido 2px `white/15`, `rounded-xl`, Outfit `text-lg`. En foco el borde pasa al acento de la sección; inválido, a rojo.
- `caret-color` en el acento de la sección.
- **Label real** (`<label htmlFor>`) en display u Outfit 700; la ayuda debajo como frase normal `text-white/55` conectada con `aria-describedby`. Nada de prefijos `> name:` ni `// descripción`.
- **Progreso** de un formulario por pasos: barra segmentada plana + "2 / 4" en Outfit 700 (`role="progressbar"`). Nunca `[1/4]`.
- **Opciones cerradas**: chips (radios nativos dentro de un `fieldset`), no "escribe 1, 2 o 3".
- **Errores**: frase en `text-red-400` dentro de `role="alert"`, sin prefijo `ERROR:`; `aria-invalid` en el campo.
- **Honeypot**: campo `name="company"` oculto (anti-spam).

### 5.2 Focus ring

`outline` de 2px en el acento (§4.5). En inputs, el cambio de color del borde acompaña, pero no sustituye al anillo cuando el foco llega por teclado.

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

### 6.2 Terminal container y traffic-lights — eliminados

Se eliminaron el 2026-10-23. Paneles y modales siguen el patrón de §14 (`OrderStatusModal` es la referencia): overlay `bg-black/70 backdrop-blur-xl`, panel `#0d0714` con borde 2px `white/12` y `rounded-2xl` (pantalla completa en mobile), título en `display-title display-title--md`, botón de cerrar redondo. Nada de traffic-lights ni títulos `M.A.D.R.E.@mausoleum:~/…`.

### 6.3 Sombras

| Tipo | Valor |
|---|---|
| Elevación sutil | `0 2px 8px rgba(0,0,0,0.2)` |
| Elevación media | `0 3px 12px rgba(0,0,0,0.3)` |
| Toast / overlay | `0 8px 32px rgba(0,0,0,0.4)` |

---

## 7. Efectos y estética

### 7.1 CRT Scanlines — eliminadas

`.crt-scanlines` se borró el 2026-10-23 junto con todo el chrome CRT. No se reintroduce.

### 7.2 Glitch font

Clase `.glitch-font` en ancestro fuerza todo el subárbol a Comic Neue. Usar para estados de error/glitch transitorio, nunca permanente.

### 7.3 RGB Border y portal glow — eliminados

`.rgb-border`, `.rgb-glow` y `.animate-portal-glow` no tenían usos y se borraron el 2026-10-23. El CTA sobre portales (`PortalCTA`) es una píldora plana con borde del color de la sección.

### 7.5 Animaciones de UI (entrada/salida)

Definidas en `src/index.css:305–400`. Usar clases, no reescribir keyframes.

| Clase | Efecto | Duración | Easing |
|---|---|---|---|
| `.animate-ui-enter-up` | translateY(32→0) + fade | 0.5s | expo-out |
| `.animate-ui-exit-down` | translateY(0→32) + fade | 0.25s | expo-in |
| `.animate-ui-enter-left/right` | translateX(±40→0) + fade | 0.5s | expo-out |
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

### 7.9 Sombra de silueta (forma real, borde duro cel)

> **Establecido 2026-05-29.** Reemplaza el viejo `BlobShadow` (disco con gradiente radial). El disco se sentía falso porque el personaje no es circular. Componente: `src/components/SilhouetteShadow.jsx`.

- **Técnica**: una cámara **ortográfica cenital** renderiza SOLO al personaje como mancha blanca a un render target (mismo patrón que `CharacterNormalPass`: swap a `MeshBasicMaterial` blanco → render a FBO → restaurar; oculta outline/orb/voxel). Un plano en el piso muestra ese RT como sombra negra → la sombra tiene la **forma real** del personaje y se deforma con la pose/animación.
- **Borde DURO (cel-shading)**: el fragment hace un box 3×3 (solo anti-alias) + `smoothstep(0.45, 0.55, coverage)` → filo nítido, plano, sin gradiente. Coherente con el banding toon del §7.8. **NO usar blur ancho/gradiente** — rompe el look cel.
- **Alineación (clave)**: cámara cenital con `up=(0,0,-1)` → X de pantalla ↔ +X mundo, Y de pantalla ↔ −Z mundo; un `planeGeometry` rotado `-PI/2` en X mapea igual (U↔+X, V↔−Z) → sin espejeos. Cámara y plano centrados en el jugador y del mismo tamaño `size`.
- **Costo**: un render extra del personaje por frame (RT chico: 256 desktop / 160 mobile). `opacity`/`size`/`resolution`/`blur` como props. Lift: al flotar/saltar la sombra se encoge y se atenúa.
- **Diales**: filo más seco → bajar `blur` o angostar el smoothstep; escalonado → subir `resolution`; recorte de brazos/piernas extendidos → subir `size`.

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

1. ✅ **Tokens de color centralizados** — definidos en `tailwind.config.js → extend.colors` (section, feedback, power; `terminal-*` se borró el 2026-10-23). Ver §1. *Pendiente:* migrar hex hardcodeados en componentes existentes a tokens `section-*`, `feedback-*`.
2. ✅ **Botones** — el componente `<Button>` se borró el 2026-10-23 (sin usos). Los botones son las clases `.shop-btn*` (§4.2).
3. ✅ **Escala z-index centralizada** — tokens `z-hud/overlay/dropdown/sticky/modal/toast/tutorial/debug` en `extend.zIndex`. *Pendiente:* reemplazar `z-[9999999]` existentes (ScoreHUD, GameToast, TutorialModal) por tokens.
4. ⏭ **App.jsx monolítico (227 KB)** — fuera de scope del sistema de diseño. Se trata como refactor estructural separado.
5. ✅ **CSS variables de fuente** — `--font-body`, `--font-display`, `--font-mono`, `--font-glitch` definidas en `:root` (src/index.css). `tailwind.config.js` las consume vía `fontFamily`. Clases `font-body`, `font-display`, `font-mono`, `font-glitch` disponibles.
6. ✅ **Easings como tokens** — `ease-expo-out`, `ease-expo-in`, `ease-smooth-bounce`, `ease-spring` en `extend.transitionTimingFunction`. *Pendiente:* reemplazar `cubic-bezier(...)` inline.
7. ✅ **Focus-visible ring** — implementado en el componente `<Button>` base. *Pendiente:* aplicar patrón equivalente a inputs de ContactForm.
8. ✅ **Glass presets** — clases `.glass-sm`, `.glass-md`, `.glass-lg` definidas en `src/index.css` (`.glass-terminal` se borró el 2026-10-23). *Pendiente:* migrar usos inline.
9. ✅ **Breakpoint MusicPlayer documentado** — el default (`640`) coincide con Tailwind `sm`, pero en `App.jsx:3877` se inyecta `mobileBreakpointPx={1100}` al `<MusicPlayer>` (valor no-estándar, intencional por el layout del player). **No migrar a `sm` sin revisar layout**. Si se necesitan más thresholds custom, crear tokens explícitos.
10. ✅ **`tailwind.config.js` poblado** — colors, fontFamily, zIndex, transitionTimingFunction, boxShadow, keyframes, animation. Fuente de verdad sincronizada con este doc.
11. ✅ **`.shop-halftone` amarillo — resuelto por eliminación.** La clase pintaba puntos `rgba(250,204,21,0.2)` en una sección declarada explícitamente sin amarillo. Al terminar la migración quedó sin usos y se borró junto con el resto del chrome CRT del shop.
12. ✅ **Store migrada completa** — los 8 componentes están en §14. No queda nada en lenguaje terminal dentro de `src/components/shop/`.
13. ⏭ **`#e600ff` hardcodeado en la Store** — el token `section-quests` existe en `tailwind.config.js`; los módulos nuevos siguen escribiendo el hex a mano (en clases arbitrarias de Tailwind y en el CSS del bloque SHOP v2). Migrar cuando se toquen.

### Sombras también tokenizadas

Nuevos tokens Tailwind disponibles (§6.3):

- `shadow-elev-sm` → `0 2px 8px rgba(0,0,0,0.2)`
- `shadow-elev-md` → `0 3px 12px rgba(0,0,0,0.3)`
- `shadow-elev-lg` → `0 8px 32px rgba(0,0,0,0.4)`

---

## Changelog

**2026-10-25 — CMS: esferita de "Pedidos por atender"**
- `.a-nav-count` (admin.css): esferita magenta con número junto a *Pedidos* en el menú (invertida sobre el item activo), en la esquina del botón del menú en celular (`--corner`) y como `(n)` en el título de la pestaña. Cuenta cada pedido una vez: por enviar (pagado con algo físico), disputa abierta y pagados desde tu última visita a Pedidos (`shop-orders.php?action=attention`, `ordersAttention.js`; se revisa cada minuto).
- En Pedidos: los nuevos llevan *Nuevo* esa visita; si entra uno mientras estás ahí, la lista se actualiza sola. Disputa: *Ya la atendí* en el pedido (`dispute` 1 = abierta, 2 = atendida; se puede regresar). El KPI pasa a *Disputas abiertas*.

**2026-10-25 — Memorias: marquee que se va con el scroll y nada debajo de los botones**
- Lista y detalle de memoria sueltan el marquee al scrollear, como la tienda (§3.5, `MARQUEE_SCROLLS_AWAY`).
- El buscador (celular y tablet, hasta `lg`) y la portada del detalle (hasta `xl`) arrancan debajo de los botones flotantes de arriba, que se les encimaban. Desde esos anchos el contenido ya cabe entre los dos grupos de botones.

**2026-10-25 — Carrito rediseñado con la anatomía de la tienda**
- Fuera los kickers en versalitas ("SHIP TO", "SUBTOTAL"), la caja del golden ticket dentro del panel, el archive ID como línea de detalle, la X chiquita para quitar y el "Checkout" a todo lo ancho. Ver "Anatomía del carrito" en §14.
- Barra de pago como la de compra del detalle (subtotal izquierda, acción derecha); quitar con bote; el "−" ya no borra; el motivo de un pago bloqueado se dice; el carrito vacío ofrece *Ir a la tienda*; Escape cierra el carrito sin sacarte de la sección; velo con blur; encima del grupo flotante de mobile.

**2026-10-25 — Modales: el blur del velo vuelve a funcionar; descripción por párrafos**
- `.shop-inspect-enter` ya no anima al contenedor del modal sino a sus hijos (el velo solo se funde; la tarjeta se funde y crece). La opacity animada del contenedor lo volvía en Chrome la raíz del `backdrop-filter` y el velo `bg-black/70 backdrop-blur-xl` oscurecía sin desenfocar. Arregla los seis modales que la usan (detalle de producto, pedido, Mi Cuenta, controles, fin de partida). Regla: **nunca animar opacity, filter, mask ni clip-path en un ancestro de un elemento con `backdrop-filter`**.
- `ProductDescription.jsx`: la descripción de producto (detalle y destacada) se corta en párrafos en cada salto de línea, con `1em` entre uno y otro. Antes era `whitespace-pre-line`: un Enter pegaba el párrafo y dos dejaban un renglón vacío entero.

**2026-10-25 — Store: la retícula sale del centro**
- `.shop-reticle` pasa de grid a flex con `justify-content: center`: una fila incompleta (hoy, con dos piezas) queda centrada en vez de dejar el hueco a la derecha. Cada card sigue midiendo una columna exacta (`--cols`: 1 / 2 / 3 / 4), así que la retícula uniforme no cambia (§14.6).

**2026-10-25 — Controles: modal estándar, sin bienvenida**
- `TutorialModal` pasa al modal estándar (`.site-modal--fit`): "Controles" + una línea de detalle (lo que decía la bienvenida), los cuatro controles a la vista en dos columnas que crecen por su lado (movimiento y patada; poder y cámara) y la barra con "Puedes volver a ver esta guía…" a la izquierda y "¡Entendido!" al final. Fuera el paginado de 5 slides y la slide de bienvenida sin controles (H06, H08).
- Textos corregidos: la patada se apunta con el mouse y se lee la línea del piso (ya no hay "abanico"), y en celular se empuja caminando (no existe botón de patada). Las reglas del juego vuelven a mencionar el Poder (E o ⚡).

**2026-10-25 — Juego de esferas: reglas nuevas, modales de Argus y portales cerrados en partida**
- `ZoidianDialog` (el trato de Argus) y `SphereGameModal` (las reglas) pasan al modal estándar (`.site-modal`) con la anatomía de Mi Cuenta: nombre en Outfit 700 + línea de detalle, contenido y barra fija con la acción amarilla al final. Argus en 3D grande a la izquierda como la foto de la pieza destacada (en mobile, banda arriba), con el contorno medido en pixeles (2.5px, `outlineWorld` en `ZoidianModel`) y antialias: con el grosor de la escena era una franja gruesa y dentada. La cámara del retrato se centra en la cabeza el primer medio segundo y luego se queda quieta (seguirla cada frame hacía que Argus pareciera flotar). Bajo "¿Trato?", **el premio como héroe**: una pleca amarilla que llena todo lo que sobra hasta los botones, con rayos de sol toon girando lento detrás del boleto dorado grande (`GoldenTicketArt`), destellos que parpadean y "¡Gana el boleto dorado!" en display grande + "35 % de descuento si lo consigues". En la barra de abajo, "¿Trato?" en amarillo pegado a la izquierda y los botones al final: entran juntos cuando Argus termina de hablar (un click en el texto lo completa de golpe, H03).
- **Boleto dorado rediseñado en toon** (`GoldenTicketArt` en `GoldenTicketBadge.jsx`, SVG): dorado plano con banda de sombra de corte duro y franja de brillo, contorno de tinta, borde blanco de sticker para despegar en fondo oscuro, "GOLDEN TICKET" en Luckiest Guy, talón perforado con el porcentaje y un destello toon. Vaivén suave (`.golden-ticket--idle`). Fuera el boleto metálico (degradados, Georgia, resplandor y giro 3D).
- Las reglas usan `.site-modal--fit` (mismo ancho, alto según el contenido con el estándar de tope): con alto fijo dejaban media caja vacía. Pasos a la izquierda, puntos a la derecha y la pleca amarilla de "¡Ojo!" al fondo a todo lo ancho; la barra de abajo solo lleva los botones.
- Reglas reescritas con la mecánica actual: "como el billar, pero a patadas"; pasos numerados (cargar con Espacio, apuntar con el mouse y leer la línea del piso, soltar, el Poder con E o ⚡, meter al portal de su color o empujar caminando en celular, portales cerrados en partida).
- Las tres esferas de puntos sin tarjetas: un renglón con divisores (nada de caja dentro de caja) y etiquetas en sentence case.
- Durante la partida los portales son metas, no puertas: no hay CTA de entrar, no sale el marquee al pararse ni al pasar sobre un portal, y la navegación, el CTA y entrar caminando avisan "Termina la partida para entrar a…" (una vez cada 3.5 s) en vez de cambiar de sección.

**2026-10-25 — Entrar: iris de caricatura, la transición de escena del sitio**
- Al dar Entrar el texto se va y queda Skulley; un iris (hoyo con línea de tinta blanca de 5px, el contorno toon) se cierra sobre su cara con curva lenta-rápida-lenta, se sostiene enmarcándola, toma aire y cierra de golpe. El home se monta detrás del negro y el iris se abre donde cae el personaje. Reemplaza al iris de 780 ms que aceleraba al final + la pantalla de carga de sección que entraba de golpe + el fundido.
- Pieza reutilizable: `src/lib/irisTransition.js` (`irisClose({x, y, r})` / `irisOpen({x, y})`, con foco opcional que registra la escena) y `IrisOverlay.jsx`, montado una vez en App arriba de todo. Si la escena siguiente tarda, la mascota camina en el negro. Movimiento reducido: fundido simple.
- Fuera `rewind.mp3` al dar Entrar: iba sincronizado con el iris viejo.
- Se probó una "decapitación" (la cabeza por delante del iris y cayendo, en 2D y luego en 3D con planos de corte) y se descartó: el encuadre cerrado del preloader saca el pelo por arriba y la cabeza sola se veía recortada.

**2026-10-25 — Modal estándar del sitio**
- `.site-modal` (`src/index.css`): el tamaño del detalle de producto pasa a ser el de todo modal de contenido. Pantalla completa en mobile; desde `sm` hasta 72rem × `min(100vh − 4rem, 56rem)`, alto fijo y scroll por dentro. Lo usan `ProductInspectModal` y `AccountModal` (que medía 760px). Los diálogos cortos (tutorial, estado de un pedido, confirmaciones) se quedan compactos: una caja enorme con tres renglones se lee vacía (H08).

**2026-10-25 — Mi Cuenta con la anatomía de la card de la tienda**
- `AccountModal`: el nombre en Outfit 700 (`.shop-detail__title`, no display) con el correo como línea de detalle; tabs como los chips de filtro de la tienda, sin íconos: **Logros · Ranking · Pedidos**.
- Barra fija abajo en las tres pestañas, como la de compra del detalle: tu mejor puntaje a la izquierda con la anatomía del precio (número grande, "PTS" chico) y la única acción de color a la derecha, *Cerrar sesión* (decisión de Oscar). Por H08 nada más en la pantalla va en color: *Rastrear envío* e *Ir a la tienda* van en contorno.
- **Logros** junta lo que antes estaba en Perfil y en Logros (el boleto y la skin dorada salían en las dos). Dos grupos: *Ganados* (con su fecha; el boleto dice si sigue activo o ya se canjeó) y *Por ganar* (la pista y el avance cuando se puede medir: puntos hacia 5,000 o 500, babosas encontradas, secciones visitadas). Dos columnas en desktop. La fecha de un logro nuevo se ve sin recargar.
- Ranking global y tus partidas recientes lado a lado en desktop. Una partida en −9,999 dice que fue la penalización por trampa (H02).
- Pedidos con la anatomía de la card: número + detalle (fecha · estado con punto de color), lo que llevaba, total a la izquierda y *Rastrear envío* a la derecha.
- Si falla la carga de pedidos o del ranking se dice y se puede reintentar (antes decía "Aún no tienes pedidos", H09). Números y montos en el formato del idioma de la página (H02).
- El boleto dorado ya no dice "descuento perpetuo": es un 35 % para una compra y se quema al pagarla. El umbral de la skin Pixel Art (500) vive en `achievementsCatalog.js`.

**2026-10-24 — Preloader: vuelve el glitch del nombre y cabe en monitores chicos**
- Regresa el glitch de bloques █▓▒░ con temblor en el título (SKULLEY RAD → OSCAR MOCTEZUMA en rosa → SKULLEY RAD, cada 3-6 s). Oscar lo pidió de vuelta: es el beat de canon de la pantalla, no adorno de terminal. Reemplaza al pop toon del 2026-10-23.
- El título va siempre en dos renglones con alto fijo (el glitch no mueve el texto) y su tamaño tiene dos topes: el ancho de la columna (MOCTE█UMA mide 5.7em) y 15vh. Texto de M.A.D.R.E. y espacios también atados al alto. Cabe completo desde 1280×600; si algo no cabe (celular acostado), arranca arriba con scroll en vez de cortarse.
- Pie en un renglón y en el flujo: idioma como control segmentado (una píldora, EN | ES) alineado con el título, y el estado de carga a su lado. Fuera el botón Omitir (el tecleo dura menos de un segundo; ESC sigue). Entrar lleva bocina (entra con sonido) y su hueco se reserva para que nada brinque al aparecer.
- La cámara del personaje sigue el alto de la pantalla (zoom = alto ÷ 1.55): la misma toma de cabeza y busto en cualquier monitor; en 1083 px de alto queda igual que antes.
- Sonidos propios para picarle los ojos (`src/lib/eyePokeSound.js`, sintetizados): boink de hule que sube de tono por piquete, plop de corcho con silbato de caída, y respawn de tres notas.

**2026-10-24 — Ficha de proyecto: texto que respira, galería a lo ancho**
- El texto dejó la columna del 25% (259 px a 1100 px, ~29 letras por renglón): ahora la ficha va arriba (título, descripción a 62ch con párrafos separados) y la galería abajo a todo el ancho, una pieza por renglón (decisión de Oscar: nada de imágenes en dos columnas).
- Acciones en un solo renglón y a 44 px: copiar enlace · LinkedIn · Facebook y al final el pill cyan del proyecto; en escritorio a la derecha del título. En celular los tres íconos se vuelven uno de Compartir (menú nativo del teléfono) para que el pill no baje de renglón. Nunca a todo lo ancho (§4.6).
- Insignias de Behance al ras del borde superior de la primera pieza, a la derecha. Sin conteo de imágenes (Oscar no lo quiere).
- Padding arriba y abajo para no chocar con regresar/carrito ni con música/menú; el retrato flotante se oculta en pantallas compactas mientras la ficha está abierta.

**2026-10-24 — CMS en español con la anatomía de la tienda**
- Todo el CMS en español mexicano (§15.6): menú, pantallas, avisos, confirmaciones, errores del servidor traducidos y textos para lector de pantalla (incluido el arrastre de dnd-kit). El documento se marca `lang="es-MX"` dentro del CMS.
- Proyectos, entradas de Memorias y productos en tarjetas `.a-item` (§15.5); canciones en filas con la misma lógica. Pedidos y usuarios siguen en tabla/lista.
- Cada pantalla con encabezado `.a-page-head` y, donde hay consecuencias o proceso, **Reglas** y **Pasos** verificados contra el backend.
- **Acción principal de color, a la derecha y al final** en todo el sitio y el CMS (§4.6). En el sitio: diálogos del juego, contacto, ficha de proyecto, personalizador y ThunderEat.
- Portadas de proyectos y entradas en cover (`.a-item__media--cover`); productos siguen en contain.
- Sistema: la línea de detalle ya no empieza renglón con "·" suelto; `.a-table` posicionada para que los `.sr-only` no ensanchen la página en móvil; las acciones del encabezado van a la derecha también en móvil.

**2026-10-24 — CMS: Access keys y aire en el sistema**
- Pantalla nueva **Access → Access keys** (`McpTokensPanel.jsx`): llaves por persona para el conector de Claude. La llave recién creada se muestra una vez en un bloque propio (`a-inset` con borde verde, encabezado + ayuda, campos para copiar, pasos numerados y la acción final tras un divisor); la tabla dice permiso, conexiones en Claude, creación y último uso. Sección fija "How someone connects" con la URL del conector (heurística 10).
- **`.a-alert` trae padding por defecto** (12 × 16 px): varios avisos quedaban con el texto pegado al borde. Las utilities de Tailwind siguen ganando.
- **`.a-section + .a-section` lleva `margin-top`** además del `padding-top`: el divisor quedaba pegado al último elemento de la sección anterior.
- Página pública de autorización del conector (`/oauth/authorize`, `api/mcp-oauth.php`): mismo lenguaje que la Store — panel plano con borde 2px, Luckiest Guy + Outfit, primario magenta, error en rojo con qué hacer.

**2026-10-24 — Card de producto: nombre, foto, precio y una acción**
- `ProductCard` se reordena como se decide una compra: nombre + línea de detalle arriba, foto en medio, precio a la izquierda y una sola acción a la derecha (§14.6). Fuera el archive ID y el badge sobre la foto, y el botón del ojo.
- La acción dice lo que va a pasar (*Agregar* / *Elegir* / *Agotado*) y confirma con *Agregado* ✓ cuando el carrito lo acepta.
- Criterio: las 10 heurísticas de Nielsen (guía *Cimientos de UX*, Roberto Jirón) como filtro de UI, sobre todo 01 (estado visible), 02 (palabras del usuario), 04 (consistencia) y 08 (minimalismo).
- **Pieza destacada como card** centrada (75rem) con la misma anatomía; fuera la ficha de seis filas y el botón "Inspect" (§14.6).
- **Tienda: el marquee no acompaña el scroll** y los botones de arriba quedan pegados al borde superior (§3.5).
- **Detalle de producto rediseñado** con la misma anatomía: barra de compra pegada abajo con el precio (total) a la izquierda y la acción a la derecha, como la card; opciones y cantidad con el valor elegido en el label; ficha al final sin "Recuperado" ni "Estatus"; galería sin autoplay y con miniaturas (§14.6).

**2026-10-23 — Adiós al lenguaje terminal en todo el sitio**
- El sitio entero adopta el lenguaje editorial + toon de §14 (antes era la excepción de la Store y el CMS). §0.1 y §0.5 reescritos.
- **Migrados**: `PreloaderContent` (fuera CRT, flyback, flicker y el glitch de bloques del nombre; la filtración "OSCAR MOCTEZUMA" queda como pop toon y la salida es un iris de caricatura sincronizado con `rewind.mp3`), `TutorialModal`, `PortalCTA`, `AccountModal`, `GameOverModal` (hermano de `SphereGameModal`, Argus), `ThunderEatMenu`, `ContactForm` (sigue por pasos, con inputs toon y chips), Memories/Blog (`Section5`, UI de `BlogTTS`; `GlitchImage` borrado), botones de Work (`Section1`), Codex (`Section6`), alerta de cheats y rebobinado (`App.jsx`), estados activos del HUD, `SkinToggleButton`, `ScoreHUD`, fuente del deck del DJ y acento del login de Privy.
- **Borrado**: `.crt-scanlines`, `.glass-terminal`, `.rgb-border`/`.rgb-glow`, `.animate-portal-glow`, `.vhs-*`, cursor de typewriter, `nav-glow`, los tokens `terminal-*` y `shadow-glow-terminal`/`glow-portal` de Tailwind, y `src/components/ui/Button.jsx`. El thumb de `.modal-scroll` pasa de azul a blanco.
- **Blog → Memories**: la sección 5 se llama MEMORIES / MEMORIAS en la UI. La URL sigue siendo `/blog` (enlaces y SEO existentes).
- **Nuevo**: medidor de la patada sobre la main nav (§14.10).

### Nota Tailwind v4

- El `@config "../tailwind.config.js"` debe estar presente en `src/index.css` (después de los `@import`) para que v4 cargue los tokens del JS config.
- **`@apply` NO resuelve utilities custom** de `extend.*` (ej. `shadow-elev-lg`, `ease-expo-out`). Usarlas siempre como clases en JSX (`className="shadow-elev-lg"`), no dentro de `@apply`. Si se necesitan en CSS, inlinar el valor.

**2026-10-20 — CMS: adiós terminal (§15)**
- El CMS adopta el lenguaje editorial + toon de la Store. Sistema en `src/admin/admin.css` (tokens `--a-*` y clases `a-*`), documentado en §15. Se eliminaron el CRT, los glows azules, la monoespaciada y el copy de consola.

**2026-10-20 — Store: retícula uniforme (§14.6)**
- Se retira el masonry: todas las cards de producto miden lo mismo (marco cuadrado + ficha de alto fijo). 1 columna en mobile, 2 desde `sm`, 3 desde `md`, 4 desde `xl`. Se borraron `WEIGHT_PATTERN`, `useMasonrySpans` y `.shop-w-*`.
- Las fotos no cuadradas quedan con paspartú `#150a1d` (`object-contain`), nunca recortadas (§14.7).
- Colores de categoría: salen del CMS (`product.categoryColor`), ya no de `CATEGORY_COLORS`.

**2026-08-09 — Store: rediseño modular toon (§14)**
- La Store deja el lenguaje terminal y pasa a **editorial + toon**. Es la excepción documentada a §0.1 y §0.5 — ver **§14** para el sistema completo.
- **Full-bleed**: `section3` sale del contenedor `max-w-7xl` de `App.jsx`; cada módulo del shop define su propio ancho.
- **Fondo**: `sectionBgOverrides.section3 = '#0a0510'`. El magenta deja de ser fondo sólido y pasa a acento (corrige una violación de §1.1).
- **Retícula irregular**: 12 col desktop / 6 tablet / 2 mobile, `grid-auto-flow: dense`, pesos `hero` 6×3 / `wide` 6×2 / `std` 3×2 con patrón determinista de 6.
- **Clases nuevas** en `src/index.css` (bloque "SHOP v2"): `.shop-display`, `.shop-kicker`, `.shop-panel`, `.shop-card`, `.shop-chip`, `.shop-btn(--primary/--ghost)`, `.shop-reticle`, `.shop-w-*`.
- **Hover simple**: solo `translateY(-6px)`. Se descartó el slab magenta desplazado + borde blanco (se veía offbrand); tampoco quedó variante `--accent`. Ver §14.2.
- **Eyebrows eliminados** y prohibidos de acá en adelante en todo el sitio — ver **§0.7**. Se fueron *"The archive"*, *"4 pieces recovered"*, *"A note from the archivist"*, *"Piece of the month"*, la metadata sobreimpresa del banner del hero y el `> INSPECTING:` del modal.
- **`ProductInspectModal` migrado**: fuera Cascadia, scanlines, halftone, `[LOST ITEM]`, `●REC`, `[CATEGORÍA]` y el `>_` del CTA. Título en display, ficha `<dl>`, variantes como `.shop-chip`, overlay corregido a `bg-black/70 backdrop-blur-xl` (§6.1). Ver §14.9.
- **`ShopCart` migrado**: deja el lenguaje terminal azul (`#0a0a14`, bordes `blue-500`, traffic-lights, `M.A.D.R.E.@mausoleum:~/cart`, `>_ CHECKOUT`) y pasa a SHOP v2. Título en display, ítems sobre divisores `white/10`, checkout como `.shop-btn--primary`. El chip de descuento conserva el color por rareza pero pierde el glow inset. **§6.2b ya no lo lista como ejemplo del patrón traffic-lights.**
- **`ArchiveToast` migrado**: pastilla plana con miniatura del producto en vez del toast verde con glow, `●` parpadeante, sweep de scanline y `>_ ADDED TO CART: <archiveId>`. Muestra el título del producto, no el ID.
- **Limpieza de CSS muerto**: eliminadas 8 clases del chrome CRT del shop que quedaron sin uso, y sus entradas en el bloque `prefers-reduced-motion`.
- **Bug corregido**: `.shop-display` fijaba `color: #fff` y, por empatar en especificidad con las utilities de Tailwind estando después del `@import`, ganaba siempre → `text-[#e600ff]` no pintaba (la firma "M.A.D.R.E." salía blanca). Ahora hereda del root.
- **Corte total del monoespaciado** en los 5 módulos: se van Cascadia, prompts `>`, `[BRACKETS]`, `>_`, `●REC`, `LIVE ARCHIVE`, scanlines y halftone. Verificado en runtime: 0 nodos monoespaciados dentro de `[data-shop-root]`.
- **Toon = filo duro, no neón**: se eliminan todos los glows (`0 0 24px`, `text-shadow`) sin reemplazarlos por nada. La Store no lleva sombras. Ver §14.2.
- Archivos: `ShopHero.jsx`, `WelcomeNote.jsx`, `FeaturedArtifact.jsx`, `ProductGrid.jsx`, `ProductCard.jsx`, `Shop.jsx`, `ArchiveTape.jsx`, `App.jsx`, `src/lib/appHelpers.js`, `src/index.css`.

**2026-05-29 — Personalización de color del personaje + sombra de silueta**
- **Customizer de color** (`src/components/CharacterCustomizer.jsx`, `src/lib/characterColors.js`): panel glass a la derecha (botón 🎨 `SwatchIcon` en top-right, solo HOME) para repintar ojos / esqueleto / pelo. Color pickers nativos + **Randomize** (HSL vívido + efecto de runas) + Reset. Live en todos los renders del personaje. Detalle del sistema en CLAUDE.md → Sistemas transversales.
- **Modo customize cinemático**: al abrir, `CameraController` hace un **barrido orbital** (interpolación polar: azimut por arco más corto + radio + altura) a una toma frontal con el personaje a la izquierda y la UI a la derecha; `Player` congela la locomoción (idle sigue); se ocultan los HUD que estorban. En mobile la cámara hace zoom-out (panel más angosto). Diales en `SilhouetteShadow`/`CameraController` (`CUSTOMIZE_*`).
- **Vórtice de runas (modo `spiral`)** en `RuneBurstParticles.jsx`: las runas brotan de los pies y **ascienden girando** con twinkle/wander tipo portal (no explosión). El modo `burst` radial sigue siendo el easter egg "POWEROFGOD" del cursed orb. Disparado por `CustomEvent('character-color-burst')` que escucha `HomeOrbs`.
- **Sombra de silueta** (`SilhouetteShadow.jsx`) reemplaza `BlobShadow` (disco). Forma real del personaje vía RTT cenital, borde duro cel. Ver **§7.9**.

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

## 14. Lenguaje del sitio: editorial + toon (nació en la Store)

> **Establecido 2026-08-09 en la Store; extendido a todo el sitio el 2026-10-23.** Lo que esta sección describe para la Store aplica a cualquier UI del sitio: preloader, modales, secciones, HUD. Si un componente necesita algo que no está acá, se agrega acá primero.

### 14.1 Por qué se dejó la terminal

Una tienda no es UI diegética: no es M.A.D.R.E. hablándole al usuario a través de una consola, es la superficie donde el portfolio se vuelve producto. El lenguaje terminal (prompts `>`, `[BRACKETS]`, Cascadia en todo el copy, scanlines sobre cada card) leía como panel de admin y competía con la foto del producto. La Store pasa a un lenguaje **editorial + toon**.

### 14.2 Traducción del cel-shading (§7.8/§7.9) a UI 2D

El look toon del personaje es **filo duro y superficie plana**, no neón. Aplicado a 2D:

| Capa 3D | Equivalente 2D en la Store |
|---|---|
| Outline de hull invertido | Borde **sólido uniforme** 2px, nunca hairline translúcido |
| Banding de luz (cuantización) | Fills **planos**, sin gradientes suaves |
| Ink lines de crease | Divisores duros `border-white/10` dentro de la ficha |
| Sombra de silueta borde duro (§7.9) | **Sin sombra.** Ver la regla de abajo |
| Pupilas unlit (sin specular) | Precios y títulos sin `text-shadow` ni glow |

**Regla dura**: en la Store, **cero `box-shadow` y cero glows**. Ni halos difusos ni slabs sólidos desplazados. Si algo necesita destacar, se destaca con **contraste, tamaño o posición en la retícula** — nunca con un efecto pegado al elemento.

**Única excepción — scrim de legibilidad**: `text-shadow` oscuro y chico (`0 1px 3px` / `0 2px 8px rgba(0,0,0,0.8)`) permitido **solo** en texto que cae encima de una imagen que no controlamos (metadata del banner del hero, archive ID sobre la foto del producto). Es un scrim funcional, no decoración: nunca de color, nunca sobre superficie plana. Hoy hay 7 nodos así en la Store y ninguno con `box-shadow`.

**Regla de hover**: el hover es **solo elevación** (`translateY(-6px)`). No cambia el color del borde, no agrega sombra, no invierte el fill. Se probó un slab magenta desplazado + borde blanco al hover y se descartó: leía offbrand y competía con la foto del producto. El focus-visible sí lleva anillo magenta (`outline`, no `border`) porque es un requisito de accesibilidad, no decoración.

### 14.3 Color

- Fondo de sección: `#0a0510` (`sectionBgOverrides.section3`). El magenta **dejó de ser fondo** — cumple §1.1.
- Acento: `#e600ff` (token `section-quests`), reservado a: fill del badge de categoría, slab shadow, botón primario, chip activo y una palabra del título display.
- Colores por categoría (se eligen en el CMS → `store_settings` → categorías; llegan como `product.categoryColor`) solo como fill del badge. Nunca amarillo.

### 14.4 Tipografía

| Rol | Recurso |
|---|---|
| Display de módulo | `.shop-display` + `--xl` / `--lg` / `--md` (Luckiest Guy, mismo stack que `.title-banner`) |
| Micro-label funcional | `.shop-kicker` (Outfit 700, `letter-spacing: 0.28em`) — **solo** badge de categoría, archive ID, stock bajo y labels de ficha. **Nunca como eyebrow** (§0.7) |
| Body y títulos de producto | Outfit (default) |
| Monoespaciado | **prohibido** |

`.shop-display` existe en vez de reusar `.title-banner` porque el banner impone `white-space: nowrap` y padding de marquee; en la Store los títulos envuelven.

### 14.5 Clases (todas en `src/index.css`, bloque "SHOP v2")

`.shop-display`, `.shop-kicker`, `.shop-panel`, `.shop-card`, `.shop-chip`, `.shop-btn` + `--primary` / `--ghost`, `.shop-reticle`.

No hay variante "destacada" de card en la retícula: todas son iguales (§14.6). La pieza principal vive en `FeaturedArtifact`, arriba del grid. Cualquier intento de marcar una card con borde o sombra vuelve al problema del §14.2.

### 14.6 Retícula uniforme — todas las cards del mismo tamaño

> **Reescrita 2026-10-20 por decisión de Oscar.** El masonry anterior (cards de distinto ancho y alto según la foto, patrón `hero`/`std`) se descartó: piezas más chicas que otras se leían como piezas de menor valor. Ahora **todas las cards miden exactamente lo mismo de ancho y de alto**.

- Columnas: **1 en mobile** (una card debajo de la otra), **2** desde `sm` (640px), **3** desde `md` (768px), **4** desde `xl` (1280px). Gap de 1rem → 1.25rem. Una fila incompleta sale **del centro** (flex + `justify-content: center`, desde 2026-10-25): con pocas piezas no queda hueco de un solo lado.
- **El alto lo fija la card, no la foto**: marco de imagen `aspect-square` + ficha con el título reservado a dos líneas (`line-clamp-2` + `min-h-[2.5em]`) y los botones pegados abajo (`mt-auto`). `align-items: stretch` y `h-full` en la card absorben cualquier diferencia residual (p. ej. un precio tachado).
- Una sola escala tipográfica para todas las cards. Ya no hay `WEIGHT_PATTERN`, `useMasonrySpans` ni clases `.shop-w-*`.

**Anatomía de la card (desde 2026-10-24)** — de arriba abajo, en el orden en que se decide una compra (heurística 08 de Nielsen: nombre, precio y una sola acción):

1. **Nombre** (`.shop-card__title`, Outfit 700, hasta 2 líneas) y **una línea de detalle** debajo (`.shop-card__meta`): punto del color de la categoría + categoría + edición ("Tiraje de 50", "Pieza única"). Si quedan menos de 20, el stock ("Quedan 5", rojo) reemplaza a la edición: es lo que cambia la decisión. Desde 2 columnas el encabezado reserva dos líneas de nombre para que las fotos de la fila arranquen parejas; en mobile no reserva nada.
2. **Foto** completa en `.shop-card__frame` (cuadrado, paspartú `#150a1d`, sin borde: es un control dentro de la card, no otra caja). Slideshow y cinta de agotado viven aquí.
3. **Precio** grande a la izquierda (`.shop-card__price`, moneda chica aparte) y **una sola acción** a la derecha (`.shop-card__cta`). El texto dice lo que va a pasar: *Agregar* (carrito), *Elegir* + chevron a la derecha (abre el detalle para escoger talla/color), *Agotado* (deshabilitado) y *Agregado* ✓ durante 1.8 s cuando el carrito de verdad lo aceptó (evento `shop-toast`). Nunca un chevron antes del texto: se lee como el prompt `>`.

Fuera de la card a propósito: el archive ID (vive en la ficha del detalle), el badge de categoría sobre la foto y el botón de "inspeccionar" (la card entera abre el detalle).

La línea de detalle, el precio, la acción y la cinta de agotado son componentes compartidos por card, detalle y destacada (`ProductMeta.jsx`, `PriceTag.jsx`, `AddButton.jsx`, `SoldOutTape.jsx`; clases `.shop-meta` y `.shop-price`): lo que se ve igual dice lo mismo (heurística 04).

**Pieza destacada (`FeaturedArtifact`, desde 2026-10-24)** — es **una card**, no un módulo a sangre: `.shop-card.shop-featured`, centrada con ancho máximo de 75rem. Misma anatomía: en mobile se apila igual que la card de la retícula (nombre → foto → descripción → precio + acción); desde `lg`, foto a la izquierda y nombre, descripción y precio + acción a la derecha, con el pie alineado al de la foto (áreas de grid, sin DOM duplicado). La foto va en marco con paspartú, sin borde (no caja dentro de caja). La card entera abre el detalle; ya no hay ficha técnica ni botón "Inspect".

**Detalle de producto (`ProductInspectModal`, desde 2026-10-24)** — la misma anatomía en grande:

- Columna derecha, en orden: nombre (`.shop-detail__title`, Outfit 700) + `ProductMeta`, descripción, opciones, **cantidad** y al final la **ficha** (Edición, Formato, Disponibles, ID de archivo). La ficha informa, no decide: va después. Fuera "Recuperado" (fecha de alta) y "Estatus" (lo dicen el botón y la cinta).
- Cada opción (y la cantidad) es un `fieldset` cuyo `legend` dice lo elegido ("Talla: **M**"): no hay que deducirlo del chip relleno (heurística 06).
- **Barra de compra** pegada abajo (`sticky bottom-0`), igual que el pie de la card: **precio a la izquierda** (`PriceTag size="lg"`, el total de lo que se va a agregar, sin desglose "2 × $42 c/u": el selector de cantidad ya lo dice) y **la acción a la derecha**. El botón dice lo que falta o lo que va a pasar: *Elige talla*, *Agotado* o *Agregar al carrito*. Decisión de Oscar (2026-10-24): el precio va abajo, junto a la acción, no debajo del nombre.
- **Galería sin autoplay** (cambiaba lo que estabas viendo sin pedirlo, heurística 03) y con **miniaturas** (`.shop-thumb`, la activa con borde magenta) en vez de puntos; flechas del teclado pasan de foto. En desktop la foto se queda fija mientras la columna derecha scrollea.
- z-index 999998: tiene que tapar el grupo flotante de música/menú de mobile, que si no se encima en la barra de compra.

### 14.7 Imágenes de producto — nunca se recortan

**Regla dura**: la pieza se ve **completa, con su proporción real y sin espacio alrededor**. Las tres cosas a la vez. Aplica a `ProductCard`, `ProductInspectModal`, `FeaturedArtifact` y la miniatura de `ShopCart`.

Recortar la pieza es esconder justo lo que se está vendiendo: el usuario tiene que poder percibir la obra entera antes de decidir. En una tienda de arte eso manda sobre el relleno del marco.

**Cómo se consigue (desde 2026-10-20)**: con la retícula uniforme (§14.6) el marco de la card es cuadrado fijo, así que la regla se cumple con `object-contain`: la pieza se ve completa y con su proporción; si no es cuadrada, el sobrante queda como **paspartú del color del marco** (`#150a1d`). Es el costo aceptado de que todas las cards midan lo mismo — se prefirió paspartú a recortar. Para que el grid se vea parejo, conviene subir las fotos de producto en formato cuadrado.

Consecuencias asumidas:
- `object-cover` sigue prohibido en cards, modal, featured y carrito.
- **Nada de zoom al hover sobre la imagen.** Escalar una foto que llena el marco exacto la recorta por las orillas. El hover de la Store es solo elevación (§14.2) y de eso se encarga la card.
- Únicas excepciones: **`ShopHero`**, cuyo banner sí es `cover` porque es fondo de sección, no una pieza a la venta. Y el avatar redondo de 40px de `ArchiveToast`: una máscara circular recorta esquinas por definición, y ahí la imagen es acuse de recibo, no ficha de producto.

### 14.8 Ancho

`section3` sale del contenedor `max-w-5xl` de App.jsx y corre **a sangre completa**; cada módulo define su propio ancho (`max-w-[2000px]` en grid y featured, `max-w-[1400px]` en la nota). El cap de 2000px solo actúa en ultrawide.

### 14.9 Pendiente

**Nada.** Los 8 componentes de `src/components/shop/` están migrados (2026-08-09): `ShopHero`, `WelcomeNote`, `FeaturedArtifact`, `ProductGrid`, `ProductCard`, `ArchiveTape`, `ProductInspectModal`, `ArchiveToast` y `ShopCart`. Todo el chrome CRT del shop (`.shop-scanlines`, `.shop-halftone`, `.shop-bracket`, `.shop-blink`, `.shop-scan-sweep`, `.shop-title-glitch`, `.shop-glitch-out`, `.shop-title-rgb`) quedó sin usos y se eliminó de `src/index.css`.

**`ShopCart` es global**: se monta en `App.jsx` y se abre desde cualquier sección, no solo desde la Store. Desde el 2026-10-23 todo el sitio habla el mismo lenguaje, así que ya no hay choque entre el carrito y la sección de fondo.

**Anatomía del carrito (desde 2026-10-25)** — la del detalle de producto, en panel lateral:
1. **Encabezado**: "Carrito" (`.shop-detail__title`) + una línea de detalle con cuántas piezas hay. Cerrar con el botón redondo estándar, Escape o clic en el velo (`/70` + blur, §6.1).
2. **Piezas** sobre divisores: miniatura completa (§14.7), nombre, una línea de detalle (la variante "M · Negro", o la de la tienda: categoría · edición / "Quedan 5"; "Agotado" en rojo), cantidad y precio del renglón (`PriceTag size="sm"`). Se quita con el **bote** (la X ya es "cerrar"); el "−" se detiene en 1 para que quitar nunca sea un clic de más (H05).
3. **Pie** en secciones separadas por divisor, sin cajas adentro: *Envío a* (chips de región + una línea con moneda y desde cuánto sale el envío) → *golden ticket* como renglón con su acción (*Usarlo* / *Guardar para después*) → **barra de pago**: subtotal a la izquierda (tachado y −% con ticket) y *Ir a pagar* a la derecha, nunca a todo lo ancho. Si no se puede pagar, el motivo va junto al botón (H09). La nota de ventas finales cierra en letra chica, Sentence case.
4. **Vacío**: qué pasa y una salida (*Ir a la tienda*; si ya estás en ella, solo cierra).

Va en z-index 999998, como el detalle de producto: el grupo flotante de música y menú de mobile tapaba *Ir a pagar*.

**Slideshow administrable desde el CMS** (2026-08-10). Dos ajustes en `ShopEditor` → `shop_settings`: `hero_slideshow` (el banner de arriba) y `card_slideshow` (la galería dentro de cada card). Tres modos cada uno:

| Modo | Comportamiento |
|---|---|
| `auto` | Rota sola. Default y comportamiento histórico. |
| `manual` | Flechas y dots, sin rotación automática. |
| `off` | Una sola imagen fija, sin controles. |
| `hidden` | **El módulo no se renderiza.** Solo para el banner: la sección entera desaparece, sin dejar hueco. En las cards se comporta como `off` — una card de producto sin imagen no es una card. |

`manual` existe porque **lo que estorba de una galería es el autoplay, no la galería**: con varias cards rotando cada quien por su cuenta, el movimiento compite con las piezas y cambia lo que estás viendo sin avisar — justo lo contrario de §14.7. Pasar de imagen a voluntad no molesta a nadie.

En `off` la galería se **recorta** a la primera imagen, no se esconde: dejar de pintar los controles nada más habría seguido cargando las 4 fotos de cada producto para no mostrar ninguna. Y el modo se lee una vez al montar (no hay live-reload del CMS), así que un cambio se ve al recargar.

Notas de implementación, por si sirven de patrón:
- El overlay usa `bg-black/70 backdrop-blur-xl`. El valor viejo (`/85`–`/90`) violaba §6.1 regla 2: con esa alpha el blur deja de notarse.
- Los selectores de variante son `.shop-chip` con **`aria-pressed`** (botones toggle), no `aria-selected` — ese queda para los filtros del grid, que sí son `role="tab"`. El CSS cubre ambos.
- La categoría dejó de ser rótulo encima del título y pasó a ser una fila más de la ficha (`Class`), para no reintroducir un eyebrow (§0.7).

### 14.10 Medidor de la patada (`KickChargeHud`)

> **Establecido 2026-10-23.** Primer elemento del HUD del home en el lenguaje toon.

Píldora centrada sobre la main nav (`.kick-hud`, `src/index.css`) que aparece solo mientras se carga la patada (barra espaciadora). Repite el valor de la barra 3D sobre la cabeza, pero más grande y legible, para soltar en la potencia que se quiere. La carga **cicla**: al llegar al tope se sostiene 0.22 s y vuelve a 0 (`KICK_FULL_HOLD` en `Player.jsx`).

- Superficie `#0d0714`, borde 2px `white/12`, cero sombra y cero glow (§14.2).
- Fill plano **cian `#22d3ee`**, `#d8fbff` en el tope. No es acento de interfaz: es el color de la patada en 3D (abanico del piso y barra sobre la cabeza), y el medidor tiene que leerse como el mismo valor.
- Cuartos marcados con cortes duros de 2px del color de la superficie (ink lines): referencia para soltar a 25/50/75%.
- Porcentaje en Outfit 700 `tabular-nums`. Sin label de texto: el ícono de la patada basta y una etiqueta encima sería eyebrow (§0.7).
- Solo desktop (`!isCompactUi`): en móvil no hay main nav ni carga por teclado.

---

## 15. CMS (`/admin`) — mismo lenguaje que la Store

> **Establecido 2026-10-20.** El CMS dejó el look de terminal CRT (scanlines, glow azul, Cascadia en todo, prompts `>` y `//`, `snake_case`) porque se leía genérico. Ahora usa el lenguaje **editorial + toon** de la Store (§14): es una herramienta de trabajo, no UI diegética.

### 15.1 Reglas duras

1. **Cero CRT**: nada de scanlines, flicker, vignette, glow, `text-shadow` de neón, cursor parpadeante ni traffic-lights.
2. **Cero monoespaciado** salvo `.a-code` para identificadores literales (IDs, SKUs, slugs, tokens, URLs de webhook).
3. **Copy normal**: sin prefijos `> ` ni `// `, sin `snake_case` ni `> loading...`. Títulos y botones en *Sentence case* ("Guardar", "Nuevo producto", "Producto destacado"). El idioma de la UI del CMS es **español mexicano** (§15.6; antes inglés).
4. **Sin eyebrows** (§0.7): el título de página va solo; la explicación va DEBAJO como `.a-subtitle`, nunca arriba.
5. **Un solo acento**: magenta `#e600ff` (`--a-accent`). Todo lo demás es blanco con alpha sobre superficies planas. Colores semánticos solo para estado (éxito, aviso, error, info).
6. **Bordes sólidos de 2px**, superficies planas, sin sombras. Hover de cards clickeables = elevación (`translateY`), nunca glow.
7. **Un solo nivel de contenedor — nunca caja dentro de caja.** Las secciones de una página NO van en card: son `.a-section` (título + contenido) y se separan con un divisor. Una caja con borde (`.a-card` / `.a-inset`) solo existe para algo que *es* un objeto: un ítem de lista, un KPI, un panel de gráfica en un dashboard, un editor (barra + texto en UNA caja), una tabla, una drop zone. Un modal cuenta como página: adentro aplican las mismas reglas. Dentro de una caja se subdivide con divisores (`border-t-2 border-white/10`) o espacio, jamás con otra caja; `admin.css` ya le quita el borde a `.a-empty` y `.a-alert` cuando caen dentro de una caja. Inputs, botones, chips y marcos de imagen son controles, no contenedores: pueden vivir dentro de una caja. Si aparece la tentación de envolver algo "para agruparlo", el agrupamiento lo da el título y el espacio.

### 15.2 Tokens (`.admin-root`, en `src/admin/admin.css`)

| Token | Valor | Uso |
|---|---|---|
| `--a-bg` | `#0a0510` | Fondo de página (mismo que la Store) |
| `--a-surface` | `#0d0714` | Cards, sidebar |
| `--a-surface-2` | `#150a1d` | Inputs, `.a-inset`, marcos de imagen |
| `--a-surface-3` | `#1d1027` | Tercer nivel (raro) |
| `--a-border` / `--a-border-strong` | `white/10` / `white/20` | Bordes de 2px |
| `--a-text` / `--a-text-2` / `--a-text-3` | `#fff` / `white/72` / `white/48` | Texto primario / secundario / ayuda |
| `--a-accent` (+ `-hover`, `-soft`) | `#e600ff` | Acción primaria, nav activo, foco, switches |
| `--a-success/warning/danger/info` | §1.3 | Estados |

En JSX: `text-white`, `text-white/70`, `text-white/45`, `border-white/10`, `bg-white/[0.04]`… y para el acento `text-section-quests` / `bg-section-quests` / `border-section-quests` (token de Tailwind) o `var(--a-accent)`. **Nada de `blue-*`/`cyan-*`/`sky-*`** como color de interfaz.

### 15.3 Vocabulario de clases

| Necesidad | Clase |
|---|---|
| Título de página | `.a-title` (Luckiest Guy) + `.a-subtitle` debajo |
| Título de sección | `.a-section-title` (Outfit 700) |
| Label de campo | `.a-label` · ayuda: `.a-help` · texto tenue: `.a-muted` · números/fechas: `.a-meta` |
| Encabezado de tabla / clave de ficha | `.a-kicker` |
| Sección de página (sin caja) | `.a-section` |
| Caja / caja sobre fondo / separador | `.a-card` · `.a-inset` · `.a-divider`; clickeable: `.a-card.a-card--interactive` — nunca una dentro de otra (§15.1.7) |
| Botones | `.a-btn` + `--primary` / `--secondary` / `--ghost` / `--danger` / `--danger-solid`, tamaños `--sm` / `--lg`; ícono: `.a-icon-btn` (`--sm`, `--danger`) |
| Inputs, selects, textareas | `.a-input` (`--sm` denso; `+ .a-code` para SKUs/slugs); checkbox: `.a-checkbox`; on/off: `<button role="switch" aria-checked className="a-switch">` |
| Miniatura cuadrada | `.a-thumb` > `img` (object-contain, nunca recorta) |
| Filtros / segmentados | `.a-chip` con `aria-pressed` o `aria-selected` (`.a-chip__count`) |
| Pestañas | `.a-tabs` > `.a-tab[aria-selected]` |
| Estado | `.a-badge` + `--accent/success/warning/danger/info/gold`; punto: `.a-dot` |
| Avisos | `.a-alert` + `--danger/success/warning/info` |
| Tablas | `.a-table` (`--hover`) |
| Vacío / carga | `.a-empty` · `.a-spinner` (`--sm`) |
| Scroll interno | `.a-scroll` |

Las clases viejas (`admin-card`, `admin-input`, `admin-btn-primary/secondary`, `admin-section-title`, `admin-comment`, `admin-error/success`, `admin-toggle-*`, `admin-scroll`, `admin-fade-in`) siguen definidas como alias del sistema nuevo para no romper nada, pero el código nuevo usa las `a-*`. `admin-terminal-font` ya no cambia la fuente.

### 15.4 Patrones

- **Cabecera de página**: `.a-title` + `.a-subtitle` a la izquierda, acciones a la derecha (`.a-btn--primary` para la principal). Las vistas de nivel superior (las del menú lateral) **no** llevan botón back; las sub-vistas (editor, detalle) sí, como `.a-icon-btn` con `ArrowLeftIcon`.
- **Formularios**: `.a-label` arriba del campo, `.a-help` abajo. Cada grupo es un `.a-section` (sin caja) con `.a-section-title` + ícono heroicon en `text-white/50`; entre grupos, el divisor que pone `.a-section + .a-section`. Sub-grupos repetibles (opciones de producto, zonas de envío, banners) son UNA caja `.a-inset` cada uno, y lo que vive dentro (tarifas, valores) son filas separadas por divisor, no cajitas.
- **Listas**: filas como `.a-card--interactive` o `.a-table--hover`; estados con `.a-badge`.
- **Gráficas**: paleta de sección (§1.1) — serie principal magenta `#e600ff`, luego cyan `#00bfff`, verde `#39ff14`, naranja `#ff6b00`, amarillo `#f5ff00`. Ejes y rejilla en `white/10`–`white/45`.
- **Shell**: sidebar `--a-surface` con borde derecho de 2px, ítems `.a-nav-item` (pill; activo = fill magenta con texto oscuro), grupos `.a-nav-group`.

### 15.5 Tarjetas, encabezados, pasos y reglas (desde 2026-10-24)

El CMS usa la **misma anatomía que la tienda** (§14.6) para todo lo que es una cosa (proyecto, entrada, producto, canción):

| Pieza | Clase | Qué lleva |
|---|---|---|
| Cuadrícula | `.a-item-grid` | Columnas automáticas de mínimo 17rem; gap 1rem → 1.25rem |
| Tarjeta | `.a-item` (+ `--interactive` si toda abre algo, `--muted` si está oculta/archivada) | Superficie plana, borde 2px, padding 1rem → 1.25rem |
| Encabezado | `.a-item__head` > `.a-item__title` + `.a-item__meta` | Nombre (hasta 2 líneas) y línea de detalle con puntos medios (categoría · estado · edición) |
| Imagen | `.a-item__media` | 4:3. Productos: `object-contain` con paspartú, nunca se recortan (§14.7). Proyectos y entradas: `.a-item__media--cover`, la portada llena el marco como en el sitio (pedido por Oscar, 2026-10-24) |
| Texto corto | `.a-item__body` | Opcional, una o dos líneas |
| Pie | `.a-item__foot` > estado/precio a la izquierda, `.a-item__actions` a la derecha | Primero los `a-icon-btn` (con `aria-label`), al final **una** acción con texto en `a-btn--primary a-btn--sm` (§4.6) |

Encabezado de página: `.a-page-head` (título `.a-title` + `.a-subtitle` que dice en una frase para qué sirve la pantalla; acciones en `.a-page-head__actions`, la principal en `a-btn--primary` y al final, §4.6).

Ayuda donde surge la duda (heurística 10), como `a-section` con su `a-section-title`, nunca en caja extra:
- **Pasos** (`ol.a-steps`): cuando la pantalla implica un proceso ("Cómo subir un proyecto").
- **Reglas** (`ul.a-rules`): límites y consecuencias ("Marcar como enviado le manda un correo al cliente").
Solo donde hacen falta: una pantalla obvia no lleva pasos.

### 15.6 Idioma: español mexicano (desde 2026-10-24)

**Todo el CMS va en español mexicano**, para humanos — lo usan los colaboradores de la tienda, no solo Oscar. Reemplaza la regla anterior de "UI del CMS en inglés". Tuteo (*Sube*, *Escribe*), frases cortas, sin traducción literal ni jerga (*parsear*, *setear*, *loguear*). Fechas y números con `es-MX`. Botones en tono de acción y en Sentence case: "Guardar cambios", "Nuevo proyecto".

Glosario — el mismo término en todas partes (heurística 04):

| Inglés | Español | | Inglés | Español |
|---|---|---|---|---|
| Save / Saving… / Saved | Guardar / Guardando… / Guardado | | Order | Pedido |
| Cancel · Close · Back | Cancelar · Cerrar · Volver | | Customer / buyer | Cliente |
| Edit · Delete | Editar · Eliminar | | Shipping | Envío |
| New project / post / product | Nuevo proyecto / Nueva entrada / Nuevo producto | | Carrier | Paquetería |
| Search · Filter · All | Buscar · Filtrar · Todos | | Tracking number | Número de guía |
| Upload · Drop files here | Subir · Arrastra aquí tus archivos | | Paid · Preparing · Shipped · Delivered | Pagado · En preparación · Enviado · Entregado |
| Retry · Loading… | Reintentar · Cargando… | | Cancelled · Refunded · Awaiting payment | Cancelado · Reembolsado · Esperando pago |
| Published · Draft | Publicada · Borrador | | To fulfill | Por enviar |
| Visible · Hidden | Visible · Oculto | | Dispute | Disputa |
| Active · Archived | Activo · Archivado | | Refund | Reembolso |
| Project · Cover · Gallery | Proyecto · Portada · Galería | | Discount code | Código de descuento |
| External link | Enlace externo | | Shipping zone | Zona de envío |
| Post (Memories) · Excerpt · Tags | Entrada · Resumen · Etiquetas | | Storefront | Portada de la tienda |
| Slug | URL (con ayuda: "la dirección de la página") | | Settings | Ajustes |
| Product · Variant · Option | Producto · Variante · Opción | | Analytics · Visits | Estadísticas · Visitas |
| Stock · Sold | Existencias · Vendidos | | Inbox · Message | Mensajes · Mensaje |
| Price · Compare-at price | Precio · Precio anterior (tachado) | | Users | Usuarios |
| Unique · Limited · Open edition | Pieza única (1/1) · Edición limitada · Edición abierta | | Log in · Log out | Iniciar sesión · Cerrar sesión |
| Physical · Digital | Físico · Digital | | Featured | Destacado |
| Category | Categoría | | Something went wrong | Algo salió mal. Intenta de nuevo. |

Nombres propios que no se traducen: Memories como nombre de la sección se dice **Memorias** en el CMS (en el sitio ES ya es MEMORIAS); Golden ticket, Stripe, Claude, SKU y MXN/USD se quedan igual.

## Referencias rápidas (archivos clave)

- `src/lib/appHelpers.js` — `sectionColors` y `sectionBgOverrides`
- `src/index.css` bloque "SHOP v2" — `.display-title`, `.shop-btn*`, `.shop-chip`, `.shop-card`, `.shop-panel`, `.shop-kicker` (§14.5)
- `src/index.css` bloque "ARGUS" — paneles y botones del juego de esferas
- `src/index.css` bloque "KICK HUD" — medidor de la patada (§14.10)
- `src/components/shop/OrderStatusModal.jsx` — Patrón canónico de modal
- `src/components/ContactForm.jsx` — Patrón canónico de formulario por pasos (§5.1)
- `src/components/SphereGameModal.jsx` / `GameOverModal.jsx` — Patrón de diálogo de juego (Argus)
- `src/components/MusicPlayer.jsx` — Patrón responsive (el deck es un objeto skeuomórfico, no UI plana)
- `tailwind.config.js` — tokens de color, fuentes, z-index, easings, sombras de elevación
- `index.html` — Carga de fuentes

---

*Documento vivo. Cualquier divergencia entre código y este doc es un bug — o del código, o del doc. Arreglar el correcto.*
