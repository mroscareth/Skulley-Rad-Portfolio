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
| Power/energy | `#f5ff00` | `power` (= `amarillo`) |
| **Amarillo del sitio** | `#f5ff00` (hover `#faff66`) | `amarillo` / `amarillo-claro`; en CSS `var(--amarillo)` / `var(--amarillo-claro)` |

El amarillo es uno solo (2026-11-10, pedido de Oscar para estandarizar): el de Argus y de Contacto, el fill de los botones principales y cualquier cosa amarilla de la interfaz (avisos, cinta de precaución, botón de poder, tutorial, estado "esperando pago"). Nada de `yellow-*` / `amber-*` de Tailwind ni otros hex amarillos en la UI. El oro sigue aparte porque es metal: el arte del boleto dorado (`#ffc21a`), la skin dorada, los destellos y partículas doradas, y el bronce del 3er lugar.

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
| `--vinyl-c1/c2/c3` | según la pista (CMS) | Bandas planas del disco de la consola de música (§14.11) |
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

El reproductor ya no tiene modo móvil (§14.11). Cualquier detector de mobile se alinea a **640**.

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
| **primary** | Acción principal | `shop-btn shop-btn--primary` (amarillo plano `var(--amarillo)`, texto `#0a0510`; magenta hasta el 2026-11-10) |
| **primary de sección** | Acción principal dentro de una sección con acento propio | `shop-btn` + fill plano del color de la sección + texto `#0a0510` (ej. Contact `bg-section-contact`) |
| **primary de juego** | Diálogos del juego de esferas | `shop-btn argus-btn--primary` (hoy idéntico al primary) |
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
- **Preloader**: desde 2026-11-12 es el rig del teléfono (`SkulleyFallRig`, en `DesktopScrollPreloader`), con su mismo look; el `PreloaderCharacter.jsx` con su tinta propia (`brilloEmisivo.js`) se borró con el preloader clásico.
- **Componentes reutilizables**: `src/components/fx/EdgeInkEffect.jsx` (effect, toma un `bufferRef`), `src/components/fx/CharacterNormalPass.jsx` (toma `target` + `fixedScale`), `src/lib/toonInkBuffer.js` (holders `characterNormalTexture` y `portraitNormalTexture`).

**Reglas duras del look toon:**
1. Las 4 capas van **juntas**. El outline da silueta, las ink lines dan el detalle interno, el banding da el sombreado plano, las luces dan el corte.
2. **Ink lines = Laplaciano sobre normales geométricas**, nunca Sobel de luminancia de pantalla (entinta el banding de sombras) ni `fwidth` (revela los triángulos de la malla low-poly).
3. El ink solo toca al **personaje** (buffer aislado vía `CharacterNormalPass`, uno por Canvas). Cada Canvas (escena / retrato) necesita su propio normal-pass + holder + EdgeInk.
4. Escalar el threshold (no el grosor ni la opacidad) con la distancia → líneas crisp y limpias a todo zoom. Bajar opacidad da borrón gris; bajar grosor da líneas imperceptibles — ambos prohibidos como método de declutter.
5. Cualquier material nuevo que represente al personaje (skins, piezas, retrato) debe pasar por `applyToonBanding` y respetar las pupilas planas. Si se clona/scrubea un material (como en el disassemble), **re-aplicar el banding**.

**Orden de pintado del hull (2026-11-05, Oscar: "el outline se funde con los portales"):** mundo opaco → color del hull → cuerpo → hull solo en profundidad (`_depth_outline`). Sin esto, lo que se pinta después le pasa encima porque el hull no escribe profundidad. Escribirla en el pase de color o pintarlo después del cuerpo mete líneas gruesas entre las piezas: el pase de profundidad va aparte y al final.

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
9. ✅ **Breakpoint MusicPlayer — resuelto por eliminación** (2026-11-02): la consola tiene un solo layout y ya no recibe `mobileBreakpointPx` ni `forceMobile` (§14.11).
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

**2026-11-10 — Un solo amarillo; los botones principales pasan a amarillo**
- Oscar: "quiero comenzar a estandarizar colores". El botón principal (`.shop-btn--primary`, incluido Entrar del preloader) deja el magenta y adopta el amarillo de Argus `#f5ff00`, que ya era el de Contacto. Token nuevo `--amarillo` / `amarillo` (§1.3).
- Todo lo amarillo de la interfaz pasa a ese tono: botón y barra de poder, tutorial, selector de skin, cinta de precaución de la tienda, avisos de Mi cuenta y del carrito, 1er lugar del ranking, indicador del boleto dorado, estado "esperando pago" y el vinilo amarillo del reproductor. El oro de los boletos y la skin dorada sigue aparte.
- Mismo día, segunda pasada: los chips marcados (`.shop-chip` con `aria-selected`/`aria-pressed`: idioma de Ayuda, filtros, pestañas de Mi cuenta, variantes) también van en amarillo, y `.shop-chip--argus` desaparece. Lo mismo en el CMS (`--a-primary` para `.a-btn--primary` y `.a-chip` marcado; `--a-warning`, badges y avisos en amarillo; los `amber-*` / `yellow-*` de los paneles pasan a `amarillo`), en el botón de los correos (`SkulleyMail::button`, con `ink()` para que la tinta sobreviva al modo oscuro de Gmail en iPhone), en el botón de pagar de Stripe Checkout (`button_color`) y en las páginas del conector (`/oauth/authorize`, `/subir`).
- El magenta se queda como acento: anillos de foco, navegación activa e interruptores del CMS, editores, la firma y la barra de cita de los correos, y la tienda como color de sección.

**2026-11-04 — Customize de escritorio sobre fondo infinito, con wallpaper 4K**
- Al entrar a Customize la trama se come al mundo desde los pies de Skulley y queda solo sobre el color elegido; al salir regresa, y la cámara ya no corta a la vista de arriba. Background junto a Salir. Wallpaper 4K abre un marco 16:9 y baja un PNG de 3840 × 2160. Ver §14.14.
- En el marco: texto gigante detrás de Skulley con la tipografía de la marquesina, y stickers que se arrastran, giran y escalan. La interfaz son cápsulas flotantes con herramientas, como un software de diseño.

