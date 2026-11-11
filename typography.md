# SKULLEYGLYPH — rediseño del trazo y de las runas (v2.2)

El rediseño de la fuente de runas del **2026-11-10**, ya integrado como **v2.2**: las runas están en `src/lib/runeStrokes.js`, el pincel y la pluma en `src/lib/runeBrush.js`, y `npm run gen:runes` arma la fuente y el atlas con ellos. Integrado en local; falta subirlo a producción. El prototipo donde se diseñó sigue en `scripts/runas-ligaduras/` como historial.

Referencia visual del estado actual: `scripts/runas-ligaduras/referencia-pluma-2026-11-10.png` (SKULLEY RAD y las 26 runas con la pluma plana). La lámina anterior, de las ligaduras por ductus con el pincel redondo, es `referencia-2026-11-10.png`.

---

## 1. Hacia dónde vamos

Empezó como un rediseño de las ligaduras y terminó cambiando el trazo y varias runas.

- **Pluma plana en vez de pincel redondo.** Oscar trajo una referencia de letra china en bloque: horizontales gruesas, verticales y diagonales delgadas, cortes rectos y sesgados, cuchillas en media luna y puntos redondos. La imagen no es nuestra y solo vive en local (`salida/referencia-pluma.png`, ignorada en git).
- **La vara son sus runas favoritas: M, N, O, P, Q y R** pintadas con la pluma. De ellas salen las cinco reglas de abajo, y toda runa nueva o corregida se mide contra ellas.

## 2. Las cinco reglas (de M N O P Q R)

1. **Una sola figura grande y cerrada que llena la caja:** caja (N), cúpula (P), óvalo (O, Q), triángulo (R), corchete con diagonal (M). Se ven como bloques sólidos.
2. **De pie y de frente:** las verticales van rectas y casi todo es simétrico. Nada inclinado ni en cursiva.
3. **Peso arriba y abajo, lados delgados.** Lo da la pluma; por eso el hueco queda chico y limpio.
4. **Acentos cortos, verticales, aparte de la figura y acomodados con simetría:** tres abajo (M), tres arriba (O), uno abajo (P, R), dos adentro (Q).
5. **Un solo hueco por runa,** de forma sencilla (rectángulo, media luna, almendra).

La M y la N no cumplen del todo la regla 1 y se quedan; lo mismo la H.

## 3. El trazo

### 3.1 Pluma plana (`pluma.mjs`)
Cada trazo se pinta con rectángulos a lo largo de su camino, no con círculos: una punta plana casi vertical (`NIB.angle` 0.1) que deja todo su alto al moverse de lado y solo su canto al bajar. `NIB = { h: 0.68, w: 0.085, angle: 0.1, ref: 0.46, blade: 0.34, dotMax: 0.7 }`.
- **Presión:** sale del grosor que el pincel le daba al trazo, así que donde el pincel se afilaba la punta se encoge.
- **Remate en diagonal:** al afilarse, la orilla de abajo sigue recta y la de arriba baja hasta clavarse en una punta (antes se encogía al centro y quedaba una cuña).
- **Acentos:** las gotas y los picos (`kind: 'dot'`) se pintan de través, como medias lunas filosas de doble punta con una orilla casi recta. Los muy cortos (menos de `dotMax`) se vuelven puntos redondos.
- `nibField` hace el campo de distancia a la unión de rectángulos girados.

### 3.2 Construcción limpia (`brush5.mjs`)
Antes de la pluma, Oscar señaló que las runas "parecen muchos brochazos para un trazo". No era la brocha sino cómo estaban armadas:
- **Esquinas:** los caminos con esquinas van de un solo grosor (`UNI` 0.41). El grosor que cambiaba con la dirección dejaba una bola en cada esquina.
- **Figuras cerradas** (`closed`): arrancan a media orilla, dan toda la vuelta y se afilan encima de ese mismo tramo. Antes había una bola de inicio con una cola pasándole por un lado.
- **Arranque y remate rectos a voluntad:** `startTaper` / `endTaper` (el grosor sube o baja en línea recta en ese tramo). Con la pluma dan el corte sesgado.
- **Gancho de una sola curva** opcional (`hookStyle: 'curl'`). Hoy ninguna runa lo usa.

`brush5.mjs` hereda las puntas sin cuello de `brush2.mjs` (§3.1 de la versión anterior de este documento): perfil `1 − (1 − x)^p` y el trazo acaba donde se le acaba la tinta.

## 4. Runas que cambiaron (`strokes5.mjs`)

`strokes5.mjs` es una copia de `src/lib/runeStrokes.js` que usa `brush5.mjs`. Ahí están las runas vigentes; las de `src/lib/` siguen como en la v2.1.

