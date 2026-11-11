# Rendimiento

Bitácora de rendimiento del sitio de escritorio: qué se midió, cómo, qué se encontró y las reglas que salieron de ahí. La meta es que el sitio se sienta fluido en cualquier computadora, no solo en la de Oscar.

## 2026-11-10 · Tirones al dar Enter

### Cómo se midió

Todo se midió en el Brave de Oscar con Claude in Chrome: el sitio en vivo (skulleyrad.com) como "antes" y el build local (`vite preview`) como "después". Su máquina tiene 64 núcleos y una pantalla de 2560 px a 1.5×, así que el canvas del home mide 3839 × 1832, unos 7 megapíxeles.

Se probaron dos casos:

- **Visita repetida:** el navegador ya tiene la caché de shaders. Es lo que ve Oscar todos los días.
- **Primera visita:** simulada con un nonce en cada shader para que ningún programa salga de la caché del driver. Es lo que ve quien llega por primera vez, que es quien nos va a comprar.

### Resultados

| Momento | Antes (producción) | Después |
|---|---|---|
| Enter, visita repetida | 43 shaders compilando, congelones de **2.7 s + 2.4 s** | ningún cuadro de más de 50 ms |
| Enter, primera visita | congelones de **3.1 s + 2.6 s** | un cuadro de 0.2 s |
| Arranque detrás del preloader, visita repetida | 6.4 s de hilo bloqueado | 0.37 s |
| Arranque, primera visita | ~7.7 s (congelones de 3.1 s y 2 s) | 2.3 a 3.8 s en tirones cortos |
| Home → WORK, primera visita | 1.1 s congelado a media transición | dos cuadros de ~0.27 s |
| Regreso a home, primera visita | — | un cuadro de 0.13 s |
| Home detrás del preloader | se dibujaba entero a 3840 × 1916 (~270 draws por cuadro) | no dibuja nada |

La caché de shaders del navegador casi no ayudaba: aun con la caché llena, el Enter congelaba 5 s en la computadora más poderosa que tenemos. En una laptop eso se multiplica.

### Las cuatro causas

**1. El canvas del home nunca se pausaba.** `PauseFrameloop` llama a `setFrameloop('never')`, pero el `<Canvas>` de react-three-fiber vuelve a aplicar su prop `frameloop` (por defecto `'always'`) en cada render. Con el primer re-render de App la pausa se perdía. La escena completa, con todo el postproceso, se dibujaba escondida detrás del preloader y detrás de cada sección. Además, el warm-up ya no controlaba cuándo se compilaba la escena: el loop la dibujaba antes de que `compileAsync` terminara, y todo se compilaba de golpe en un solo cuadro.

El overlay de las tarjetas de WORK (`DragShaderOverlay`) tenía el mismo bug y seguía dibujando debajo del detalle de un proyecto.

**2. El warm-up compilaba programas que nadie usaba.** La llave con la que three guarda cada programa incluye el tone mapping y el espacio de color de salida, que dependen de a dónde se dibuja: contra la pantalla lleva ACES y sRGB; dentro de un render target, ni tone mapping ni sRGB (lineal). La escena del home siempre se dibuja dentro del buffer del EffectComposer, así que `compileAsync` contra la pantalla compilaba la versión equivocada y el primer cuadro real tenía que compilar la buena. Confirmado en el código de three r182 (`WebGLPrograms.getParameters`).

**3. El número de luces cambiaba.** Cuando cambia cuántas luces hay en la escena, three recompila todos los materiales iluminados (Skulley, Argus, el piso, los portales). Pasaba en tres lugares:

- Las 10 esferas nacen parpadeando. Se ocultaba el grupo completo de cada una y su luz salía del conteo: 13 luces → 3 → 13 en el primer segundo de juego. Lo mismo en cada esfera que reaparece y con la corrupta comida.
- La luz del "!" de Argus se montaba justo al aterrizar: 13 → 14.
- Al entrar a una sección se desmontaban las esferas y el "!", con sus 11 luces.