**2026-11-04 — Panel de Personalizar en teléfono con las skins al frente**
- Fuera el título "Personalizar": "Elige una skin", chico y centrado. Skins de 60 y colores de 36 en una bandeja, sin filete. Se pasó de pantallas de 720 px a 600 px para el modo compacto: era el que se veía en un iPhone con Safari y por eso se sentía tan apretado.
- Los colores solo se cambian en Personalizada. Con otra skin la bandeja se guarda y ese espacio se lo queda Skulley, y la nota "Esta skin trae sus propios colores" desaparece.
- Los círculos salen de la rueda de Personalizada y regresan a ella volando (`vueloColores.js`). Ver §14.13.

**2026-11-04 — La home espera a Skulley al salir de Personalizar**
- Si iba despiezado, el texto y los botones entran después del despiece, para que se alcance a ver, y ya no de golpe. Si iba entero entran en cuanto se va el panel. Ver §14.13.

**2026-11-04 — Personalizar en teléfono: el wallpaper se configura y sale como se ve**
- Wallpaper 4K ya no abre una hoja con dos miniaturas: baja el panel y abre un marco con la proporción del archivo, con Skulley vivo adentro, reloj de muestra, Fondo y los chips Cuerpo y Cara. Crear hace el archivo y Guardar lo comparte. Ver §14.13.
- El archivo sale con el giro (antes siempre de frente), el zoom y el encuadre que dejaste, y con el fondo elegido (antes azul fijo). Fondo también va sobre el escenario, arriba a la derecha, y se recuerda en `skulley_wallpaper_fondo`. Personalizando, el escenario toma ese fondo y al cerrar regresa al de la historia.
- Lentitud reportada en Android: las miniaturas tardaban porque `toBlob` espera tiempo libre del hilo principal, y abrir la hoja hacía tres capturas sin pedirlas. Ahora el PNG se comprime en un Worker y hay una sola captura. Medido en Chrome con CPU a 4×: el archivo pasó de 5.8 s a 0.3 s; con GPU por software, de 8.2 s a 1.8 s y el mayor congelón de 1,377 a 358 ms. No probado en un Android real.

**2026-11-02 — Pantalla de Discman en la SR-90**
- La pantalla del reproductor pasa a Doto (matriz de puntos): título en 900; tiempo en 700 a 20px en naranja neón `--deck-lcd` `#ff8c2a` (primero en Light 300 y Oscar no lo distinguía); número de pista en chip invertido, relleno naranja con el número en negro, Doto 900; los 28 segmentos encienden en naranja y apagados quedan como fantasma del mismo naranja al 18 % (`--deck-lcd-off`), sin glow; la cabeza de lectura sigue en el color del vinilo. Doto se carga de Google Fonts (pesos 700 y 900) por el mismo `<link>` de las fuentes secundarias. Ver §14.11.
- Pausa y play de tornamesa: el plato frena hasta 0 en 0.6 s (`FRENO_S`) y arranca en 0.35 s (`ARRANQUE_S`), y el audio lo sigue de tono. Lo lleva un "motor" (`motorRef`, 0 a 1) en el loop del disco; mientras frena o arranca, el rate va al worklet por el camino del scratch. El worklet acepta arrancar a una velocidad dada (`start(when, offset, rate)`) para que el arranque no suene ni un quantum a velocidad normal. Al terminar de frenar se para el worklet y el low-pass vuelve a abierto.

**2026-11-02 — El glitch del nombre también en el teléfono**
- SKULLEY RAD de la primera pantalla del teléfono tiene el glitch del preloader (bloques █▓▒░, temblor y OSCAR MOCTEZUMA en rosa ~400 ms, cada 3-6 s). El efecto salió de `PreloaderContent` a `src/components/GlitchName.jsx` + `.glitch-name` / `@keyframes glitchNameShake` en `index.css`, compartido; escritorio no cambia. El estado vive en el título: cada paso repinta solo el título, nunca la pantalla entera.
- En teléfono el título sigue llenando la columna; solo mientras se rompe baja al tamaño en que cabe MOCTE█UMA (`--glitch-cuerpo`, lo mide `useTitulosAjustados`), con alto fijo de dos renglones para que nada de abajo brinque.

**2026-11-02 — Personalizar en el teléfono: rediseño y zoom con dos dedos**
- Rediseño "pixel perfect" del modo personalizar (§14.13, Medidas): todo botón con fondo (magenta los de texto; los de ícono, los que ya tiene el sitio), círculos de 56 en las dos filas, nombres de skin sin cortar, orillas en línea arriba y abajo, y el panel de alto fijo. El dado solo sale con Personalizada. Guardar wallpaper deja de ir a lo ancho (§4.6.6).
- Zoom con dos dedos (hasta 4×, anclado entre los dedos, con paneo) y con la rueda del mouse; botón Restablecer vista. Al salir, la cámara se acomoda (de frente, sin zoom ni paneo) antes de que la historia regrese.
- Mismo día, acomodo de Oscar: Listo se vuelve una tachita de cerrar arriba a la izquierda, el dado pasa al lado de los colores, Wallpaper 4K baja al pie del panel (centrado) y Restablecer vista pasa a la derecha. Después, el panel se compacta (aire de 12, círculos de 48, el aviso sin espacio reservado) para que Skulley se vea más grande. Los botones de ícono dejan el blanco que se había inventado ("no estás revisando", Oscar): cerrar, restablecer y el dado son los flotantes de vidrio oscuro del sitio (las clases de la X de las secciones y la hamburguesa). El dado pasó un rato por el vidrio azul del Aleatorio de escritorio y Oscar lo prefirió como la X.

