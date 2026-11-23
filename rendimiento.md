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

## 2026-11-11 (tarde) · Chequeo de shaders y pases del composer

Pendiente #1 de la lista: el warm-up del home detrás de una sección (`/about` directo) congelaba un cuadro mientras se lee. Medido en el Brave de Oscar, visita repetida, cronometrando cada llamada a WebGL dentro de ese cuadro (ver "Cómo medir"):

| Llamada en el cuadro del pre-pase | Veces | Tiempo |
|---|---|---|
| `getProgramInfoLog` | 37 | 139–181 ms |
| `getShaderInfoLog` | 72 | 66–81 ms |
| `bufferData` (geometría) | ~600 | 3–41 ms |
| `texSubImage2D` (texturas) | 70–144 | 21–27 ms |

**La causa.** three revisa los errores de cada programa en su primer uso (`renderer.debug.checkShaderErrors`, prendido por defecto): pide el log del programa y los de sus dos shaders. Son llamadas síncronas, y cada una espera a que el proceso de la GPU vacíe todo lo que tiene en cola. Al apagarlas, la espera se movía a `getProgramParameter` en los ~15 programas del EffectComposer que se compilaban dentro de ese mismo cuadro: `compileAsync` solo recorre la escena y no ve los pases del composer.

**Qué se cambió:**

| Archivo | Cambio |
|---|---|
| `vite.config.js` | Plugin `sinChequeoDeShaders`: solo en el build de producción cambia en three el valor por defecto `checkShaderErrors: true` → `false`. Aplica a todos los canvas del sitio, también los del teléfono. En desarrollo sigue prendido para ver los errores. Si three cambia ese texto, el build avisa. |
| `src/components/home/HomeScene.jsx` | `compilarComposer`: el warm-up junta los materiales del composer (también los de adentro de cada efecto, como el bloom) y los compila en paralelo antes del pre-pase, el último pase contra la pantalla y los demás contra un render target. Si el composer todavía no montaba, lo intenta en cada revisión. |

| Cuadro del warm-up detrás del About | Antes (producción) | Después (local) |
|---|---|---|
| Callback del pre-pase | 286 / 521 / 441 ms | 176 / 174 ms |
| Espera por shaders en ese cuadro | 220–255 ms (logs) | 22–37 ms |
| Regreso al home después | — | 0 programas, ningún cuadro con bloqueo |

El Enter en primera visita sigue igual de limpio (un cuadro de 0.22 s, 5 programas). Queda el cuadro de React montando esferas y Argus (~105–115 ms).

**Una medición que no sirvió:** esa tarde el About daba entre 2 y 28 cuadros por segundo con el hilo principal libre (~2.5 ms de JavaScript por cuadro) y los canvas baratos de GPU (1.9 ms el de los personajes, 3.1 ms el retrato). Con la página quieta bajaba a 1 fps, que es lo que hace el navegador cuando otra ventana lo tapa: Oscar estaba usando la máquina. Los cuadros por segundo se miden con la ventana al frente y sin tocarla.

## 2026-11-15 · La llama de la mano

Desde este día la llama (`fx/LlamaMano.jsx`) la llevan todas las skins, también en el preloader, el retrato y el teléfono. Se dibujaba en un cuadro fijo de 22 × 20 radios de la esfera y cada pixel de ese cuadro pagaba el ruido (dos fbm de tres octavas) y todas las bocanadas vivas (~34) antes de descartarse, aunque casi todo el cuadro estaba vacío.

Medido en el Brave de Oscar (laptop, 2560 × 1326), con una consulta `EXT_disjoint_timer_query_webgl2` alrededor de la llamada de dibujo de la llama (`onBeforeRender` / `onAfterRender`; en el home no se puede, porque `ResolucionAdaptable` ya tiene abierta una consulta de todo el cuadro y no se pueden anidar):

| Llama de la mano en el preloader | Antes | Después |
|---|---|---|
| GPU por dibujo (mediana) | 0.77 ms | 0.28 ms |
| Área del cuadro (promedio, en radios²) | 440 | 55 |

`ajustaCuadro` recorta cada cuadro a donde hay fuego. Fuera del recorte la densidad nunca llega a la orilla: a s radios de cada bocanada su aporte es menor que su peso por e^(-s²), y con s² = ln(peso total / orilla) ni todas juntas la alcanzan; el ruido mueve lo que se lee hasta 0.75 y nada pasa del cuadro de antes. Revisado en el navegador: 33,928 puntos visibles en 15 cuadros, ninguno fuera del recorte. En el juego la llama se ve chica y su costo no se distingue del ruido del cuadro (3.2 ms de GPU con y sin ella).

**En el teléfono** (mismo día). Sin teléfono conectado, se midió en la misma GPU con la resolución de uno: el navegador integrado en modo teléfono (375 × 812 a densidad 2, canvas de 750 × 1624, agente de Android y toque) y, para cruzar, un iframe de 390 × 844 con `zoom: 1.6` en el Brave de Oscar (densidad 2, canvas de 780 × 1688). En la primera pantalla la mano queda fuera de cuadro, a la derecha (NDC x 1.78), y tan cerca que el radio de la esfera mide 226 px: el margen del recorte (el ruido y la suma de las bocanadas) metía 437 mil pixeles a cuadro, el 36 % de la pantalla, sin un pixel de fuego. En la historia la esfera se encoge (`sinEsfera`) y la llama casi no se dibuja; de la cuarta pantalla al bajar en adelante no hay esfera.

Dos cortes más, exactos los dos:

- **Por pixel, antes del ruido**: lo más que puede leer el pixel si el ruido lo llevara lo más cerca de cada bocanada (w mide a lo más √2/2 por 0.3 + 1.2·h; las gotas, 0.35 por √2/2). Primero contra 8 grupos de bocanadas (`agrupa`: cortes por la mediana del eje más largo, cada grupo una bola con el radio que alcanza a las suyas, su radio más grande y la suma de sus pesos) y lo que pasa, bocanada por bocanada.
- **Por cuadro**: si ni el pixel de la pantalla más cercano a cada bocanada puede llegar a la orilla, no se dibuja (`fuegoAcuadro` en el `onBeforeRender`, solo para ese dibujo).

Validados en Node con las fórmulas copiadas: 600 mil pixeles en 1,500 campos al azar (hasta 64 bocanadas, gotas y base), atacando cada descartado con el peor ruido (las esquinas de w y el que lo empuja hacia cada bocanada): ningún descartado tenía fuego; de 12 mil pantallas, ninguna juzgada sin fuego lo tenía. Se descarta el 67 % de los pixeles, tres cuartos ya en los grupos.

| Llama en el teléfono (navegador integrado: Iris Xe, 750 × 1624) | Antes | Recorte | Los dos cortes |
|---|---|---|---|
| Primera pantalla | 0.55 ms | 0.34 ms | 0.23 ms |
| Bajando, media pantalla | 0.56 ms | 0.41 ms | 0.31 ms |
| Bajando, 1.ª a 2.ª pantalla | 0.22–0.25 ms | 0.17–0.20 ms | 0.16 ms |
| Personalizador | 0.18 ms | 0.15 ms | 0.13 ms |

El cuadro completo de la primera pantalla cuesta 4.84 ms de GPU con la llama y 4.56 ms sin ella: la llama es ~6 % y casi todo es el resto de la escena (pendiente abajo).

Ese día también se quitó el tope de 11 × 10 radios del cuadro: mordía en línea recta las lenguas que la mano suelta al moverse rápido (Oscar lo vio en producción). Ahora el tope es de seguridad (120) y el recorte sigue a todas las bocanadas vivas; lo vacío lo descarta el shader.

## 2026-11-15 · La primera pantalla del teléfono, pase por pase

Lo que cuesta el resto de la escena de la primera pantalla (`MobileScrollHome` con `SkulleyFallRig`), sin contar la llama, que ya estaba optimizada.

**Ojo con la GPU.** El navegador integrado de la app de escritorio no dibuja con la RTX 4060 sino con la Intel Iris Xe (`ANGLE (Intel, Intel(R) Iris(R) Xe Graphics … Direct3D11)`, leído con `WEBGL_debug_renderer_info`). Las mediciones de teléfono de este día, la de la llama incluida, son de la Iris Xe. Para un teléfono es mejor referencia que la 4060: está más cerca de la GPU de un teléfono bueno.

### Cómo se midió

Navegador integrado en modo teléfono (375 × 812 a densidad 2, canvas de 750 × 1624), servidor de desarrollo, ventana al frente (100–180 fps). Al store de R3F se llega con `_roots` del módulo ya empaquetado (`/node_modules/.vite/deps/@react-three_fiber.js?v=…`, con la misma `v` que pidió la app, o es otra copia del módulo). Con `EXT_disjoint_timer_query_webgl2`, tres modos que no se pueden mezclar porque las consultas no se anidan:

- **Por cuadro:** una consulta alrededor de cada callback de `requestAnimationFrame`.
- **Por llamada:** una consulta alrededor de cada `renderer.render` y `renderer.clear`, etiquetada por escena y destino. Suma lo mismo que el cuadro (5.27 contra 5.23 ms).
- **Por objeto:** una consulta entre `onBeforeRender` y `onAfterRender` de cada malla, conservando los que ya tenían (la llama). Cada consulta le suma ~0.003–0.01 ms a su dibujo: sirve para ver qué pesa, no para sumar.

Mediana de 150 a 200 cuadros, primera pantalla quieta. Cada idea se probó primero en vivo, parchando el renderer desde la consola, antes de escribirla.

Para comprobar que el cuadro no cambia: `setFrameloop('never')`, dos `advance(T)` con el mismo `T` (el segundo con delta 0), `readPixels` del canvas en la misma tarea, el cambio, otro `advance(T)` y comparar. La llama se esconde para la prueba (va con `performance.now()`); en la historia además se congelan `performance.now` y `Math.random`. Ruido entre dos cuadros iguales: 0 pixeles.

### En qué se iba

| Primera pantalla (Iris Xe, 750 × 1624) | Antes | Después |
|---|---|---|
| **Cuadro completo** | **5.2 ms** (5.09–5.27) | **3.9–4.0 ms** |
| Escena (RenderPass) | 3.24 | 1.67 |
| · cráneo (`Skull071`) | 0.92 | 0.50 |
| · haz del foco, dos dibujos, apagado (alfa 0) | 0.56 | — |
| · pelo | 0.31 | 0.15 |
| · llama de la mano | 0.27 | 0.25 |
| · torso (`Skull014_8`) | 0.24 | 0.13 |
| · las otras 27 piezas de Skulley | ~0.7 | ~0.6 |
| · signos de duda, ojos de la historia, polvo y charco, en 0 | ~0.08 | ~0.01 |
| Prepaso de profundidad, con el borrado del buffer | — | 0.52 |
| Borrado doble del buffer del composer (ClearPass) | 0.26 | — |
| Pase de normales de la tinta (`CharacterNormalPass`) | 0.82 + 0.12 de borrado | igual |
| Tinta, película y puntos (un solo EffectPass) | 0.52 | igual |
| Sombra (`SilhouetteShadow`, un cuadro sí y uno no) | 0.21 (0.41 cuando corre) | igual |

Las filas con punto son del modo por objeto. En producción, con el build real y la misma medición por cuadro: **4.85 → 3.78 ms** de mediana (p90 5.12 → 4.04), antes y después del deploy de `79b52af`. En un primer plano de la historia (la frase del enojo, con los ojos rojos, el blanco y negro y el foco prendido) el cuadro pasó de 5.76 a 5.18 ms.