**4. Lo que aparece en la caída no estaba compilado.** Al dar Enter, `applyModelOpacity` pone los materiales de Skulley en `transparent`. Un material transparente con `DoubleSide` son dos programas nuevos (la cara de atrás y la de enfrente). La esfera de luz en la que baja Skulley solo se montaba al viajar, y el "!" generaba su fuente SDF al aparecer (~450 ms).

### Qué se cambió

| Archivo | Cambio |
|---|---|
| `src/lib/homeFrameloop.js` | Nuevo. La condición de pausa del home en un solo lugar. |
| `src/components/home/HomeCanvas.jsx` | El `<Canvas>` recibe `frameloop` con esa misma condición. |
| `src/components/home/HomeScene.jsx` | `PauseFrameloop` usa la misma condición. El warm-up compila con un render target de 64 × 64, precompila las variantes transparentes de Skulley (`compilarFundido`) y cada 1.5 s revisa si montó algo nuevo mientras sigue el preloader. Monta `OrbLightRig` y deja el "!" montado desde el warm-up. |
| `src/lib/compileAsyncSafe.js` | Acepta un `target` para compilar con la llave del composer. |
| `src/components/HomeOrbs.jsx` | `OrbLightRig`: las luces de las esferas viven aparte, montadas para siempre; HomeOrbs las mueve y las apaga con la intensidad. |
| `src/components/FloatingExclamation.jsx` | Siempre montado. Oculto: grupo invisible, luz en 0 y los clics siguen de largo. |
| `src/components/Player.jsx` | La esfera de la caída se queda montada y oculta. Marca su escena (`fundidoWarm`) para que el warm-up la encuentre. |
| `src/components/CharacterPortrait.jsx` | El warm-up del retrato también compila con render target (también pasa por un composer). |
| `src/components/DragShaderOverlay.jsx` | `frameloop` según `paused`, para que de verdad se pause bajo el detalle. |

Nada de esto cambia cómo se ve el sitio.

## 2026-11-11 · Tirón en el revelado del About

Oscar lo sintió en producción: el About se trababa cuando las runas se convertían en letras.

### Cómo se midió

En el Brave de Oscar con Claude in Chrome, con la misma inyección de "Cómo medir" (sin nonce: visita repetida), más un registro del ritmo de `requestAnimationFrame` marcando los cuadros en los que algún párrafo se está revelando. Esta vez la máquina fue la laptop: RTX 4060 + Iris Xe, pantalla de 2560 px a 1.25× (ventana de 2048 × 1118) y a 240 Hz, salvo una corrida en que Windows la tenía a 60 Hz. El "después" es un build local servido en `localhost:4180` con el texto del CMS traído de producción.

La carga directa de `/about` mezcla el primer párrafo con la carga de los personajes 3D, así que la comparación buena es la de los párrafos que se revelan al bajar, con todo ya cargado.

### Resultados

| Párrafos revelados al bajar | Antes (producción) | Después |
|---|---|---|
| Cuadros por segundo durante el revelado | 154 | 207 |
| p95 por cuadro | 12.5 ms | 8.4 ms |
| Peor cuadro | 217 ms, justo al soltar el párrafo | 29 ms |
| Cuadros largos del hilo principal | 1 (70 ms, sin script) | ninguno |

Sin revelado, el About con los personajes 3D detrás va a ~230–240 fps. En la primera medición de producción el segundo párrafo congeló 175 ms al soltarse, y durante el revelado se bajaba a 56–108 fps.

### La causa

**Una capa por letra.** Cada runa se iba en una copia de su palabra recortada a su letra (`splitRunes`), con su animación de `translate` y `opacity` y su retraso. Chrome manda al compositor las animaciones con retraso desde que se crean, así que al soltar un párrafo nacían en el mismo cuadro unas 300 a 600 capas de texto con contorno (`-webkit-text-stroke`) y `clip-path`, más una por cada palabra en latín. El JavaScript de partir el párrafo costaba menos de 10 ms. Los 175–217 ms eran pintar, armar capas y rasterizar: los cuadros largos salen sin script y con 1–2 ms de estilo y layout.

### Qué se cambió

