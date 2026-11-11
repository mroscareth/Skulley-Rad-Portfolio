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

## 2026-11-11 · About, entrada directa, resolución y preloader

Empezó con un tirón que Oscar sintió en producción: el About se trababa cuando las runas se convertían en letras. De ahí salió el resto. Todo quedó en producción ese mismo día:

| Commit | Qué | Antes → después (Brave de Oscar) |
|---|---|---|
| `c490394` | Revelado del About en canvas, el doble de rápido | peor cuadro 217 → 29 ms; 154 → 207 fps revelando |
| `be5e0cb` | Warm-up de los personajes del About | cuadro de compilación de 67 ms → ninguno |
| `86db052` | El home se precalienta detrás de una sección abierta directo | regreso al home: 1379 + 583 ms → 46 ms |
| `aed0ab9` | Retrato precalentado sin pausa, HDR propio, personajes que flotan suave | 487 + 204 + 140 ms en carga directa → ninguno del loop 3D |
| `93d6335` | Resolución adaptable del home | en la laptop de Oscar no cambia; en una máquina lenta baja en escalones |
| `9699a1d` | SKULLEYRAD se va cuando el warm-up terminó | congelón de 1.18 s en su salida → detrás de la palabra quieta |
| `ee7d306` | La voz de M.A.D.R.E. del preloader en canvas | 33 → 190 fps revelando; cuadros de 175–217 ms → 88 ms |

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

### Los personajes del About

Medido en el recorrido real: home, Entrar y, 8 s después, navegación interna al About. Se comparan los 9 s siguientes.

`FloatingHousebirds` abre su propio contexto WebGL en cada entrada al About. Su primer cuadro linkeaba los shaders de golpe (toon, contorno y los de la babosa): un cuadro de ~65 ms en primera visita. En visita repetida la caché de shaders casi lo borra. Los 150–400 ms que se veían en la carga directa de `/about` eran sobre todo el home arrancando detrás, no los personajes.

| Home → About | Antes (producción) | Después |
|---|---|---|
| Primera visita: cuadro de compilación | 67 ms (`Hm`, el loop de R3F) | ninguno: se linkea en paralelo |
| Primera visita: fps en los 9 s | 178 | 184 |
| Visita repetida: fps en los 9 s | 173 | 179 |

Un warm-up (`WarmUp` en `FloatingHousebirds.jsx`) monta junto a los modelos y el Environment. Con el loop en `'never'`, `compileAsyncSafe` linkea los programas sin bloquear; luego un cuadro con el canvas invisible sube la geometría, y hasta entonces arranca el loop y los personajes aparecen con un fundido de 600 ms. Siguen dos cuadros que no son de shaders y ya caen durante la transición de sección: ~65 ms al montar la escena y ~40–65 ms al leer el GLB (ver Pendiente).

### Entrada directa a una sección

Si la primera URL es una sección (`/about`, `/work`…), no hay preloader del home: App lo salta y monta el home detrás de la sección, con el loop en pausa. `PreloaderWarmRender` solo corría con el preloader encima, así que el home nunca se precalentaba. Además, `HomeScene` solo monta las esferas, Argus y la babosa, y solo enciende el pasto, las sombras, los cristales de los portales y el contorno amarillo del composer, con `section === 'home'`. Aunque el warm-up hubiera corrido, no los habría visto.

Medido en el Brave de Oscar, visita repetida: `/about` directo y, 15 s después, regresar al home.

| Regreso al home | Antes (producción) | Después |
|---|---|---|
| Programas compilados al regresar | 47 en el canvas del home | 1 (`EffectMaterial`) |
| Peor cuadro | **1379 ms**, luego otro de 583 ms y una ráfaga de 60–136 ms | 46 ms |
| Cuadros largos del hilo principal | 12 en 3 s | ninguno |

Ahora App enciende `sectionHomeWarm` una sola vez, 3 s después de que el home terminó de montarse detrás y en un rato libre (`requestIdleCallback`), si el home todavía no se ha mostrado. Con eso corre el mismo `PreloaderWarmRender`, y `HomeScene` arma la escena como en home (`comoHome`) solo en lo que se dibuja: el juego sigue atado a `section`. La ventana se cierra al llegar al home o al irse a otra sección, y cualquier transición corta el warm-up, porque el iris de regreso necesita el canvas visible. El costo se paga una vez mientras se lee la sección: 62 programas en paralelo y dos cuadros de 190 y 374 ms.

### El retrato y los personajes en carga directa

Al cargar `/about` directo, los cuadros largos que se veían no eran de los personajes del About:

- **El retrato de Skulley** (HUD, abajo a la izquierda) solo se precalentaba mientras estaba pausado detrás del preloader (`PortraitWarmRender active={paused}`). Entrando directo nunca está pausado, así que su primer cuadro compilaba todo su set de golpe: toon, Bloom, EdgeInk y pase de normales, 10 programas. Eran dos cuadros de **487 y 204 ms**. Ahora su loop no arranca hasta que termina el warm-up (`warmed` en `CharacterPortrait.jsx`), también sin pausa.
- **Los personajes del About** cargaban el preset "city" de drei: un HDR de 1024×512 desde un CDN externo, con un cuadro de **140 ms** para leerlo. Solo la babosa usa ese reflejo, porque el toon no lo usa. Ahora usan `public/light-about.hdr`: el HDR del home a 256×128, 128 KB, mismo dominio. Lleva URL propia porque el `Environment` de drei desecha su textura al desmontarse: compartida con el home, salir del About le borraría el suyo.

Después del cambio ya no queda ningún cuadro del loop de R3F en la carga directa. Quedan ~120 ms de la parte síncrona del `gl.compile` del retrato, ~190 ms de React montando la escena del home detrás y el cuadro del warm-up del home (ver Pendiente).

**Los personajes flotaban cuatro veces más rápido en 240 Hz.** Su física avanzaba por cuadro, no por tiempo, y cada choque les sumaba giro sin quitárselo nunca. Ahora todo se escala con el tiempo real del cuadro, el giro de un choque regresa en unos segundos al vaivén propio de cada uno, y bajaron un poco los topes de velocidad y de giro (pedido de Oscar: "necesito que floten suave").

### Resolución adaptable

`AdaptiveDpr` de drei estaba montado en el home, pero solo baja la resolución cuando alguien llama a `performance.regress()`, y nadie lo hacía. Lo reemplaza `ResolucionAdaptable` (`src/components/home/`), montado en `HomeCanvas`:

- Mide en ventanas de 2 s, solo con el home jugándose (sin preloader, transición, Customize ni pestaña oculta), los cuadros por segundo y el tiempo de GPU de cada cuadro con `EXT_disjoint_timer_query_webgl2`. La consulta abre al empezar un cuadro y cierra al empezar el siguiente, sin prioridad de render: una prioridad > 0 le quitaría a R3F el dibujo. Descarta las ventanas con un cuadro de más de 250 ms.
- **Baja** un escalón del DPR (1 → 0.85 → 0.72 → 0.6 del techo) tras dos ventanas seguidas por debajo de ~55 fps, siempre que la GPU sea el cuello de botella (GPU > 70 % del cuadro). Si el límite es el JavaScript, no toca nada: menos píxeles no ayudan. Sin temporizador, baja solo por los fps.
- **Sube** solo con temporizador, tras tres ventanas en que el siguiente escalón cabría en 10 ms de GPU. Si después de subir tiene que volver a bajar, se queda ahí.
- El escalón vive en `HomeCanvas` y entra por la prop `dpr`, que el `<Canvas>` vuelve a aplicar en cada render (como `frameloop`, regla 1). Se recuerda en la sesión (`sessionStorage.skulley_dpr_escala`).

En la laptop de Oscar no cambia nada: el home cuesta 3.3 ms de GPU por cuadro a 2560 × 1326 y se queda en escala 1. Con una máquina lenta simulada (`window.__resolucionForzar = 'lento'`) bajó a 0.85, 0.72 y 0.6 a los 3.8, 9.2 y 14.8 s; al quitar la simulación regresó sola a 1. `window.__resolucion` muestra la escala, los ms por cuadro, los de GPU y si hay temporizador.

Una medición de esa noche dio el home a 40 fps con 22 ms de JavaScript por cuadro y 10 ms de GPU: el límite era el hilo principal, no la tarjeta. Un minuto después, entrando igual, iba a 238 fps con 5.2 ms. La laptop cambia de estado (energía, temperatura), y por eso la resolución adaptable no baja el DPR cuando el límite es el JavaScript.

### El arranque en primera visita

El preloader sostiene la palabra SKULLEYRAD mientras el sitio compila la escena del home detrás. Para saber cuándo soltarla esperaba 1.3 s fijos después de cargar el modelo, más un rato libre. En primera visita, el warm-up del home (`PreloaderWarmRender`) todavía estaba en sus partes síncronas cuando la palabra se iba:

- las variantes transparentes de Skulley (`compilarFundido`);
- el pre-pase del composer, que compila sus pases sin `compileAsync` (`LuminanceMaterial`, `EffectMaterial`…);
- los ticks de +450 y +1100 ms.