| Runa | Ahora | Por qué |
|---|---|---|
| S | Caja de pie con el giro en la misma figura: la tapa se alarga a la derecha y la base a la izquierda, y regresan en curva. Encima, el **mohawk de Skulley**, la cresta de la O (S-10b). | La S de rayo era muy angosta y las diagonales largas no iban de pie. La S-10 con la tapa y la base como piezas aparte se veía sobrepuesta. |
| K | Escudo con dos cuernos (K-2). | La K de tallo y brazos era la que menos seguía el estilo. |
| L | Montículo (trapecio ancho abajo) con una gota adentro (L-1). | La onda no iba con el resto. |
| LL | El mismo montículo con dos gotas. | La ligadura es la L con el acento doble. |
| B | Dos triángulos apilados, como la runa nórdica de la B, ᛒ (B-4). | La caja abierta se leía como la ח hebrea, y cerrada con puntos a los lados desentonaba. |
| D | El ojo crece hasta tocar las dos barras. | Era un ojo chiquito entre barras, no una figura. |
| F / T | El corchete se cierra en caja; las gotas siguen abajo (F) o arriba (T). | Corchetes abiertos. |
| G | Triángulo hacia abajo con una gota debajo: pareja de la R. | Llevaba un gancho. |
| I | El cuenco se cierra con una plancha arriba; la gota sigue encima. | Cuenco abierto. |
| J | Óvalo con una gota debajo. | Llevaba un gancho. |
| X | Dos triángulos que se tocan en el centro (⋈). | Diagonales cruzadas, sin figura. |
| U | Copa recta: lados rectos y fondo plano, con la gota adentro (U-1). | La curva continua era demasiado blanda junto a las demás. |

Ya cumplían y no se tocaron: A, C, E, H, M, N, O, P, Q, R, V, W, Y, Z. El mohawk ahora es un motivo compartido por la A, la O y la S. Ojo con las cajas: C, F, T y N se distinguen solo por los acentos.

## 5. Lo que se probó y se descartó (no repetir)

**Del trazo**
- Hilos de grosor parejo y hilos que ondulan ("chetos torciditos"), de la v2.1.
- Brochas caligráfica, geométrica y mezcla (`brush4.mjs`): sobre runas mal armadas todas se veían como varios brochazos encimados.

**De la construcción de las runas**
- **Planchas gruesas con postes delgados en escuadra:** se leen como letra hebrea (L-D, LL de copa, escalera, doble plancha y dos puntos; la B abierta).
- **Trazos inclinados, ganchos y espirales:** son otro lenguaje (LL-9 de dos ganchos, L-G, K-A con las cuchillas abiertas en diagonal, la S de espiral). Pasó por seguir cada referencia nueva muy al pie de la letra en su runa, sin medirla contra las favoritas.
- Redibujar las runas en su forma unida, todas las uniones arriba como guirnalda y uniones a la altura "que se ve bien", de la etapa de ductus.

**Por runa**
- **K:** la K1 de tallo con brazos, las que recuerdan a la latina (K-A a K-E de la primera tanda), las 15 rúnicas de ensō y triángulo, y la K-A de cúpula con cuchillas abiertas.
- **S:** el rayo angosto, el rayo con barra arriba (se lee como 3), el rayo con arco arriba (toda plancha y sin aire), las espirales (hueco irregular), los sellos, el hexágono, el paralelogramo, el óvalo con media luna (se lee como Ø), el rayo de planchas con mohawk (S-4m2, la última antes de la S-10b) y la S-10 con la tapa y la base como rectángulos pegados.
- **B:** la caja abierta, la caja cerrada con puntos a los lados, el hexágono, la caja con plancha al centro y el óvalo con plancha (B-3, se confundía con la C, la D y la I).
- **L y LL:** la onda, el escalón, plancha con diagonal, plancha con poste y las LL sin postes (medias lunas, tajo, luna, dos tajos).
- **U:** la copa de curva continua y la copa recta con pestañas arriba (se ve hebrea). La U-2, más ancha arriba, quedó como alternativa.

## 6. Ligaduras: no lleva (decidido el 2026-11-10)

La fuente de pluma va **sin ligaduras**: las runas son bloques que se sostienen solos, como la letra china de la referencia. Solo se queda la doble L como ligadura propia (`liga`). Se probaron y se descartaron (`ligaduras-pluma.mjs`, `ligaduras-finas.mjs`):
- Con la pluma: piso corrido (de pie a pie), techo corrido (de cabeza a cabeza) e hilo diagonal.
- Con un hilo fino de verdad, por abajo, a media altura y en diagonal: unían, pero se veían como cuentas en un alambre.

**Segunda fuente con brocha, descartada.** Se probó una variante con el pincel redondo y los hilos de la v2.1 (redonda y ligada) y se veía burda: todo igual de grueso y bolas en las esquinas. Un redondo más fino y un pincel ovalado inclinado tampoco convencieron; Oscar la descartó ("es feo").

El trabajo de ductus de antes (`ductus2.mjs`, `duct.mjs`, `forms.mjs`) queda solo como historial.

## 7. Pendientes, en orden