| Archivo | Cambio |
|---|---|
| `src/lib/runeReveal.js` | `revealRunesCanvas`: un canvas encima del párrafo y una hoja donde cada palabra en runas se pinta una vez. La runa quieta se queda en el DOM; cuando arranca la primera letra de una palabra, la palabra pasa entera al canvas, que copia cada letra con su subida y su desvanecido (la misma curva `ease-out`). Las palabras en latín reciben su animación hasta que les toca. Mide todo antes de escribir y guarda la línea base de cada fuente. |
| `src/components/Section2.jsx` | Usa `revealRunesCanvas`. Espera las fuentes una vez antes de programar (no a la hora de cada párrafo). No arranca antes de que llegue el texto del CMS, con 2 s de tope. Revelado el doble de rápido (`RUNE_REVEAL`, pedido de Oscar). |
| `src/index.css` | `.rt-reveal`, `.rt-still`, `.rt-on`, `.rt-canvas`. |

Se ve igual que antes, solo más rápido.

### Lo que no funcionó

- **El párrafo esperando en el canvas.** Comparado pixel por pixel, el canvas coloca la tinta en el mismo lugar que el DOM (centroides a 0.03 px), pero Chrome rasteriza el texto del canvas sin el contraste que le pone al texto del DOM en Windows y las runas salen más suaves. El relevo se notaba. Ningún ajuste del canvas lo cambia (`textRendering`, sin transformación, por CPU, uniones del contorno). Por eso el canvas solo pinta palabras que ya arrancaron, que se van en ~30 ms.
- **Recortar la palabra del DOM letra por letra** (`clip-path` que avanza). Repinta el párrafo en cada cuadro: la mediana subía de 4.2 a 8.3 ms, uno de cada dos refrescos perdido. Un repintado por palabra cuesta poco.

## Reglas

1. **Un Canvas que se pausa necesita las dos cosas:** `PauseFrameloop` y la prop `frameloop` del `<Canvas>` con la misma condición. Solo una no basta.
2. **Si la escena pasa por un EffectComposer, se compila con un render target puesto.** `compileAsyncSafe(gl, scene, camera, timeout, renderTarget)`. Cualquier render target que no sea de XR da la misma llave.
3. **El número de luces no cambia después del warm-up.** Las luces se apagan con `intensity = 0`. No se ocultan (`visible = false` las saca del conteo, también si se oculta un padre) ni se desmontan.
4. **Lo que va a aparecer después se monta oculto desde el warm-up.** `gl.compile` recorre también los objetos invisibles. Si algo cambia de material en un momento clave (transparencias, skins), se precompila esa variante.
5. **`transparent` + `DoubleSide` son dos programas** y se dibujan dos veces. Si solo se ve un lado, `FrontSide`.
6. **Antes de agregar algo nuevo al home, medir el Enter en primera visita.** Si aparecen shaders nuevos después del clic, algo rompió estas reglas.
7. **Nada de cientos de animaciones CSS esperando su turno.** Una animación de `transform`/`opacity` con retraso ya es una capa desde que se crea. Si son cientos (una por letra), se dibujan en un canvas o se les pone la animación hasta que les toca.
8. **Texto que se mueve, en canvas; texto quieto, en el DOM.** El canvas de Chrome rasteriza el texto más suave que el DOM; el cambio de uno a otro se nota en texto quieto, no en texto que ya se mueve. Un canvas que relevará al DOM cae en píxeles enteros y mide exactamente su imagen (`canvas.width / dpr` en CSS), o el compositor lo reescala.
9. **No cambiar `clip-path` ni nada que se pinte en cada cuadro sobre texto grande.** Cada cambio repinta su zona de la capa; uno por cuadro tira los cuadros por segundo a la mitad.

## Cómo medir

### Primera visita sin limpiar la caché

En el navegador de Oscar (Claude in Chrome):

1. Navegar a `/robots.txt`, que no trae JavaScript.
2. `fetch('/')`, `history.replaceState(null, '', '/')` y `document.open()` / `document.write()` con el HTML, metiendo un `<script>` justo después de `<head>` para que corra antes del bundle.
3. Ese script envuelve `WebGL2RenderingContext.prototype`:
   - `shaderSource`: agrega un comentario con un nonce al final de cada shader (así la caché del driver nunca acierta) y guarda `#define SHADER_NAME` para saber qué material es.
   - `linkProgram`: cuenta y marca la hora de cada programa.