**Casi todo era Skulley dos veces.** Sus 32 mallas tienen 147 mil vértices y 290 mil triángulos con skinning, y cada pase que lo dibuja paga ~0.4 ms solo en vértices y triángulos, sin importar la resolución (la sombra, a 160 × 160, cuesta 0.41 ms cuando corre). Además se dibuja DoubleSide: dentro de una malla los triángulos no van de adelante hacia atrás, y muchas caras de atrás pagaban el toon completo antes de que la de enfrente las tapara. Con FrontSide la escena bajaba 1 ms.

### Qué se cambió

| Archivo | Cambio | Ahorro |
|---|---|---|
| `src/lib/prepasoProfundidad.js` | Nuevo. Envuelve el `render` del RenderPass: primero dibuja solo en profundidad, con un `MeshBasicMaterial` sin color y `polygonOffset` hacia atrás, las mallas que se le piden; luego la escena encima, sin volver a borrar. Lo de atrás ya no pasa la prueba de profundidad y no se sombrea. Solo acepta mallas opacas que escriben profundidad y sin discard. Corre una vez al cargar aunque no toque, para compilar su programa ahí. | 0.4–0.6 ms |
| `src/lib/prepasoProfundidad.js` | De paso apaga el ClearPass del RenderPass: el EffectComposer de @react-three/postprocessing pone `autoClear` en true, y three volvía a borrar el mismo buffer al dibujar la escena. Se queda el borrado de three, que además fuerza las máscaras antes de borrar. | 0.14 ms |
| `src/components/mobile/SkulleyFallRig.jsx` | `PrepasoProfundidad`: el prepaso con cráneo, pelo, ojos y las dos piezas del torso que entran a cuadro (`PREPASO_PIEZAS`), y solo con Skulley más alto que la pantalla. | |
| `src/components/mobile/SkulleyFallRig.jsx` | `LucesEscena`: el haz, el charco y el polvo se ocultan con el foco apagado, después de su primer dibujo (`yaDibujado` en `onAfterRender`, así el programa ya está compilado). Las luces del rig no cambian nunca, así que al prenderse no recompila. | 0.54 ms |
| `src/components/mobile/SkulleyFallRig.jsx` | `SignosDuda`: sin salir, escala 0 (se siguen dibujando, sin pixeles; a escala 1 cada uno cubría ~400 × 400 px transparentes). `OjosMadre`: cerrados, `count = 0`. | ~0.07 ms |

Comprobado pixel por pixel contra el camino de antes (borrado doble, sin prepaso, el haz dibujado en 0), en el mismo cuadro: **0 pixeles distintos** en la primera pantalla y en el primer plano de la historia. El programa del prepaso se compila al cargar: contando `linkProgram` durante la historia completa salen los mismos 6 programas que en producción antes del cambio (resueltos en la sección siguiente), ninguno nuevo.

### Por qué el prepaso solo de esas piezas

Medido en la primera pantalla, con el borrado único en los tres casos:

| Prepaso | Cuadro | Ahorro |
|---|---|---|
| Ninguno | 4.49 ms | — |
| Las 32 mallas | 4.14 ms | 0.35 |
| Cráneo, pelo y ojos | 4.09 ms | 0.40 |
| Cráneo, pelo, ojos y dos del torso | 3.86 ms | 0.63 |

Cada malla del prepaso vuelve a pasar por el skinning. En una pieza chica en pantalla (un dedo, una vértebra) eso cuesta lo mismo que lo que ahorra. El ahorro baja con el área de Skulley en pantalla y el costo se queda, por eso en planos abiertos (Skulley más bajo que la pantalla) no corre; en esa cuenta el empate cae cerca de 1.1 pantallas de alto. En un iPhone el sobredibujo opaco casi no cuesta (su GPU descarta lo tapado antes de sombrear), así que ahí el prepaso es casi neutro; en Android y en cualquier computadora ayuda.

### Lo que no se usó

- **FrontSide en las mallas cerradas.** Las 28 mallas de hueso y pelo son cerradas y con la orientación pareja (cero aristas sueltas; los ojos y pupilas no). Con FrontSide la escena baja 1 ms más que con el prepaso, pero en la primera pantalla cambian 3 pixeles, hasta 3/255, en la silueta, donde una cara de atrás le ganaba por redondeo a la de enfrente. Queda para que Oscar lo vea (Pendiente).
- **Quitar el borrado de la pantalla antes del EffectPass.** El triángulo de pantalla completa la cubre entera sin mezcla, pero en un teléfono (GPU por mosaicos) un borrado al empezar es casi gratis y sin él el navegador borra igual.

## 2026-11-15 · Lo que "Conocer la historia" compilaba a media escena

Era el Pendiente 11. Contando `linkProgram` durante la historia en el teléfono salían 6 programas a media escena, igual en producción desde antes del prepaso, y cuatro caían en el cuadro en que pega el rayo. Pasaba lo mismo en el preloader de escritorio, que usa el mismo rig (`SkulleyFallRig`).

### Cómo se midió

Navegador integrado en modo teléfono (Iris Xe, 375 × 812 a densidad 2), servidor de desarrollo, la historia completa (~65 s) con `linkProgram`, `shaderSource` y `attachShader` envueltos: después de cargar para la visita repetida, y antes del bundle con nonce para la primera (ver "Cómo medir"). Para saber qué variante era cada programa, su llave (`renderer.info.programs[i].cacheKey`) se comparó campo por campo con las que ya existían.

### Los seis