**2026-11-02 — Personalizar a Skulley en el teléfono**
- Botón nuevo en la barra de abajo de la home de teléfono que abre `MobileCustomizer`: Skulley se rearma esté donde esté la historia, se gira con el dedo y se pinta con cuatro skins (Personalizada, Slime, Vacío, Aceite) y una paleta. Al cerrar regresa exactamente a donde iba. Ver §14.13.
- `randomVividColor()` y `hslToHex()` pasan a `characterColors.js`; el chip de skin del panel de escritorio pasa a `SkinChip.jsx` y lo comparten los dos personalizadores.
- La sección de color del panel de teléfono pasó a un `ColorWell` por parte (sin paleta) y Skulley va centrado en el espacio libre. El control de color de escritorio pasa a `ColorWell.jsx`.
- Más luz en el personaje del teléfono (`SkulleyFallRig`): key 1.7 → 2.0, relleno 0.38 → 0.65 y ambiente 0.5 → 0.85; se veía oscuro, como si solo lo alumbrara el rim. Oscar pidió un poco más: key 2.25, relleno 0.8 y ambiente 1.05.
- Wallpapers 4K desde el personalizador del teléfono: cuerpo completo y el primer plano de la home, 2160 × 4680 PNG con la skin y los colores del momento. Ver §14.13. `EdgeInkEffect` y `CharacterNormalPass` aceptan una captura (`target.captura`) que dibuja más grande que el canvas por un cuadro.
- El contorno y las líneas de tinta del personaje del teléfono (`EdgeInkEffect` en `SkulleyFallRig`) ahora toman el color de línea de la skin (`skinLineColor`), como escritorio y el retrato: Vacío las lleva blancas.

**2026-11-02 — La skin activa en el preloader y en el teléfono**
- El preloader de escritorio (`PreloaderCharacter`) y el personaje de la home de teléfono (`SkulleyFallRig`, y el cartel `MobileCharacterPoster`, hoy sin uso) solo tomaban los colores del customizer: con una skin de shader salía el Skulley "Personalizado". Ahora pasan por `src/lib/characterSkin.js`: shader de la skin en cuerpo y pelo antes del banding (como Player y el retrato, marcados como canvas sin bloom) y los colores con las reglas de la skin (forzados en vacío y slime; solo ojos y orb en la dorada). El teléfono no monta `useSkinSystem` y enciende la skin guardada al montar el personaje. Probadas en el preloader: lava, vacío, slime, holograma y dorada; en el teléfono, slime.
- `useSkinSystem` ya no regresa la skin a base antes de saber qué tiene el usuario (`ownershipKnown`: logros cargados y, con sesión, el perfil). Con sesión, el set de logros arrancaba vacío y cada recarga reseteaba y guardaba "base" antes de que llegara del servidor.

**2026-11-02 — Toasts que se actualizan en su lugar**
- `gameToast({ key })`: si ya hay un toast visible con esa llave, cambia su texto en su lugar, reinicia su tiempo y da un brinquito (`.animate-toast-bump`, 240ms spring) en vez de apilar otro. Lo usa el aviso del modo DJ (`key: 'dj-mode'`): abrir y cerrar el reproductor ya no deja "DJ Mode on" y "DJ Mode off" uno debajo del otro. De paso, el español dice "Modo DJ encendido / apagado" (antes salía en inglés en los dos idiomas).

**2026-11-02 — Tooltips propios**
- `TipLayer` reemplaza al `title` nativo con una burbuja de cómic (blanca, borde de tinta, piquito); se pide con `data-tip`. Ver §14.12. El mismo día pasó todo el sitio y el CMS (108 `title`; ver §14.12). Arrancó en el reproductor: sus teclas de función dicen solo su nombre (fuera "Media velocidad: activada" y compañía, seis cadenas por idioma) y las del transporte estrenan tooltip.

**2026-11-02 — Reproductor rediseñado: consola SR-90**
- Fuera el deck de tornamesa y sus 3 skins (technics, madera 70s, neón cyber; la llave `musicDeckSkin` de localStorage ya no se lee), el brazo, la caja de discos y el código muerto (`VinylCasesColumn`, `SmallCover`, `.music-pill`, `.vinyl-case*`): unas 1,300 líneas de CSS. Ver §14.11.
- Sin props de breakpoint (`forceMobile`, `mobileBreakpointPx`, `navHeight`): un solo layout. El audio (worklet de scratch, ducking del TTS, pausa con videos) no cambió.
- Mismo día, ajustes de Oscar: play deja el magenta y se vuelve botón con seguro (hundido en gris oscuro mientras suena); las funciones de las esquinas y el botón de la lista se hunden igual, sin color; la cabeza de la barra de avance toma el color del vinilo; la marca pasa a SR-90 y la cabeza gana una rejilla de bocina.

**2026-10-25 — Mi Cuenta → Descargas como cards de la tienda**
- Cada compra digital es una `.shop-card` con la anatomía de §14.6: nombre + línea de detalle (pedido · fecha), foto completa en `.shop-card__frame`, los archivos como renglones (etiqueta PDF / ZIP, nombre, tipo y peso) y abajo una sola acción de color: *Descargar*, o *Descargar todo* si son varios (cada renglón conserva un botón de ícono para bajar solo ese). `.shop-card--static` quita la elevación del hover: la card no se abre.
- **Excepción de Oscar: el botón de la card va a lo ancho.** Y sin contador de archivos en el pie ("no amontones cosas": los renglones ya lo dicen).
- Estados con las heurísticas: *Preparando…* con spinner y *✓ Descargando* + "Tu descarga empezó" (H01); "Te quedan 2 hoy" antes del tope y *Mañana* al llegar, en vez de un botón apagado (H05); compra en pausa con la cinta de `SoldOutTape` sobre la foto y a quién escribir (H09); estado vacío que explica que los archivos viven en la cuenta con la que se compró (H10).

**2026-10-25 — Página de ayuda de la tienda (/help)**
- Página aparte, sin escena 3D, en el lenguaje de la tienda: barra con "Volver a la tienda" e idioma (chips), título display, "Lo esencial" (las cinco reglas que más pesan, en `dl` con divisores, sin tarjetas), índice pegado al costado en escritorio y en chips arriba en celular, secciones de preguntas y respuestas separadas por divisor. La tabla de envíos se arma con las zonas del CMS.
- `HelpLink` (subrayado discreto + ícono de "abre aparte", en otra pestaña para no perder el carrito ni la escena): en el carrito antes de pagar, la ficha del detalle (nuevas filas *Sale en* y *Devoluciones*), el final de la tienda, Mi Cuenta → Pedidos y el estado del pedido.

**2026-11-05 — Argus: el premio en una banda y el retrato iluminado**
- El premio de `ZoidianDialog` deja de crecer con el espacio: `.argus-premio` es una banda horizontal de 7.5rem pegada abajo, con el boleto a la izquierda. Lo que cede en pantallas chicas es el texto de Argus, que corre solo. Oscar: "su tamaño variable" y "en pantallas pequeñas se pierde".
- El retrato va sobre el azul de home (`#022dd6`) con key cálida, tres bandas de toon y rim cálido de filo duro (`PORTRAIT_TOON`, solo en el retrato: la escena no cambia). Un rim frío se perdería contra el azul.