4. Un `PerformanceObserver` de `long-animation-frame` (con `buffered: true`) da los cuadros largos y el script que los causó.
5. Un listener de `pointerdown` marca el momento del clic en Entrar.

Para visita repetida, el mismo script sin el nonce.

### Qué se compila y por qué

Guardar el código completo de los shaders de un material (por ejemplo `Head`) antes y después del clic y comparar las líneas: las diferencias dicen qué cambió (`OPAQUE`, `FLIP_SIDED`, el tamaño de `pointLights[ N ]`). Los defines reales se leen con `/#define [A-Z_]+/`: buscar `USE_SKINNING` en el texto engaña, porque aparece en los `#ifdef` de todos los shaders.

### Costo de GPU por cuadro

`EXT_disjoint_timer_query_webgl2` sobre el contexto del home, envolviendo `window.requestAnimationFrame` para iniciar y cerrar la consulta alrededor del loop de R3F. En la máquina de Oscar: **~6.8 ms por cuadro a 7 megapíxeles**.

### Trampas

- Si los cuadros largos miden exactamente 1000 ms, la ventana del navegador está tapada y Chrome la está frenando. Los fps no sirven; el tiempo bloqueado del hilo sí.
- La laptop de Oscar cambia entre 240 y 60 Hz (energía o pantalla). Antes y después se miden uno tras otro, revisando los fps sin revelado.
- Un build local se sirve con un servidor que mande `text/plain` en los `.txt`: con otro tipo, Brave descarga `robots.txt` en lugar de abrirlo y la inyección no corre.
- En Chrome automatizado (puppeteer) cada corrida es primera visita: los shaders de los personajes se compilan en el hilo principal y retrasan los temporizadores, así que los párrafos del About se amontonan. Sirve para revisar pixeles, no para medir el ritmo.
- Las capturas de puppeteer redondean el recorte a píxeles CSS enteros; a 1.25× eso deja un desfase de fracción de píxel que vuelve a rasterizar el texto del DOM pero reescala los canvas. Para comparar pixeles, recortes en múltiplos de 4 px CSS.
- La caché de shaders hace que todo parezca bien en la computadora de quien desarrolla. La corrida que importa es la primera visita.
- `getProgramParameter` casi no bloquea: el tiempo se va al primer uso del programa. Por eso se mide con long animation frames y no envolviendo llamadas sueltas.

## Pendiente

- **Resolución adaptable.** `AdaptiveDpr` está montado pero no hace nada: nadie llama a `performance.regress()`. El home cuesta ~6.8 ms de GPU por cuadro en una tarjeta muy potente; en una laptop con gráficos integrados queda muy por debajo de 60 fps aunque ya no tenga tirones. Propuesta: si la compu no llega a ~50 fps, bajar el DPR del home por pasos hasta llegar; en la de Oscar no cambiaría nada.
- **El resto del arranque en primera visita** (2.3 a 3.8 s detrás del preloader): son programas que `gl.compile` no alcanza, como los pases del composer, los materiales de override del normal pass y de la sombra silueta. Pasa mientras la palabra SKULLEYRAD está quieta, pero en una laptop puede caer encima de su salida. Opciones: compilar los pases del composer por separado o atar `introCanLeave` al fin del warm-up.
- **Restos chicos:** el globo de diálogo de Skulley compila al aparecer (~67 ms); al entrar a WORK, sus canvas (slime y tarjetas) cuestan dos cuadros de ~0.27 s.
- **El overlay de WORK dibuja cada cuadro** aunque nada se mueva, a pantalla completa. Podría dibujar solo cuando hay scroll o hover.
- **Los personajes del About compilan al aparecer.** El primer render de `FloatingHousebirds` cuesta ~150 ms en el loop de R3F (más en primera visita, hasta ~500 ms) y en carga directa cae encima del primer párrafo. Necesita su propio warm-up, como el home.
- **El preloader y GlitchName siguen con una copia por letra** (`splitRunes`). Son pocas letras, pero si se siente un tirón ahí, `revealRunesCanvas` es el camino.