| Momento | Programa | Por qué |
|---|---|---|
| 1.2–1.5 s | `Emisive mat`, la esfera de la mano | LlamaMano la oculta desde que carga (en su lugar arde la llama) y la historia la regresa encogida (`sinEsfera`): era su primer dibujo. |
| 12.25 s | `MeshBasicMaterial` transparente | El estallido de PortalBurst: sus casillas están ocultas hasta el primero, la patada del numerito. |
| Golpe del rayo | `Head` y `Eyes` sin skinning | Las piezas de `bakeCharacterPieces` son mallas normales con los materiales del personaje. Los ojos ya tenían una variante sin skinning (la copia de PicarOjos), pero esa geometría no trae `color` y la de las piezas sí, de 4 componentes: otra llave (`vertexAlphas`). El pelo comparte el programa de `Head`. |
| Golpe del rayo | `MeshNormalMaterial` sin skinning | El pase de normales de la tinta (`CharacterNormalPass`) con las piezas. |
| Golpe del rayo | `MeshBasicMaterial` sin skinning ni luces | La silueta de la sombra (`SilhouetteShadow`) con las piezas. |

La esfera y los estallidos ya estaban "montados desde el inicio", pero oculto o fuera de cuadro three no lo dibuja y por lo tanto no lo compila.

### Qué se cambió

| Archivo | Cambio |
|---|---|
| `src/lib/characterPieces.js` | `muestraDePiezas`: una malla sin skinning por cada malla que hornearía `bakeCharacterPieces`, con su material y una geometría que comparte los atributos del personaje menos `skinIndex` y `skinWeight` (los morphs, como en el horneado). No copia vértices y nunca se dibuja: solo es para `gl.compile`. |
| `src/lib/compileAsyncSafe.js` | Acepta `targetScene`: compilar algo suelto con las luces de la escena donde se va a dibujar. Las luces entran a la llave también en los materiales sin luz. |
| `src/components/mobile/SkulleyFallRig.jsx` | `PrecompilaDesarme`, con un render target puesto: compila la escena entera (`gl.compile` recorre lo oculto, así que entran la esfera y los estallidos), las piezas con sus materiales y las luces de la escena, y las piezas con un `MeshNormalMaterial` y con uno blanco sin tone mapping, con las luces de la raíz del personaje (ninguna), que es lo único que dibujan esos dos pases. Después hace el primer uso de cada programa nuevo (leer uniforms y atributos), que también espera a la GPU. |

Dos detalles. Los dos materiales de los pases viven lo que el rig: three tira un programa en cuanto ningún material lo usa, y hasta el golpe solo lo usan ellos. Y el precompilado corre en un efecto de layout, en el mismo commit que monta a Skulley y antes de su primer cuadro, con la raíz sacada del grafo (en ese momento el ref todavía no está puesto). La primera versión corría dos cuadros después de medir el modelo y dejaba un tirón aparte al cargar, de 360 ms en primera visita: la primera consulta síncrona esperaba a que el proceso de la GPU terminara los 6. Junto con el primer cuadro, la GPU compila todo en la misma ráfaga.

### Resultados

| Navegador integrado, modo teléfono | Antes | Después |
|---|---|---|
| Programas compilados durante la historia, visita repetida | 6 | **0** |
| Programas compilados durante la historia, primera visita (nonce) | 6 | **0** |
| Cuadro del golpe, visita repetida | 136 ms | 92 ms |
| Cuadro del golpe, primera visita | **625 ms** | 93–97 ms |
| Cuadro a los 1.5 s, primera visita | 92 ms | ninguno de más de 50 ms |
| Carga, primera visita (cuadros largos) | 344 + 1251 ms | 351 + 602 + 155 ms |
| Carga, visita repetida | 56 + 177 ms | 65 + 194 ms |

En producción (skulleyrad.com, mismo navegador en modo teléfono, visita repetida), antes y después del deploy de `5b9595e`: de 6 programas a **0** durante la historia completa (también 0 `shaderSource` y 0 `attachShader`), y el cuadro del golpe de 128 a 96 ms.

La carga cambia mucho de una corrida a otra (la de después salió menor que la de antes); lo que se revisó es que no aparezca un tirón aparte. En el preloader de escritorio, la historia completa también da 0 programas y 0 `shaderSource`. Lo que queda en el cuadro del golpe es el horneado de las piezas (Pendiente).

Comprobado que no cambia nada a la vista, en la misma página: con el precompilado apagado (`sessionStorage.__sinPrecompila = 1`, solo en desarrollo), el cuadro congelado antes y después de correrlo a mano (`__precompilaDesarme.correr()`), con la llama escondida porque va con su propio reloj. **0 pixeles distintos** en la primera pantalla y en la historia a los 30.5 s (blanco y negro, foco prendido, antes del golpe), con 0 de ruido entre capturas iguales. Lo único que compilar le cambia a un material es su objeto de uniforms (three le da uno nuevo con cada variante): los uniforms del toon son constantes y los de las skins se actualizan en todos los juegos vivos (`liveUniforms`).

## 2026-11-15 (noche) · Skulley tardaba en salir en el teléfono

Oscar: en la primera pantalla del teléfono el personaje "se tarda años en cargarse". Medido en producción, primera visita en un teléfono simulado con 4G y CPU 4× más lenta (un Android de gama media): **10 s** desde que se pide la página hasta que se dibuja Skulley.

### Cómo se midió

Chrome sin ventana con puppeteer-core (el Chrome del sistema), un perfil nuevo por corrida (sin caché de HTTP ni de shaders: primera visita de verdad), 390 × 844 a densidad 3 con agente de Android y touch, y la red y la CPU frenadas por CDP (`Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate`). Dibuja con la Iris Xe, como el navegador integrado. La meta es el primer `drawElements` con más de 20 000 índices en un canvas grande (el cráneo) y el cuadro que lo presenta. Antes del bundle se envuelven `linkProgram` (cuántos programas y cuándo), `getProgramParameter(ACTIVE_UNIFORMS)` (es lo que espera a la GPU en el primer uso de un programa), `fetch`, `Worker` y `getContext`; los long animation frames dan los cuadros largos y el perfil de CPU de CDP (`Profiler`, sobre un build sin minificar) dice qué hay en cada uno. Google Analytics corre como en una visita real, pero sus envíos y el beacon propio van bloqueados (`Network.setBlockedURLs`); en producción, además, `?notrack=1`.