Medido en el Brave de Oscar con nonce en los shaders: la palabra empezaba a irse a los 6.15 s, **a los 6.86 s se congelaba 1.18 s**, y durante la entrada de Skulley y el texto seguían cuadros de 130, 140, 134 y 327 ms.

Ahora `PreloaderWarmRender` avisa cuando terminó su último tick (`onDone` → `homeWarmDone` en App) y la palabra se va hasta entonces, con el hilo libre; el tope pasó de 9 a 15 s. Mientras se sostiene, la palabra está quieta, así que los congelones detrás no se ven.

| Primera visita | Antes (producción) | Después |
|---|---|---|
| La palabra empieza a irse | 6.15 s | 5.99 s |
| Congelones después de que se va | 1.18 s, luego 130–340 ms | uno de 141 ms al entrar el texto |
| Congelones mientras se sostiene (no se ven) | — | 958, 642, 483, 862 ms |

En visita repetida casi no cambia: la palabra se va a los 3.3 s.

### La voz de M.A.D.R.E. en el preloader

Tenía el mismo problema que el About, y peor. Cada una de sus ~450 letras llevaba dos animaciones CSS con retraso, la letra (`.rt-l`) y su copia en runas (`splitRunes`): unas 900 capas desde que se montaba el texto, animándose todo el revelado. Ahora usa `revealRunesCanvas` con `porLetra`. Las letras esperan sin animación (`.rt-l.rt-jit`) y la reciben hasta que les toca, y las runas esperan quietas en el DOM (`.rt-still`) hasta pasar al canvas. El canvas arranca a los 1.5 s, cuando `beatIn` ya dejó quieto el bloque; la primera runa sale a los 2.3 s. El título (`GlitchName`) sigue con copias: son pocas letras.

Medido en el Brave de Oscar, visita repetida, los 7 s después de que entra el texto, una corrida tras otra:

| | Antes (producción) | Después |
|---|---|---|
| Cuadros por segundo | 33 | 190 |
| Mediana por cuadro | 29 ms | 4.2 ms |
| Cuadros de más de 30 ms | 99 | 3 |
| Cuadros largos | 175, 204, 217 ms | 88 (React monta el texto), 87 (prepara el canvas), 63 ms |

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
10. **En `HomeScene`, lo que se monta o se dibuja solo en home va con `comoHome`, no con `section === 'home'`.** Si no, el warm-up detrás de una sección no lo compila y el regreso al home lo compila de golpe. Lo que es juego o entrada (clics, poder, `active` de las esferas) sí va con `section`.
11. **Lo que se mueve en un `useFrame` se escala con `delta`.** Si avanza por cuadro, en una pantalla de 240 Hz va cuatro veces más rápido que en una de 60.
12. **Todo canvas se precalienta antes de su primer cuadro, entre o no por el preloader.** Las entradas directas a una sección se saltan el preloader.

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

Por orden de lo que más se nota:

1. **El warm-up del home detrás de una sección** cuesta, mientras se lee la sección, un cuadro de ~190 ms (React montando esferas y Argus) y uno de 374–525 ms: el pre-pase del composer, que compila sus pases sin `compileAsync` y sube las texturas. Se podría repartir: subir las texturas con `gl.initTexture` en ratos libres antes del pre-pase y compilar los pases del composer por separado.
2. **Al entrar a WORK**, sus canvas (slime y tarjetas) cuestan dos cuadros de ~0.27 s.
3. **Al entrar el texto del preloader** quedan dos cuadros de ~90 ms: React montando las ~900 piezas de la voz y la preparación del canvas a los 1.5 s (medir ~450 letras y pintar la hoja). Se podría armar la hoja en un rato libre durante los 2.3 s en que las runas esperan.
4. **La parte síncrona del `gl.compile` del retrato** cuesta ~120 ms al cargar una sección directo (armar los programas de Skulley con su banding).
5. **El globo de diálogo de Skulley** compila al aparecer (~67 ms).
6. **El montaje de los personajes del About** cuesta un cuadro de ~65 ms: React clona los modelos, crea materiales y contornos, y `measureShape` saca la forma de choque con k-means sobre ~52 mil vértices. Leer el GLB es otro de ~40–65 ms. Las formas de choque son fijas por modelo: se podrían calcular una vez fuera del navegador y guardarse.
7. **El warm-up del home todavía congela 0.5–1 s en primera visita**, aunque ya detrás de la palabra quieta: los pases del composer y los materiales de override (pase de normales, sombra silueta) se compilan sin `compileAsync`. No se ve, pero alarga la espera de la palabra en máquinas lentas.
8. **El overlay de WORK dibuja cada cuadro** aunque nada se mueva, a pantalla completa. Podría dibujar solo cuando hay scroll o hover.