**2026-10-25 — Silver Ticket y pestaña Premios de Argus**
- Dos tickets: **Silver** (3,000 pts, 10 %; empezó en 5,000 y bajó el mismo día) y **Golden** (9,999 pts, 35 %, 10 al mes en todo el sitio); uno por cuenta al mes (reglas en `game-tickets.php`). La skin dorada se quedó en 5,000.
- Fuera "ventas finales / sin devolución" de la cinta de la tienda (`ArchiveTape`) y del pie del carrito: sí puede haber reembolsos.
- `TicketArt` (`GoldenTicketBadge.jsx`): el mismo boleto toon con otro metal; el Silver es gris plateado plano (`#DCE2EA` / sombra `#A3ADBB` / brillo blanco) con la palabra SILVER. Nombre de cada ticket en su color (`#FFC21A` / `#DCE2EA`).
- Argus (`ZoidianDialog`): pestañas **El trato / Premios** con `.shop-chip--argus` (activa en amarillo Argus). El banner del trato ya dice cómo se gana ("35 % de descuento · haz 9,999 puntos") y cuántos quedan en una pastilla. Premios: los dos boletos en su paspartú (columnas, no tarjetas), cuánto da y cómo se gana cada uno, el contador `.ticket-stock` (un talón por Golden del mes; los ganados quedan solo en contorno) y las reglas. Ir a Premios termina el typewriter para que el pie ya tenga los botones.
- Fin de partida: muestra el boleto ganado (o "Tu Silver ahora es Golden") y, si no hubo premio, por qué (ya tienes uno sin usar, ya ganaste el del mes y desde cuándo puedes otro, límite de la conexión).
- Carrito, Mi Cuenta, ranking y CMS (Usuarios, Pedidos: `.a-badge--silver`) dicen qué ticket es.

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
- **2026-11-05** (Oscar: "que la animación sea igual, pero con el efecto para homologar"): el mismo ritmo, pintado con la retícula de la trama (`src/lib/irisTrama.js`). Va en el azul del home, porque en negro no se vería sobre el preloader. Sin línea de tinta: Oscar probó una banda de puntos blancos y la descartó. El regreso de una sección a home usa este mismo iris con el color de la sección: su fondo es el iris y se abre sobre Skulley. Probamos cubrir en azul y abrir después: se sentían dos momentos. Las secciones también se revelan con este iris, desde el color de su preloader: la cuadrícula se eliminó (Oscar: "quiero deprecarla").
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
3. **Pie** en secciones separadas por divisor, sin cajas adentro: *Envío a* (chips de región + una línea con moneda y desde cuánto sale el envío) → *golden ticket* como renglón con su acción (*Usarlo* / *Guardar para después*) → **barra de pago**: subtotal a la izquierda (tachado y −% con ticket) y *Ir a pagar* a la derecha, nunca a todo lo ancho. Si no se puede pagar, el motivo va junto al botón (H09). Sin nota de "ventas finales": sí puede haber reembolsos (2026-10-25).
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

### 14.11 Consola de música (`MusicPlayer`, "SR-90")

> **Establecido 2026-11-02.** Reemplaza al deck de tornamesa con 3 skins (technics, madera 70s, neón), que se borraron. Inspirada en el hardware de Teenage Engineering (TP-7), sin copiarlo: la misma idea de objeto (cuerpo plano, un plato que domina, pantalla negra, teclas en tira) dicha con las reglas de §14.