Tres condiciones: sin freno; 4G (10 Mbps, 100 ms) con CPU normal, que se parece a un iPhone o a un Android bueno; y 4G con CPU 4×. En local se sirvió cada build con brotli, como Hostinger, alternando corrida por corrida la base y la nueva: la laptop la comparten otras sesiones y a 4× el ruido entre corridas llega a 2 s.

### En qué se iba

| Causa | Cuánto (Iris Xe) |
|---|---|
| El shader de cuerpo y pelo (`Head`) traía los 8 modos de skin en un solo programa, aunque la skin sea la base: 93 KB de fragment shader con Worley, ruido y destellos. Se compilaba dos veces antes de ver a Skulley: con skinning y sin skinning (las piezas del desarme) | **662 ms cada uno** (en serie; los demás programas, 7–120 ms) |
| Cascada de `lazy()`: index → MobileApp → su home → el rig. Cada chunk se pedía hasta que el anterior bajaba y se montaba | el rig llegaba a 1.2 s sin freno y a 2.5 s con 4G |
| El Draco se pedía hasta que el canvas ya había montado y compilado su primer cuadro, aunque el GLB llevaba segundos descargado | con 4G y CPU 4×, a los **5.7 s** (el GLB acabó a los 3.4) |
| React suspendía el `lazy` del rig aunque su módulo ya estuviera (se entera en un `.then`) y el reintento caía cuando el hilo se desocupaba | hasta 1.6 s después |
| El primer cuadro compilaba uno tras otro lo que no estaba en la ráfaga paralela: el material de normales de la tinta, el del prepaso, el del composer | 50 + 93 + 164 ms |
| Lo que solo usa la historia, en el primer cuadro de Skulley: el numerito (`crearNumerito`) y las piezas del desarme | ~45 ms de CPU + 2 programas |
| Google Analytics corría antes que React (con 4G y CPU 4×) y, si tardaba, en medio de la decodificación del modelo | ~0.5 s del hilo |
| El `AudioContext` de los clics (`preloadSfx`) al montar y el contexto WebGL de prueba del `<head>` | 77 y 153 ms |

Lo que no se pudo quitar: el GLB pesa 1.6 MB por la red y son 1.39 MB de geometría Draco (147 mil vértices); lo duplicado (32 copias de las matrices de los huesos, el JSON) ya lo aplana el brotli. Bajarlo es cambiar el modelo. Con CPU 4× además pesan el parseo de ~2 MB de JS (el chunk de entrada trae toda la App de escritorio), el primer layout de la página con sus fuentes (~0.8 s, se fuerza en `GlitchName` y `useTitulosAjustados`) y dos pasadas de CPU por los 147 mil vértices con skinning (caja y esfera para ordenar, ~0.3 s).

### Qué se cambió

| Archivo | Cambio |
|---|---|
| `src/lib/skinShaders.js`, `src/lib/characterSkin.js` | Variante ligera: `applyCharacterSkinShader(m, { ligera: true })`, la que usa el rig por `prepareSkinMaterial`. Con la skin base no inyecta nada: `Head` pasa de 662 a 100 ms. Con la base el bloque no hacía nada (`uSkinMode` 0, emisión 0), y se comprobó: **0 pixeles distintos** entre las dos variantes en la primera pantalla (954 053 pixeles con contenido, ruido 0). Pasar de la base a una skin recompila (`ligeros`, con `WeakRef`); `conVarianteDeSkin` compila la otra variante sin cambiar la que se ve. Player y el retrato siguen con la completa. |
| `src/components/mobile/SkulleyFallRig.jsx` | `PrecompilaDesarme` en dos fases: en el commit que monta a Skulley, la escena entera y, con las mallas de él, los materiales de la tinta, la sombra y el prepaso (salen juntos y la GPU los compila en paralelo); las piezas del desarme `ESPERA_TRAS_SKULLEY` (20) cuadros después, o en el acto si la historia ya arrancó, y su primer uso hasta que `isReady`. Al abrir el personalizador del teléfono (`personalizaRef.current.eligeSkin`; la historia también prende `activo`), la otra variante de la skin. `PrecompilaComposer`, después del `EffectComposer`, compila sus pases con `transparent` como lo deja `EffectPass.render` (entra a la llave como `opaque`). `useGLTF.preload` al cargar el chunk. El numerito se arma 20 cuadros después. Avisa `skulley-listo` al medir el modelo. |
| `src/App.jsx`, `MobileApp.jsx`, `MobileScrollHome.jsx`, `src/lib/lazyListo.js` | En un teléfono, App pide MobileApp, la home y el rig al cargar el módulo (no en `/admin`, `/help` ni `?pose=1`; la home y el rig solo llegando a la home). `lazyListo`: un `lazy` que le da a React un thenable que responde en el acto si el módulo ya llegó. |
| `index.html` | Preload del Draco (`as=fetch`, como lo pide drei); el GLB en `fetchpriority="low"`; en `/` y `/simple`, Google Analytics entra con `skulley-listo` (+0.8 s) o a los 12 s, en las demás rutas como siempre; sin contexto WebGL de prueba cuando ya hay una señal de equipo ligero (en un teléfono siempre). |
| `src/hooks/useGlobalSfx.js` | `preloadSfx` en `requestIdleCallback`. |

Comprobado después del cambio, en el servidor de desarrollo: la historia completa (80 s, con el rayo) compila **0 programas**; al abrir el personalizador se compilan 2 en segundo plano (`Head` completo, entero y en piezas) y escoger slime, regresar a base y pasar a void compila **0**. El preloader de escritorio y `/simple` sacan a Skulley sin errores. Para la prueba de pixeles hay que esconder la llama y fijar su tinte (`uLlamaParams`) en todos los materiales con banding, ojos incluidos: van con su propio reloj.

