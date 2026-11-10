# SKULLEYGLYPH — ligaduras y puntas (trabajo en curso)

Notas para retomar el rediseño de las ligaduras de la fuente de runas donde lo dejamos el **2026-11-10**. La fuente publicada sigue siendo la **v2.1**; nada de esto ha llegado todavía a `scripts/gen-runes.mjs` ni al sitio. Todo vive en un prototipo aparte: `scripts/runas-ligaduras/`.

Referencia visual del último estado: `scripts/runas-ligaduras/referencia-2026-11-10.png` (arriba el ductus de cada runa; abajo SKULLEYRAD hoy contra la propuesta, con detalles y los tres pesos).

---

## 1. El problema (palabras de Oscar)

Los glifos se inspiran en tres cosas: los bloques del kanji japonés, las ligaduras árabes y las runas nórdicas. Las runas están bien; lo que falla son los **hilos que las unen** y las **puntas**.

- **Las ligaduras no fluyen.** "Se sienten solo puestas porque deben de ir." Salen de lugares que no tienen sentido, como las partes gruesas, y a veces el trazo queda muy *chunky* o mordido.
- **Lo que se busca.** "Como en la escritura árabe, donde la ligadura le da paso a la formación de la siguiente letra y se siente que fluye."
- **Las puntas.** El paso de delgado a grueso era demasiado inmediato y dejaba un cuello con bolita en la punta ("forma de condón usado"). No tiene que pasar en todas las letras: "úsalo a tu favor".

## 2. Lo que se probó y se descartó (no repetir)

1. **Redibujar las runas en su forma unida.** Probé, por ejemplo, el tallo de la K escrito de abajo hacia arriba y las piernas de la A abiertas. **Deforma demasiado los glifos.**
2. **Todas las uniones arriba, como guirnalda.** "Está HORRIBLE." La idea es mezclar: unas arriba, otras abajo, que se vea natural.
3. **Uniones a la altura "que se ve bien", sin lógica de escritura.** "Le hace falta la lógica humana de dónde inician y terminan las letras."
4. Ya rechazados en la v2.1: hilos de grosor parejo y hilos que ondulan ("chetos torciditos").

## 3. Lo que sí funciona (reglas a conservar)

### 3.1 Puntas sin cuello ni bolita
Está en `scripts/runas-ligaduras/brush2.mjs`, una copia de `src/lib/runeBrush.js` con dos cambios:
- **Perfil de punta** `tipW(x) = 1 − (1 − x)^p`. Llega al grosor completo sin hombro y a la punta con pendiente, así que no hace cuello. Los barridos usan `TIP.sweep`; los caminos que se afilan, un largo de punta proporcional (`TIP.len`, `TIP.frac`).
- **El trazo acaba donde se le acaba la tinta.** Antes el radio tenía un mínimo y seguía un tramo con grosor fijo: de ahí salía la bolita. Ahora se recorta donde el radio baja de `minR`. Las barras rematan en corte redondo, así que no todos los trazos acaban igual.

### 3.2 Ductus: cómo se escribe cada runa
La ligadura es el viaje del pincel entre la **salida** de una runa (donde se levanta al acabar su último trazo) y la **entrada** de la siguiente (donde cae para empezar su primer trazo).
- **El grosor dice la dirección del pincel.** Barras, barridos y caminos (`harai`, `sweep`) caen gruesos y se levantan finos. Las gotas y los picos (`dot`, `rise`) caen finos y aprietan al final.
- **Las marcas** (picos de cresta, gotas sueltas, la cresta de la A) se ponen al terminar la palabra, como el punto de la i. No llevan hilo.
- **Si la salida apunta hacia atrás,** la runa podría no unirse, como las letras árabes que no conectan. Lo propuse para la S y **Oscar lo rechazó: la S sí lleva ligadura** (ver pendientes).

### 3.3 Grosor continuo en los dos extremos (pedido de Oscar, para todas las letras)
El hilo **arranca con el grosor exacto con que termina la runa** y **llega con el grosor exacto con que empieza la siguiente**, siguiendo la dirección del trazo. No hay costura: el trazo se adelgaza hasta volverse hilo y el hilo engorda hasta volverse el primer trazo de la otra.

Salidas, según cómo acaba la runa:

| Modo | Ejemplo | Qué hace |
|---|---|---|
| `tip` | onda de la L, barra de la Y | El remate se corta donde ya mide ~1.7× el hilo y el hilo sigue la curva. |
| `press` | pierna de la K, gota de la R | Sale con todo el grosor del apretón y se suelta en el primer tramo. |
| `cusp` | U, base de la A | Cambia de dirección en la punta y nace con el grosor que hay ahí. |
| `peel` | anillo de la E | Nace dentro del trazo, con su grosor, y se separa. |

Entradas:
- `smooth`: llega en la dirección del trazo.
- `cusp`: llega de frente al arranque y se carga solo al final, como el pincel que cae.

**El cambio de grosor va pegado a las runas, en distancias fijas,** y el hilo viaja fino en medio: `OUT` = 0.6–0.75 para soltarse y `IN` = 0.95 (0.42 si llega en punta) para cargarse. Con fracciones del camino quedaba pesado: un trazo grueso paralelo a la U, un paréntesis entre Y y R y un charco en la base de la R.

### 3.4 La referencia que a Oscar le encanta
La unión **A→D de la v2.1**: la base de la A acaba a la izquierda, el hilo regresa por debajo de la base y se vuelve la barra de abajo de la D. Fluye y tiene sentido. La propuesta la conserva.