- **Cuerpo plateado plano** `#c6c6c9` (pedido de Oscar, por la versión gris del TP-7). Es la única superficie grande clara del sitio, y es a propósito: el deck es un objeto encima de la escena, no un panel. Borde 2px `rgba(10,5,16,0.22)`, `border-radius: 28px`, cero sombra, cero glow, cero degradado: el "metal" es un fill plano. Texto e íconos en tinta `#0a0510`.
- **Pantalla** negra (`#000`, como OLED) a todo lo ancho, leída como la de un **Discman** (pedido de Oscar): todo en **Doto**, la fuente de matriz de puntos (Google Fonts, pesos 700 y 900), sin agregar nada (ni scanlines, ni glow, ni marco). Título en Doto 900 blanco (corre en loop solo si no cabe; quieto con `prefers-reduced-motion`; el `ResizeObserver` también mira el texto, así que vuelve a medir cuando llega la fuente). Tiempo en Doto 700 a 20px en naranja neón `--deck-lcd` `#ff8c2a` (en Light los puntos se perdían), con el total en el mismo naranja. Número de pista en chip invertido: relleno naranja y el número en el negro de la pantalla, Doto 900 (`01`). Barra **segmentada** de avance (28 segmentos) encendida en naranja; apagados quedan como fantasma del mismo naranja al 18 % (`--deck-lcd-off`), como en un LCD. El último encendido es la cabeza de lectura y va en el color del vinilo de la pista, `--vinyl-c1`, que vive en la raíz del deck (con el vinilo naranja se confunde con el resto: se acepta).
- **Plato**: el disco llena el cuadro y se pinta en **bandas planas** del color de vinilo de la pista (`--vinyl-c1` afuera, `--vinyl-c2` junto a la etiqueta, una ranura de tinta), con la portada como etiqueta. Lo parte una **línea de tinta** horizontal en el marco del disco: la portada queda siempre derecha respecto a ella y giran juntas (pedido de Oscar). Rotulado impreso "33⅓ · RPM" (16⅔ a media velocidad). El scratch enciende el segundo LED y el borde del pozo sin re-render (atributo `data-scratching`).
- **Funciones en las esquinas del plato** (44px, `aria-pressed`): media velocidad, aleatorio, repetir pista y descargar. Encendida = hundida como play (`--deck-key-down`, ícono 1px abajo). **Ninguna tecla del deck lleva color** (pedido de Oscar): el magenta solo queda en el LED de play, el anillo de foco y la pista que suena en la lista.
- **Transporte**: tira de tres teclas unidas por costuras de 2px (anterior · play · siguiente). **Play es un botón con seguro, sin color** (pedido de Oscar): en pausa es una tecla más; mientras suena se queda hundida en `--deck-key-down` `#a9a9ad`, con el ícono 1px abajo. Excepción consciente a §4.6: el transporte sigue el orden universal de un reproductor; no es un grupo de acciones de formulario. Las teclas no flotan al hover (§4.1): se hunden 1px al presionar. **Pausa y play de tornamesa** (pedido de Oscar): la tecla cambia al instante, pero el plato no; al pausar frena hasta 0 en 0.6 s y el sonido baja de tono con él (con el low-pass del scratch), y al darle play arranca quieto y llega a sus RPM en 0.35 s. Velocidad lineal en los dos, como un motor y su freno. Si vuelves a darle play mientras frena, el mismo plato vuelve a acelerar. Cambiar de pista sigue siendo en seco, y el `<audio>` de respaldo (sin worklet) pausa en seco.
- **Cabeza**: marca "SR-90" en Luckiest Guy (es el nombre del objeto, no un eyebrow), LEDs (play en magenta, scratch en tinta), una **rejilla de bocina** que llena el espacio hasta los botones (`.sr-deck__grille`: hoyos de tinta de 7.6px en retícula de 10px, filo duro; `background-repeat: space` para que ningún hoyo salga cortado) y botones redondos de lista y cerrar; la lista abierta deja su botón hundido, igual que las teclas.
- **Lista de canciones**: tapa el plato con fondo de pantalla negra; renglones con número (magenta = la que suena), título y artista. Elegir una la cierra.
- **Accesible**: Escape cierra primero la lista y luego el deck (en captura y con `preventDefault`, para que App no salga de la sección), Tab no se sale del deck, el foco entra en play al abrir y regresa al botón de música al cerrar.
- **Tamaño**: `min(420px, 94vw)` de ancho; el plato se encoge con el alto (`92dvh − 306px`, mínimo 220px) para que el deck quepa sin scroll en laptops bajas. Un solo layout: el mismo deck se abre en escritorio (`App.jsx`) y en teléfono (`MobileApp`, desde la barra de abajo); en un 375 × 667 mide 353 × 590.
- Tokens en `.sr-deck` (`src/index.css`, bloque "CONSOLA DE MÚSICA"): `--deck-body`, `--deck-key` `#d3d3d6`, `--deck-key-hover`, `--deck-key-down` `#a9a9ad` (+ `-hover`), `--deck-well` `#b3b3b7`, `--deck-ink`, `--deck-line`, `--deck-accent`, `--deck-screen`, `--deck-lcd` `#ff8c2a`, `--deck-lcd-off`, `--deck-lcd-font`. Las teclas dicen qué hacen con el tooltip del sitio (§14.12), no con `title`.

### 14.12 Tooltips (`TipLayer`)

> **Establecido 2026-11-02.** El `title` nativo (el cuadro gris del sistema, con un segundo de retraso y sin estilo; "están horribles", Oscar) se reemplaza por una burbuja propia.

- **Cómo se pide**: `data-tip="Texto"` en cualquier elemento; `data-tip-side="bottom"` si debe ir abajo (por default va arriba y se voltea sola si no cabe). Nunca junto con `title`: saldrían dos. El texto no da nombre accesible, así que el elemento conserva su `aria-label`.
- **Diseño**: burbuja de cómic. Fill blanco, borde de tinta de 2px `#0a0510`, Outfit 700 13px en tinta, `border-radius: 10px` y un piquito (cuadrito girado) que apunta al centro del elemento aunque la burbuja se recorra para no salirse de la pantalla. Cero sombra. Entra en 140ms expo-out, desplazándose 4px desde el elemento; quieta con `prefers-reduced-motion`. Se lee igual sobre el gris del deck, sobre la pantalla negra y sobre la escena.
- **Cuándo sale**: con mouse, tras 350ms; si pasas de un elemento a otro (antes de 500ms), sale al instante. Con teclado, al instante con el foco (`:focus-visible`). Se va al hacer clic, al teclear (Enter y Espacio cambian el estado), con scroll y con resize. En táctil no sale.
- **Texto**: el nombre de la acción, corto ("Media velocidad", "Cerrar"). Sin "on/off": el estado lo dice el control (en el reproductor, la tecla hundida).
- **Dónde vive**: `src/components/ui/TipLayer.jsx`, montado una vez en `main.jsx` (cubre escritorio, teléfono, CMS y `/help`). Usa `popover="manual"`: va en la capa superior del navegador, así que ningún `overflow` ni `z-index` lo tapa; sin soporte de popover cae a `position: fixed` con z-index alto. Estilos en el bloque "TOOLTIP DEL SITIO" de `index.css`.
- **Todo el sitio y el CMS** lo usan desde el 2026-11-02 (108 `title` pasados a `data-tip`). Solo se quedan con `title` el `<iframe>` de los videos de Memorias (es su nombre accesible, no un tooltip) y el `title=""` del retrato. También sale en botones deshabilitados: los avisos de "por qué está apagado" del CMS siguen viéndose.

### 14.13 Personalizar en teléfono (`MobileCustomizer`)

> **Establecido 2026-11-02.** La versión ligera del personalizador de escritorio (`CharacterCustomizer`) para la home de teléfono: que el usuario juegue un rato con Skulley.