Una prueba que falló: diferir también la escena entera (la primera fase) hizo que el primer cuadro compilara uno por uno (`linkProgram` cada 50–100 ms) y Skulley salía 0.5 s **más tarde** que sin diferir nada. Mandar todos los programas juntos es lo que deja a la GPU compilarlos en paralelo.

### Resultados

Primera visita, Skulley dibujado (mediana; en local, 4 corridas alternadas por condición; en producción, 3):

| | Sin freno | 4G | 4G y CPU 4× |
|---|---|---|---|
| Local, antes | 2.58 s | 4.48 s | 8.12 s |
| Local, después | **1.41 s** | **3.71 s** | **7.56 s** |
| Producción, antes (`index-CKGpeZ3M`) | 3.10 s | 4.70 s | 7.87 s |
| Producción, después (`index-Nb1h-ftk`, `4867231`) | **1.83 s** | **4.14 s** | 7.95 s |

Con 4G el piso es la descarga del GLB (~2.7 s en local, ~3.4 s en producción, igual antes y después: la prioridad baja no lo atrasó). Skulley salía 1.3 s después de que acababa el modelo y ahora 0.7 s (en local, de 1.8 a 1.0 s), porque los chunks de JS llegan juntos a ~1.7 s y el canvas ya está listo cuando llega el modelo. Con CPU 4× en producción no se nota (7.87 → 7.95 s, dentro del ruido; en local 8.12 → 7.56): ahí manda el hilo principal (lo de "Lo que no se pudo quitar"). Producción tiene además ~1 s de TTFB en el HTML y el chunk de entrada en primera visita (Hostinger), que no cambia.

## 2026-11-16 · La skin Inferno

Inferno suma la llama del mohawk (`LlamaMano fuente="pelo"`, con sus brasas) y un shader de fuego en el cuerpo (`skinShaders.js` modo 4: tres octavas de ruido por pixel). El campo del mohawk escribe `gl_FragDepth` (cada pixel a la profundidad de sus bocanadas), y como es el mismo programa, la mano y las bolas también lo escriben (en su plano): eso apaga el descarte temprano por profundidad en esos dibujos.

Medido en el Brave de Oscar (RTX 4060, 2560 × 1398), con una consulta de tiempo alrededor de cada dibujo; en el home la del cuadro completo de `ResolucionAdaptable`:

| | Skin normal | Inferno |
|---|---|---|
| Preloader (la toma más cerrada): llama del mohawk | — | 0.19 ms |
| Preloader: brasas del mohawk | — | 0.015 ms |
| Preloader: cuerpo, todos los pases | 2.35 ms | 2.37 ms |
| Preloader: llama de la mano | 0.20 ms | 0.20 ms |
| Juego: cuadro completo de GPU | 3.4–3.5 ms | 3.2–3.3 ms |
| Customize: llama + brasas del mohawk | — | 0.13–0.17 ms |
| Customize: fps sin medir | 101 | 102 |

Inferno agrega unos 0.2 ms en la toma más cerrada y en el juego no se distingue del ruido. El cuerpo con fuego no cuesta más que el normal (en Customize dos pasadas dieron 4.50 y 5.62 ms con Inferno contra 4.75 con la normal: los relojes de la GPU varían más que la diferencia). La llama de la mano en el preloader bajó de 0.28 ms (2026-11-15) a 0.20: escribir la profundidad no la encareció.

De paso: la llama del mohawk traía 8 casillas de bola de fuego que nunca dispara, 16 dibujos vacíos por cuadro con cualquier skin (cada uno pasa por `setProgram` y sube sus uniforms); ya no se crean.

## 2026-11-22 · Tirones con el bosque, los pétalos y lo demás nuevo

Oscar sentía tirones y lentitud en la home después del bosque, los globos, la estela, el drone y los pétalos. Medido en su Brave (laptop, RTX 4060, ventana de 2276 × 1180 a 1.125×, 240 Hz), en skulleyrad.com, visita repetida:

| | Mediana | p95 | Peor cuadro | GPU |
|---|---|---|---|---|
| Quieto | 8.4 ms | 12.6 ms | 25 ms | 7.9 ms |
| Caminando 20 s | 12.4 ms | 16.8 ms | 650 ms (una vez) | 7.6 ms |