## 4. Estado de SKULLEYRAD (última versión)

Ductus propuesto (`DUCTUS` en `ductus2.mjs`; números = orden de los trazos del esqueleto):

| Runa | Esqueleto (orden) | Marcas | Entrada | Salida |
|---|---|---|---|---|
| S | rayo | pico | arranque del rayo (arriba a la derecha) | **pendiente**: hoy "no se une" |
| K | tallo → brazo → pierna | triángulo chico | cabeza del tallo, en punta | apretón de la pierna (`press`) |
| U | copa | gota interior | cabeza del brazo izquierdo, en punta | punta derecha, en punta hacia abajo (`cusp`) |
| LL | onda de arriba → onda de abajo | gota | arranque de la onda de arriba | remate de la onda de abajo (`tip`) |
| E | anillo | picos de arriba y abajo | arranque del anillo | desprendimiento en el hombro derecho (`peel`) |
| Y | **triángulo → barra** (como el palito de la t) | — | esquina del triángulo | remate de la barra (`tip`) |
| R | triángulo → **gota** (parte de la runa) | — | esquina de abajo a la izquierda | apretón de la gota (`press`) |
| A | triángulo | cresta | esquina de abajo a la izquierda | punta de la base, regresa por debajo (`cusp`) |
| D | **barra de abajo** → anillo → barra de arriba | — | barra de abajo | (última runa) |

Uniones: K→U sube en hilo fino hasta la cabeza de la U · U→LL baja en punta y se curva hacia la onda · LL→E el remate de la onda se vuelve hilo hasta el anillo · E→Y el anillo se desprende hacia el triángulo de la Y · Y→R la barra baja a la esquina de la R · R→A la gota se arrastra por la base · A→D la base sigue a la barra de la D.

Las runas unidas llevan **0.45 de aire extra** para que el hilo se lea. La palabra queda ~9 % más ancha.

Última opinión de Oscar: **"un poco mejor, aunque a la S le faltó su ligatura."**

## 5. Pendientes, en orden

1. **Ligadura de la S.** La cola del rayo acaba abajo a la izquierda, apuntando hacia atrás. Ideas por probar con la regla de grosor continuo:
   - La cola da vuelta por debajo del rayo (`cusp` en la punta, o una curva que regresa) y sube a la cabeza del tallo de la K.
   - Revisar si el ductus del rayo podría acabar a la derecha.
   - La v2.1 la unía con un arco de panza arriba que no le gustó: no repetir ese arco.
2. **Que Oscar revise el ductus propuesto**: que la Y empiece por el triángulo, que la D empiece por la barra de abajo y que la gota de la R sea parte de la runa. Él decide cómo se escribe cada una.
3. **Definir el ductus de las 26 runas** (y revisar minúsculas y acentos) y enseñárselo en un cuadro como el de la lámina antes de generar nada.
4. **Llevarlo a la fuente** (`scripts/gen-runes.mjs`). La v2.1 usa un hilo de salida y uno de entrada por letra, en glifos de ancho cero y a una sola altura. La propuesta necesita:
   - **Formas contextuales de salida** por runa, con el remate cortado (`tip`/`cusp`) o el apretón soltándose (`press`).
   - **Hilos que dependen del par.** Para no hacer 26×26 hilos: partir cada hilo en media salida y media entrada que se encuentran en el hueco entre runas, en pocos "puertos" (alturas y direcciones) por clase de runa, y elegir el puerto con reglas `calt` por clase.
   - **Runas que no se unen** (si alguna queda así) y el aire extra entre runas unidas.
   - **Las puntas nuevas en todos los glifos**, regenerar `rune-atlas.png` (lo usan portales, láser y PortalBurst), subir la versión a 2.2 y cambiar el `?v=` de las URLs.
5. Revisar Medium y Light: en la lámina aguantan, pero el hilo de Light es muy fino.

## 6. Cómo correr el prototipo

Desde la raíz del repo, con las dependencias instaladas (usa `sharp`, que ya está en el proyecto):

```bash
node scripts/runas-ligaduras/lamina.mjs
```

```bash
node scripts/runas-ligaduras/detalle.mjs
```

Las imágenes salen en `scripts/runas-ligaduras/salida/` (ignorada en git): `lamina.png` (ductus, hoy contra propuesta, detalles y pesos), `palabra.png` y `detalle.png`.

| Archivo | Qué hace |
|---|---|
| `bench.mjs` | Banco de pruebas: carga el pincel y los trazos reales del repo, dibuja con campo de distancia, saca PNG y arma láminas. `wordToday` reproduce la v2.1. |
| `gen-core.mjs` | Copia del núcleo de `gen-runes.mjs` (campo de distancia, contornos, márgenes ópticos e hilos de la v2.1). Si cambia el generador, copiarlo de nuevo. |
| `brush2.mjs` | El pincel con las puntas nuevas (§3.1). |
| `duct.mjs` | Ducto: un trazo continuo con el grosor puesto en puntos clave. Con él se dibujan los hilos. |
| `forms.mjs` | `measure`, `spine2` y `fieldJoined` (los usan los demás). Trae también `FORMS`, el primer intento que deformaba las runas: **descartado**, se queda solo como referencia. |
| `ductus2.mjs` | **Lo vigente**: `DUCTUS` por runa, `PAIR_K` por par y `wordDuctus2`, que une con grosor continuo. Aquí se edita para seguir. |
| `lamina.mjs` / `detalle.mjs` | Arman las imágenes de revisión. |