- **Entrada**: el mismo pincel que en escritorio (`PaintBrushIcon`, el botón junto al retrato), al final de la barra de abajo. Solo en la home y después de elegir con o sin audio. Mientras está abierto se esconden la barra, la hamburguesa y el texto de la home, y el scroll se bloquea.
- **Skulley se arma esté como esté**: el rig no lee el scroll directo sino un progreso efectivo, el scroll real mezclado con 0 (`PERSONALIZA_*` en `SkulleyFallRig`). Al abrir, la historia se rebobina en 1 s (los huesos regresan por donde cayeron) y la cámara pasa a cuerpo entero, al 90 % del espacio entre la orilla de arriba de la barra (sus botones van en las esquinas y Skulley al centro) y el panel (los mide el personalizador: `arriba` y `abajo`), con el mismo aire arriba de la cabeza que abajo de los pies. Al cerrar, primero se acomoda la cámara —de frente por el camino corto, sin zoom y sin paneo, todo a la vez— y luego la historia se vuelve a contar en 1.4 s hasta el scroll real, que nunca se movió: si estaba despiezado vuelve a caer el rayo y los huesos caen en los mismos lugares (la caída es determinista, `hash` por pieza).
- **Al salir** (pedido de Oscar, 2026-11-04): el texto y los botones de la home ya no regresan encima de Skulley. Si iba despiezado, esperan a que termine de caer (`alRegresar` en el rig) más 400 ms de respiro: unos 1.9 s, más lo que tarde la cámara si lo dejaste girado. Si iba entero entran en cuanto se fue el panel (260 ms). Entran con el movimiento del pie (`msh-entra`: suben 1.25rem y aparecen, una pieza tras otra), la barra se vuelve a abrir, la hamburguesa hace su entrada y el velo regresa en 420 ms. La espera tiene un tope de 6 s por si el rig no llega.
- **Interacción**: arrastrar en el escenario lo gira y el giro sigue al dedo continuo (lo que se ve lo persigue con ~40 ms de atraso, `GIRO_SIGUE`, para tapar los brincos entre eventos). Solo un flick —soltar todavía en movimiento, medido en los últimos 100 ms— le deja inercia; soltar despacio lo deja donde quedó. **Dos dedos acercan y mueven el cuadro** (pedido de Oscar): hasta 4× (`PERSONALIZA_ZOOM_MAX`), y el punto de Skulley que quedó entre los dedos sigue entre los dedos; el paneo no deja salir del cuadro de cuerpo entero. Mientras hay dos dedos la cámara va pegada a ellos (sin la persecución, que se sentía flotada). Después de un pellizco, el dedo que queda no gira hasta que se levantan todos. La rueda del mouse también acerca, anclada al cursor. Con zoom aparece **Restablecer vista** arriba a la derecha. El aviso "Arrastra para girar · pellizca para acercar" va centrado 12 px arriba del panel y se va con el primer gesto. No se le reserva espacio: tapa un poco los pies mientras está, y a cambio Skulley se ve más grande.
- **Fondo** (pedido de Oscar, 2026-11-04): sobre el escenario, arriba a la derecha, en la esquina contraria a la X (en el panel se amontonaban los colores). Es el vidrio de la X a lo ancho con el mismo `ColorWell` acostado: círculo de 32 y nombre en blanco ("Background" en inglés). El vidrio hace que el círculo se vea aunque tenga el color del escenario y que el nombre se lea sobre cualquier fondo. Pinta el escenario en vivo, para ir probando la mezcla desde antes de crear el wallpaper, y se recuerda (`skulley_wallpaper_fondo`). Con zoom, Restablecer vista va a su izquierda. En el marco se va porque ahí vive en la barra de abajo; es el mismo color.
- **Wallpaper 4K** (pedido de Oscar, 2026-11-02; editor del 2026-11-04: "que se sienta como que están ellos configurando su wallpaper"): lo que ves es el archivo. El botón "Wallpaper 4K", al pie del panel, baja el panel y abre el **marco**: la proporción exacta del archivo (19.5:9), lo más grande que quepa entre la orilla de arriba de la barra y la barra de abajo, con lo demás en `#0a0510`. Skulley sigue vivo adentro y se gira y acerca igual que antes; todo se conserva al entrar y al regresar con la X (el paneo se convierte, `pasarPaneo`). Encima, un **reloj de muestra** con la hora y fecha reales, para ver cómo queda en la pantalla de bloqueo: se quita mientras mueves a Skulley y no sale en el archivo. La **barra de abajo** tiene la anatomía del panel: **Fondo** (`ColorWell`), los chips **Cuerpo** y **Cara** (`shop-chip`, atajos de encuadre: no son fotos fijas, y un pellizco los apaga) y abajo el tamaño real a la izquierda y el botón al final (§4.6). **Crear wallpaper** hace el archivo y el botón pasa a **Guardar wallpaper**: son dos toques porque compartir pide un toque reciente, y en el teléfono abre la hoja de compartir, donde está "Guardar imagen" (si no hay, se descarga). Desde Crear, **Skulley se queda en la pose del archivo** (`quieto`, detiene el idle): con zoom, el idle movía la cara hasta 7 % del marco. Cualquier cambio tira el archivo, Skulley sigue y el botón regresa a Crear: lo que se guarda siempre es lo que se ve. Cómo se hace: el mismo canvas dibuja UN cuadro a 2160 × 4680 (si la GPU no da, el tamaño más grande que dé; con 4 GB de RAM o menos, 1620 × 3510, `deviceMemory`) con el mismo encuadre del marco (`encuadreWallpaper`) y el giro tal cual, y se copia a un PNG con el fondo elegido (`CapturaWallpaper`: prepara antes que nada, copia después del EffectComposer y regresa canvas, composer y cámara). **El PNG se comprime en un Worker** (`wallpaperPng.js`, y `toBlob` de respaldo): `toBlob` trabaja en el tiempo libre del hilo principal y con Skulley animándose casi no hay (1,119 ms contra 26 ms en una miniatura, CPU a 6×). Nada se captura sin pedirlo: las miniaturas de antes hacían tres capturas al abrir la hoja. Mientras se hace, un velo tapa el parpadeo del cuadro de 4K y detiene los dedos. **El marco y el archivo coinciden** porque las líneas (`EdgeInkEffect`, `vista`) y los puntos de cámara (`DotScreen`, escalado solo en el cuadro de captura) se miden contra la misma imagen; las líneas, como si se viera en un teléfono de 390 px de ancho (`captura.css`). Medido el 2026-11-04 con Skulley de lado, en Cara y con zoom: 0.16 a 0.44 % de pixeles distintos entre el marco y el archivo.
- **Panel** (hoja abajo, `#0d0714`, borde 2px `white/12`, esquinas de arriba de 24px, cero sombra): arriba, centrado, "Elige una skin" en Outfit 600 13/16: una instrucción en renglón normal, no un título ni un eyebrow (§0.7; sustituyó al título "Personalizar" en Luckiest Guy, que Oscar vio de más). **Cerrar** es la X flotante del sitio arriba a la izquierda, en el mismo lugar que la de las secciones (pedido de Oscar; antes era "Listo" magenta en el panel). Las **cuatro skins** de teléfono —Personalizada, Slime, Vacío y Aceite— con los **mismos chips del panel de escritorio** (`SkinChip`, compartido: vista previa animada de `SkinSwatch`, que usa un solo contexto WebGL de 72 px para todos). Son lo principal del panel: círculos de 60 contra 36 de los colores. Debajo, solo con **Personalizada** (pedido de Oscar, 2026-11-04), la **bandeja de colores**, una superficie `white/5` de radio 16 sin filete, con Esqueleto, Pelo, Ojos, Esfera y el dado: el mismo control de escritorio (`ColorWell`, compartido), un círculo con el color que tiene que abre el selector nativo al tocarlo. Sin paleta: se probó una fila de 29 colores y Oscar prefirió solo el selector. Al pie, centrado, **Wallpaper 4K**.
- **Los colores viven en la rueda de Personalizada** (pedido de Oscar, 2026-11-04: "nada de fade in/out, hay que ponerle intención"; `src/lib/vueloColores.js`). Con otra skin la bandeja no existe: mide 0 y ese espacio se lo queda Skulley, que crece junto con el panel (296 → 206 px en un iPhone con Safari) porque el rig lee su alto en cada cuadro. Al elegir Personalizada la rueda se aprieta y **escupe los círculos uno por uno** (44 ms entre cada uno), en tiro parabólico por encima de las otras skins, estirándose con la velocidad; caen en su lugar, se aplastan y rebotan, y el nombre sale de abajo de cada uno. El dado rueda mientras vuela. La bandeja se abre desde la rueda (clip-path circular) y su alto va con resorte: se pasa un poco y se asienta. Al elegir otra skin es al revés: los círculos toman vuelo, aceleran hacia la rueda y ella se los traga, latiendo con cada uno. Unos 0.8 s al salir y 0.45 s al regresar. Son vuelos horneados en cuadros con la Web Animations API, que corren en el compositor y no los traba el loop 3D; si tocas otra skin a la mitad, sigue desde donde iba. Entre dos skins sin colores no pasa nada. Con movimiento reducido el cambio es directo.
- **Medidas** (rediseño del 2026-11-02, "que todo esté pixel perfect", Oscar): retícula de 4 px. Aire de 16 a las orillas en la barra y en el panel (14 de padding + el borde de 2, así las orillas de los botones de arriba y de abajo quedan en línea), 16 arriba del panel y 14 entre filas (`--mcz-aire`). **Todo botón lleva fondo** (pedido de Oscar) y ninguno se inventa: los de texto son el pill magenta de la tienda a 44 (Wallpaper 4K, Guardar wallpaper); los de ícono —cerrar, Restablecer vista y el dado—, los flotantes de vidrio oscuro del sitio, con las mismas clases que la X de las secciones y la hamburguesa de `MobileApp` (48 px, `bg-black/40`, borde `white/12`, `backdrop-blur-3xl`; `BOTON_HUD`). El **dado** de colores al azar va al lado de los colores, como uno más (pedido de Oscar): círculo de vidrio al tamaño de los demás y "Aleatorio" abajo. Con él son cinco columnas que se reparten el ancho de la bandeja (`flex: 1 1 0`). Las skins van en cuatro columnas iguales, con círculos de 60 (`--mcz-disco`) y el nombre a 8 px en Outfit 700 12/16; los colores, de 36 (`--mcz-punto`) y el nombre a 6 px en 11/14, se tocan por toda su columna; la skin elegida con anillo magenta de 4 px (borde + 2 de spread, sin glow). Los nombres largos de skin ("Aceite Iridiscente") bajan a un segundo renglón y los círculos siguen en línea porque la fila se alinea arriba, y el panel crece 16 px con ellos. Los controles compartidos se miden a esta escala con sus clases `skin-chip*` y `color-well*`, sin tocar cómo se ven en escritorio. En pantallas de 600 px de alto o menos: aire de 10 y skins de 52. La barra del wallpaper conserva sus medidas (aire de 12 y color de 48; 8 y 44 en 720 px o menos). Skulley se encuadra desde la orilla de arriba de los botones de la barra (van en las esquinas) hasta el panel.
- **Sin logros en teléfono**: ahí no hay cómo ganar skins, así que las cuatro están libres. La elegida se guarda en `skulley_active_skin` (`chooseSkin`); en escritorio, si no es tuya, `useSkinSystem` la regresa a base al cargar los logros.