- **Lo peor no era el sitio.** El navegador integrado de Claude tuvo otra copia de la home corriendo (una prueba de los pétalos que quedó abierta) y con las dos a la vez todo se volvía unas 5 veces más lento: el JavaScript (`mixer.update` de 0.09 a 1.1 ms) y la GPU (de 7.6 a 48 ms), y la resolución adaptable bajó al 60 %. Al cerrarla se recuperó. Al medir, cerrar toda otra copia del sitio.
- **La resolución se quedaba trabada.** Si bajaba justo después de subir, se congelaba toda la sesión (y se guarda en sessionStorage). Ahora espera 20 s, 40, 80… y vuelve a intentar.
- **Lo nuevo no es lo caro.** Cada useFrame cronometrado en desarrollo (`window.__r3f()`, envolviendo `internal.subscribers`), quieto: el render con el composer 3.2 ms de JavaScript, el pase de normales de Skulley 1.1, Player 1.1, la sombra 0.4; bosque, pétalos y pasto, menos de 0.25 cada uno. Apagar el bosque no cambió la GPU (11.9 contra 11.8 ms en esa vista).
- **Los esqueletos se calculaban en cada pase.** 52 esqueletos (Skulley y sus props, 5,345 huesos) se recalculaban 146 veces por cuadro y subían 147 texturas de huesos: three lo hace en cada `render()`. Con `lib/esqueletoPorCuadro.js`, una vez por cuadro: 67 texturas por cuadro, y en 2 de 3 corridas el p95 bajó de 12.5 a 8.5 ms (la mediana ya iba a 120 por segundo).
- **El congelón de 650 ms** no se repitió en otras dos vueltas caminando (0 programas compilados). Lo único que compilaba a media partida era la primera viñeta de la visita (2 programas, el texto de troika y la trama): con caché del driver no se nota, sin caché es un congelón. `PrecalentarGlobo` los compila en el warm-up: 0 en la primera frase de Argus y del drone.
- Cada cuadro hace ~4,200 llamadas a WebGL (~420 dibujos); no cambió con lo nuevo.

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
13. **Un warm-up con EffectComposer también compila los pases del composer** (`compilarComposer`): no están en la escena y `compileAsync` no los ve.
14. **El chequeo de errores de shaders va apagado en producción** (plugin de `vite.config.js`). Si un shader truena, el error solo se ve en `npm run dev`: revisar ahí antes de subir.
15. **Transparente en 0 no es gratis:** el shader corre en cada pixel que cubre aunque no sume nada. Se apaga después de su primer dibujo (su programa ya quedó compilado): `count = 0` si es instanciado, escala 0 si es un sprite, y oculto solo donde las luces nunca cambian (el rig; en el home una luz que cambia recompila lo oculto, ver CLAUDE.md).
16. **Una malla DoubleSide grande en pantalla paga sus caras de atrás.** Si no se puede pasar a FrontSide sin que cambie, prepaso de profundidad (`lib/prepasoProfundidad.js`) solo con las piezas grandes: cada pieza del prepaso vuelve a pagar sus vértices.
17. **Montado no es compilado.** Lo oculto o fuera de cuadro no se dibuja y no se compila; `gl.compile` sí lo recorre. Lo que aparece a media escena va al precompilado (en el rig, `PrecompilaDesarme`).
18. **Lo que se crea después se compila con una muestra:** el mismo material en una malla del mismo tipo (sin skinning, instanciada…) y una geometría con los mismos atributos y morphs, porque entran a la llave (el `color` de 4 de los ojos es otra variante). En un pase que dibuja solo un grupo, con ese grupo como `targetScene`: sus luces también entran a la llave.
19. **Un material que solo existe para compilar vive hasta que el programa tenga otro dueño.** Al tirarlo, three tira el programa y se vuelve a compilar después.
20. **El primer cuadro de un canvas manda todos sus programas juntos.** Un `gl.compile` en el commit que monta lo que se va a ver (escena, más lo que los pases dibujan sobre él, más los pases del composer) deja que la GPU los compile en paralelo; sin eso el primer cuadro los crea y los espera uno por uno. Lo que no se ve en ese cuadro va después, en otra ráfaga, y se estrena hasta que `isReady`.
21. **Un shader con variantes por uniform paga todas en cada compilación.** Si una rama casi nunca se usa (las skins con la base), una variante sin ella para la primera pantalla y la completa compilada aparte antes de que se pida.
22. **`React.lazy` suspende aunque el módulo ya haya llegado.** En lo que está en el camino a la primera pantalla, `lib/lazyListo.js`, y el módulo se pide desde antes.

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

### Primera visita en un teléfono simulado (puppeteer)

Para el arranque, no para el ritmo: Chrome sin ventana con puppeteer-core y `executablePath` al Chrome del sistema, un `userDataDir` nuevo en cada corrida (primera visita con caché de shaders vacía), `page.emulate` a 390 × 844 × 3 con agente de Android, y por CDP la red (`Network.emulateNetworkConditions`) y la CPU (`Emulation.setCPUThrottlingRate`). `page.evaluateOnNewDocument` mete la instrumentación antes del bundle. Para no ensuciar Google Analytics: `Network.setBlockedURLs` con `*google-analytics.com*` y `*analytics.php*` (gtag.js sí carga y corre). Un servidor local para los builds tiene que mandar brotli (si no, los tamaños no se parecen a Hostinger) y no guardar archivos en memoria por ruta: tras recompilar en la misma carpeta servía el `index.html` viejo. A 4× el ruido es grande: comparar alternando corrida por corrida.

### Qué se compila y por qué

Guardar el código completo de los shaders de un material (por ejemplo `Head`) antes y después del clic y comparar las líneas: las diferencias dicen qué cambió (`OPAQUE`, `FLIP_SIDED`, el tamaño de `pointLights[ N ]`). Los defines reales se leen con `/#define [A-Z_]+/`: buscar `USE_SKINNING` en el texto engaña, porque aparece en los `#ifdef` de todos los shaders.

### En qué se va un cuadro largo

Envolver todas las funciones de `WebGL2RenderingContext.prototype` antes del bundle, cronometrar cada llamada y sumarlas por nombre en cubetas de 100 ms. Al final se suman las cubetas del cuadro largo (el long animation frame da inicio y duración). Así salió que la mitad del pre-pase eran los logs de shaders. Las llamadas síncronas (`getProgramInfoLog`, `getShaderInfoLog`, `getProgramParameter`) cargan con la espera de todo lo que el proceso de la GPU tenía en cola, así que su tiempo dice "aquí se esperó", no "esto es lento".

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
- El navegador integrado de la app de escritorio dibuja con la Iris Xe, no con la RTX 4060. Revisar siempre con `WEBGL_debug_renderer_info` qué GPU se está midiendo.
- En el modo por objeto, la consulta de tiempo le suma algo a cada dibujo y el primero de cada pase carga con el cambio de destino o el borrado pendiente. Sirve para ver qué pesa; los totales se toman por llamada o por cuadro.
- Saltar en la historia con `__historiaT` hornea las piezas en ese momento, así que compila lo del golpe aunque no se llegue a él. Para contar compilaciones, la historia se deja correr sola.
- La historia no se congela con `setFrameloop('never')` y `performance.now` fijo: la cámara y el grano siguen otros relojes. Con su pausa (el botón o K) y ~3 s para que se asiente, el cuadro queda quieto.
- Picar "Conocer la historia" con `.click()` desde la consola no precarga las voces (se piden al pasar el mouse): el arranque cuesta un cuadro de ~400 ms, contra ~110 ms con el mouse.