1. **Subir la v2.2 a producción** (commit y deploy, cuando Oscar lo apruebe). Ya está integrada en local: runas y pluma en `src/lib/`, fuente, ZIP y atlas regenerados en `public/fonts/skulley-glyph/`, `?v=2.2` en `runeAlphabet.js`, `index.css` e `index.html`, y CLAUDE.md al día. Se revisó en el sitio el preloader (intro, título y voz de M.A.D.R.E.), la sección 6 (códice, traductor y descargas) y los portales; el About y el wallpaper usan la misma fuente.
2. **Revisar minúsculas, signos y acentos** con la pluma. Las minúsculas salen solas de `toLower`, pero nadie las ha revisado a fondo.
3. Generar la fuente con la pluma tarda unos 30 s (la v2.1, 2 s). Se puede optimizar el campo de rectángulos si estorba.

Números: se quedan como están (gotas mayas, la barra y el ensō; Oscar, 2026-11-10). Se probó cambiar el uno por un punto redondo y el cero por un óvalo cerrado (`numeros.mjs`) y se descartó.

## 8. Cómo correr el prototipo

Desde la raíz del repo, con las dependencias instaladas (usa `sharp`, que ya está en el proyecto). Las imágenes salen en `scripts/runas-ligaduras/salida/` (ignorada en git).

El alfabeto completo con la pluma (`pluma.png`):

```bash
node scripts/runas-ligaduras/pluma-lamina.mjs
```

Con la referencia de Oscar arriba, si tienes la imagen en local:

```bash
REF=scripts/runas-ligaduras/salida/referencia-pluma.png node scripts/runas-ligaduras/pluma-lamina.mjs
```

La fuente (tres pesos, .ttc, ZIP y atlas) en una carpeta aparte, para revisarla sin tocar la publicada:

```bash
RUNES_OUT=scripts/runas-ligaduras/salida/fuente node scripts/gen-runes.mjs
```

Las ocho runas corregidas, la v2.1 contra la nueva, y el alfabeto con los arreglos (`revision.png`):

```bash
node scripts/runas-ligaduras/revision.mjs
```

| Archivo | Qué hace |
|---|---|
| `strokes5.mjs` | Las runas del prototipo; ya pasaron a `src/lib/runeStrokes.js` (las láminas siguen leyendo esta copia). |
| `brush5.mjs` | El pincel del prototipo; ya pasó, limpio, a `src/lib/runeBrush.js`. |
| `pluma.mjs` | La pluma del prototipo (`nibBoxes`, `nibField`); ya pasó a `src/lib/runeBrush.js` como `penBoxes`. |
| `pluma-lamina.mjs` | El alfabeto con la pluma. `REF` agrega la referencia arriba; `OUT` cambia el nombre del PNG. |
| `revision.mjs` | Las ocho runas corregidas: la v2.1 contra la nueva, y el alfabeto con los arreglos (ya aplicados en `strokes5.mjs`). |
| `reglas.mjs` | Las opciones de S, K, L y LL hechas con las cinco reglas (de ahí salieron la K-2 y la L-1). |
| `s-reglas.mjs`, `s-mohawk.mjs` | Las S que conservan algo de S y la S-4 con mohawk. |
| `u-recta.mjs` | Las tres U más rectas (de ahí salió la U-1). |
| `s-final.mjs`, `s-final2.mjs` | Las últimas S (de ahí salió la S-10b). |
| `b-nueva.mjs`, `b-alfabeto.mjs` | Las B nuevas y el alfabeto con la B-3 y la B-4. |
| `numeros.mjs` | Los números mayas con la pluma, hoy contra la propuesta. |
| `pesos.mjs` | Los tres pesos de la pluma (`FONT_WEIGHTS`). |
| `ligaduras-pluma.mjs`, `ligaduras-finas.mjs` | Las ligaduras que se probaron y se descartaron (§6). |
| `bench.mjs`, `gen-core.mjs` | Banco de pruebas: carga el repo, dibuja con campo de distancia y arma láminas. `gen-core.mjs` copia el núcleo de `gen-runes.mjs`; si cambia el generador, copiarlo de nuevo. |
| `brush2.mjs`, `brush3.mjs`, `brush4.mjs` | Pinceles anteriores: puntas sin cuello; gancho de una curva; estilos de brocha (descartados). |
| `duct.mjs`, `forms.mjs`, `ductus2.mjs`, `lamina.mjs`, `detalle.mjs` | La etapa de ligaduras por ductus (§6). |
| `construccion.mjs`, `diagnostico.mjs`, `pincel-*.mjs`, `brocha.mjs` | Láminas del diagnóstico de construcción y de brocha. |
| `k-nueva*.mjs`, `s-*.mjs`, `l-*.mjs`, `ll-*.mjs`, `s-k-*.mjs` | Historial de opciones descartadas (§5). Se pueden borrar cuando ya no hagan falta. |