---


### 14.14 Customize y wallpaper en escritorio

> **Establecido 2026-11-04** (pedido de Oscar). El panel de escritorio se queda como estaba (skins a la izquierda, colores a la derecha); lo nuevo es lo que pasa detrás.

- **Al entrar a Customize la trama se come al mundo**: `fx/TramaEffect.jsx`, último efecto del composer. Una onda de puntos de retícula del color elegido nace en los pies de Skulley, acostada en el piso, se levanta y tapa todo menos a él (1.25 s, arranca 0.3 s después del clic, con la cámara ya en camino). Adelante lleva una banda de puntos de tinta. Se probó antes un despiece del mundo y Oscar lo descartó ("impactante, pero un poco chafa").
- **Al salir la onda se regresa a sus pies** (0.8 s), y la cámara vuelve a la vista de arriba con el mismo barrido polar de la entrada en 1.25 s, suave al arrancar y al llegar (antes era un corte).
- **La trama también abre las secciones** (Oscar, 2026-11-05, entrando desde home en escritorio): sale del portal en el color de la sección, sin la banda de puntos de tinta que lleva en Customize, en 0.7 s, mientras la cámara se acerca a Skulley (`VIAJE_ZOOM`). Ya solo sobre el color se deshace de los pies a la cabeza con los mismos puntos de la trama, y de ahí salen 1,500 partículas y las runas. Las partículas toman su color de un cuadro congelado (`copyFramebufferToTexture`), porque las skins pintan en su shader y `material.color` no las conoce. Sobre fondos claros (amarillo y verde) las runas van en tinta: son de luz y no se leerían. El relevo espera a que se apague lo último que vuela (`VIAJE_S`, 2.2 s), queda un momento de color plano y la barra del preloader entra con fade. Termina en el mismo color del preloader, y por eso no se nota el cambio.
- **Las luces se apagan, no se ocultan**: al quedarse solo, `WallpaperEscena` pone en 0 las luces de lo que quita. Cambiar cuántas luces hay recompila todos los materiales, y era un tirón de casi un segundo.
- **Fondo infinito**: ya cubierta la pantalla, `WallpaperEscena` quita el mundo y lo que cuelga de Skulley que no es su cuerpo; solo quedan él, su sombra de silueta y las runas de Aleatorio (`userData.conservarAislado`). El fondo se pinta en la trama, nunca se deja pasar: **los puntos de cámara (DotScreen) le mueven el color** (#ff2d8e salía 251,0,119). Tampoco se apagan: sin ellos Skulley pierde el contraste y se ve lavado. Por eso la máscara propia (cuerpo + hull + esfera en alfa 1, sombra en alfa parcial; no sirve la de EdgeInk, que deja fuera el hull y la esfera). Viñeta, ruido y bloom sí se apagan. El scrim radial de customize se fue: oscurecía el fondo.
- **Luz de frente** (Oscar, 2026-11-04: "parecen manchas"): con Skulley aislado la key de `ToonKeyLight` pasa de arriba a la derecha a casi el frente de la vista (se recorre en ~0.5 s). El corte diagonal le cruzaba la cara; así la sombra queda alrededor de ojos, nariz y boca. Se probó además bajar el reflejo del ambiente: se van los brillos pálidos de las orillas, pero salen parches negros en la cresta y el hombro. Además la sombra no puede bajar de 0.35 (`toonPisoGlobal`, un uniform compartido que no recompila): con dos bandas lo que caía en la de abajo salía casi negro, en el brazo, el cuello y la clavícula, y de cerca eran manchas. No eran los contornos: siguen ahí sin el hull. El resto del sitio conserva su luz y su sombra.
- **Background**: pill de vidrio junto a Salir, el mismo color del wallpaper y la misma llave que el teléfono (`skulley_wallpaper_fondo`).
- **Wallpaper 4K** (botón magenta, centrado abajo de Skulley, solo layout de escritorio): abre un marco 16:9 con el archivo adentro (`DesktopWallpaper.jsx`, misma lógica que §14.13). Crear hace el PNG y Guardar lo baja; cualquier cambio tira el archivo. 3840 × 2160 (2560 × 1440 con 4 GB de RAM o menos).
- **Interfaz en cápsulas** (pedido de Oscar: emular un software de diseño, con paneles flotantes): el vidrio de la barra de navegación, en la franja oscura de 76 px alrededor del marco, así que nada tapa lo que sale en el archivo. A la izquierda, en vertical, las herramientas: Rotar (R), Mover (H), Zoom (Z), Texto (T), Stickers (S, solo si hay archivos) y Fondo (F); la elegida va en blanco plano (§14.2). Arriba a la izquierda, regresar. Arriba a la derecha, el zoom con − y +, Centrar (C: regresa a Skulley al centro del marco, con su zoom y su giro), el tamaño y Crear, el único magenta. Abajo al centro, los ajustes de la herramienta elegida: Cuerpo / Cara con Rotar, Mover y Zoom; campo y color con Texto; miniaturas con Stickers; color con Fondo. Con cualquier herramienta la rueda acerca hacia el cursor y el botón derecho o Mayús mueven el cuadro; con Zoom, clic acerca y Alt + clic aleja. Las letras no cambian de herramienta mientras escribes.
- **Tutorial** (pedido de Oscar: al entrar al marco, no a Customize): sale la primera vez que se entra (`skulley_wallpaper_guia`) y se repite con el botón de ayuda junto a regresar. Un aro magenta viaja de una cápsula a otra con el resto en penumbra, y una tarjeta al lado explica cada una: herramientas, los botones del mouse (izquierdo, rueda y derecho, con un mouse que enciende la parte de la que habla), texto, stickers si hay, fondo y Crear. Enciende la herramienta de la que habla, para que se vea su cápsula de abajo. Enter avanza y Escape lo cierra.
- **Texto detrás de Skulley** (pedido de Oscar): un bloque gigante en Luckiest Guy, la tipografía de la marquesina, siempre en mayúsculas: cada renglón se mide por su tinta y se escala a lo ancho, y se prueban todos los repartos de palabras para quedarse con el que más área cubre (`wallpaperTexto.js`). Se dibuja en un lienzo del tamaño del archivo que la trama pinta sobre el fondo, así que la máscara lo deja detrás de él y su sombra cae encima. Hasta 40 letras. No se mueve con el zoom ni con el paneo: es parte del fondo.
- **Stickers**: los diseños de Oscar, sin tope. Basta dejarlos en `src/assets/stickers/` (PNG o WebP transparente, sin reducir: se pueden agrandar hasta el 4K): salen solos, ordenados por nombre con el número al frente, y sin archivos el control no se enseña. Las miniaturas van en una tira que corre de lado con la rueda y se carga conforme aparece, cada una sobre un círculo blanco (hay stickers de pura línea negra; pegados van sin fondo); cada imagen a tamaño completo se pide al pegarla, no al abrir Customize. Cada clic en una miniatura pega uno (tope de 12 en el marco). Controles de software de diseño (Oscar: "no queda muy claro con un solo icon"), en `.dwp-controles`, una capa aparte porque el marco recorta: se arrastran para moverlos, las cuatro esquinas y la rueda los escalan, el tirador de arriba los gira, y Supr o la X los quita. Cada control trae su cursor, que en las esquinas sigue al giro. Van encima de Skulley: en pantalla son DOM y en el archivo se dibujan al final, sobre el canvas. El texto y los stickers se quedan aunque cierres el marco.
- **Encuadre de pantalla, no de mundo**: zoom de cámara y corrimiento con `setViewOffset`, y la captura es ese mismo `setViewOffset` recortado al marco. Lo que ves es lo que sale y el perfil de Skulley no cambia al acomodarlo. Medido: fondo idéntico al elegido en pantalla y en el archivo (255,45,142), archivo en 221 ms.

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
- `src/components/MusicPlayer.jsx` — Consola de música SR-90 (§14.11): un objeto de hardware dicho en el lenguaje toon
- `tailwind.config.js` — tokens de color, fuentes, z-index, easings, sombras de elevación
- `index.html` — Carga de fuentes

---

*Documento vivo. Cualquier divergencia entre código y este doc es un bug — o del código, o del doc. Arreglar el correcto.*