## Pendiente

Por orden de lo que más se nota:

1. **El warm-up del home detrás de una sección** (mejorado el 2026-11-11 en la tarde) cuesta, mientras se lee la sección, un cuadro de ~105–115 ms (React montando esferas y Argus) y el pre-pase, ~175 ms de JavaScript de three armando el primer dibujo. Se podría repartir el pre-pase en varios cuadros, dibujando la escena por partes.
2. **Al entrar a WORK**, sus canvas (slime y tarjetas) cuestan dos cuadros de ~0.27 s.
3. **Al entrar el texto del preloader** quedan dos cuadros de ~90 ms: React montando las ~900 piezas de la voz y la preparación del canvas a los 1.5 s (medir ~450 letras y pintar la hoja). Se podría armar la hoja en un rato libre durante los 2.3 s en que las runas esperan.
4. **La parte síncrona del `gl.compile` del retrato** cuesta ~120 ms al cargar una sección directo (armar los programas de Skulley con su banding).
5. **El globo de diálogo de Skulley** compila al aparecer (~67 ms).
6. **El montaje de los personajes del About** cuesta un cuadro de ~65 ms: React clona los modelos, crea materiales y contornos, y `measureShape` saca la forma de choque con k-means sobre ~52 mil vértices. Leer el GLB es otro de ~40–65 ms. Las formas de choque son fijas por modelo: se podrían calcular una vez fuera del navegador y guardarse.
7. **El warm-up del home todavía congela 0.5–2 s en primera visita**, aunque ya detrás de la palabra quieta: los materiales de override (pase de normales, sombra silueta) se compilan sin `compileAsync`, porque `gl.compile` no mira `scene.overrideMaterial`. Los del composer ya se precompilan. No se ve, pero alarga la espera de la palabra en máquinas lentas.
8. **La primera pantalla del teléfono** (desglosada el 2026-11-15) quedó en 3.9–4.0 ms de GPU en la Iris Xe a 750 × 1624. Lo que queda sin bajar, porque cambiaría la imagen o es una obra grande:
   - **Los vértices de Skulley**: 147 mil con skinning y 290 mil triángulos, ~0.4 ms por pase completo sin importar la resolución, en la escena, el pase de normales, la sombra (un cuadro sí y uno no) y, en parte, el prepaso. Casi todas las piezas van atadas a un solo hueso: como mallas rígidas colgadas de su hueso no pagarían skinning, pero el numerito, el desarme, el pase de normales y la sombra cuentan con `SkinnedMesh`. Bajarle polígonos al modelo cambia cómo se ve.
   - **FrontSide en las 28 mallas cerradas**: 1 ms menos que hoy, con 3 pixeles distintos (hasta 3/255) en la silueta de la primera pantalla. Falta que Oscar lo vea y revisar las piezas del desarme.
   - **El buffer del composer en media precisión** (8 bytes por pixel, lo escriben la escena y lo lee el EffectPass). En RGBA8 con sRGB sería la mitad de memoria, pero cambia lo que pasa de 1 y los degradados oscuros.
   - **El EffectPass (0.52 ms)**: la tinta lee 13 veces el buffer de normales en cada pixel de Skulley (65 % de la pantalla en la primera).
   - **El pase de normales (0.94 ms con su borrado)**: otra pasada completa de Skulley. Juntarlo con la escena (dos salidas en un dibujo) obligaría a tocar todos los materiales.
   - `resolutionScale={0.85}` del EffectComposer del rig no hace nada: en @react-three/postprocessing solo escala el pase de normales del propio composer (`enableNormalPass`), que aquí no se usa. El composer dibuja a resolución completa.
9. **Los ojos rojos de la furia** cuestan 1 ms de GPU en el primer plano de la historia (Iris Xe): los tres grandes desenfocados cubren media pantalla con el shader completo de glitch y rayos. Duran unos 3 s.
10. **El haz del foco prendido** cuesta ~0.29 ms por dibujo (son dos) en los primeros planos de la historia: el ruido de los rayos corre en cada pixel del cono.
11. **El horneado de las piezas del desarme** cuesta ~92 ms en el cuadro del golpe (visita repetida, Iris Xe), ya sin compilaciones: `bakeCharacterPieces` pasa los 147 mil vértices por `applyBoneTransform` en el hilo principal. Se hornea en el golpe a propósito, con la pose que se está viendo; se podría repartir o mandar a un Worker con las matrices de los huesos de ese cuadro.
12. **El overlay de WORK dibuja cada cuadro** aunque nada se mueva, a pantalla completa. Podría dibujar solo cuando hay scroll o hover.
13. **La primera pantalla del teléfono con CPU lenta** (medido el 2026-11-15 con 4G y CPU 4×: ~7.9 s en producción, sin cambio después de lo de esa noche). Por orden de peso: (a) el chunk de entrada trae toda la App de escritorio (~600 KB de JS sin comprimir) y en un teléfono solo se usa la rama de MobileApp: separarlo es reestructurar `App.jsx`; (b) el primer layout de la página con sus fuentes, forzado en `GlitchName` y `useTitulosAjustados` (~0.8 s a 4×); (c) dos pasadas de CPU por los 147 mil vértices con skinning en el primer cuadro: la caja del encuadre (`Box3.setFromObject`) y la esfera con que three ordena cada malla (`computeBoundingSphere`), ~0.3 s a 4×; (d) MusicModal (el SR-90) se monta cerrado desde el arranque porque guarda el audio; (e) el GLB (1.6 MB, casi todo geometría Draco) solo baja cambiando el modelo.
