# Features por construir

## La ofrenda del Día de los Skulleys (en construcción)

Pedido de Oscar, 2026-11-24. Hecho hasta hoy: la canción rota que se recompone, el cruce con la música al acercarse al portal, el estado de las ofrendas, la plaza (pétalos, antorchas, estelas, oscuridad, rayos de luz y el portal apagado) y los seis objetos, que caen en su lugar al poner cada ofrenda. Lo demás está abajo, en orden.

### La historia

- El usuario consigue seis objetos importantes para Oscar y los lleva al portal de SKULLEYGLYPH, como ofrendas de Día de Muertos. Unos se consiguen con M.A.D.R.E. y otros con Argus, con dinámicas que Oscar todavía no define, por caminos nuevos que va a abrir en el mapa.
- En la plaza del portal suena "Dia de los Skulley" (canción de Oscar, estilo mexicano para Día de Muertos). Al principio suena rota, en pedazos con la reverb al revés de la historia, y con cada ofrenda se recompone, hasta quedar completa. Solo se oye y se ve en el reproductor en ese lugar; con la ofrenda completa se desbloquea en el reproductor.
- El último paso: Skulley se duerme con la almohada atrás del portal, junto a las barricadas. Eso arranca una cinemática: M.A.D.R.E. lo tapa con su cobija (la siesta con la cobija ya existe, `lib/siestaSkulley.js`) y dice un soliloquio. Lamenta que algunos humanos la odien por hacerles la vida más simple. Con humildad revela que solo admira la creatividad de los humanos (sobre todo la de los mexicanos como Skulley) y que su sueño es facilitarnos el camino a nuestro máximo potencial. Guion por escribir con Oscar, con las reglas de voz de CLAUDE.md (Narrativa de M.A.D.R.E.: Oscar es el foco).
- El final: M.A.D.R.E. usa la esfera corrupta en el portal, lo activa y revela memorias que ni ella conocía.
- La sección 6 (hoy la tipografía, `/skulleyglyph`) se va a llamar Goodies o Freebies: un taller donde se bajan cosas gratis, como la tipografía, un generador de códigos QR y más.

### Los objetos

| # | Objeto | Qué representa | Modelo 3D |
|---|---|---|---|
| 1 | iPad | Donde dibuja | Hecho: en su atril de funda, con Apple Pencil y un boceto de Skulley en la pantalla |
| 2 | Cámara Leica | La fotografía | Hecho: tipo M, con su punto rojo y la correa |
| 3 | Álbum de fotos | Sus personas importantes y cercanas | Hecho: abierto, seis fotos y dos sueltas (siluetas pintadas en canvas) |
| 4 | Teclado MIDI tipo Arturia MiniLab 3 (25 teclas, 8 perillas, 8 pads de colores, 4 faders, pantallita) | Su lado musical | Hecho |
| 5 | Caja de cerillos | Regalo de su novia | Hecho: abierta, con cerillos y uno quemado; etiqueta con un corazón |
| 6 | Almohada | Lo deja soñar. Va al último, atrás del portal | Hecho: esponjada, con ribete azul |

Los ids en código: `ipad`, `leica`, `album`, `teclado`, `cerillos`, `almohada` (`OFRENDAS` en `src/lib/ofrendas.js`). Lo que tienen pintado (la pantalla del iPad, las fotos, la etiqueta, los pads) son dibujos provisionales en canvas: si Oscar quiere los suyos, se cambian ahí.

### La plaza del portal (hecha)

- Más oscura que el resto: al acercarse bajan las luces y la niebla de la escena.
- Unos 920 pétalos de cempasúchil: un camino que entra al portal, un anillo alrededor, rayos a cada lugar, una corona en cada lugar y el contorno de la cama, más sueltos.
- Cinco lugares para las ofrendas en pentágono (como los portales del claro). Los objetos van en el piso, dentro de su corona, sin pedestal: Oscar rechazó pedestales de cantera, del color de la escena y tocones. Detrás de cada uno, una estela con su nombre en SKULLEYGLYPH que se prende en naranja cuando la ofrenda está puesta.
- Al poner una ofrenda, un rayo de luz baja del cielo sobre ella. Uno baja siempre sobre el portal.
- Seis antorchas clavadas en el piso, con el fuego toon de la turbina del drone.
- Atrás del portal, junto a las barricadas: el lugar de la almohada, marcado con pétalos y dos antorchas.
- El portal se ve apagado (como descompuesto, con intentos de prender) hasta que se activa; entonces prende como lámpara.

### Hecho

- La canción rota y su cruce con la música: `lib/cancionOfrenda.js`, `lib/zonaOfrenda.js`, `home/ZonaOfrenda.jsx` y el modo ofrenda de `MusicPlayer.jsx` (detalle en CLAUDE.md, Audio).
- El estado: `lib/ofrendas.js` (en el navegador, `skulley_ofrendas`). En desarrollo, `window.__ofrendas.nivel(n)` y `window.__zonaOfrenda(d)` para oírla en cada nivel sin caminar.
- La plaza: `lib/plazaOfrenda.js` (el plano), `home/PlazaOfrenda.jsx` (oscuridad, rayos y antorchas), las estelas en `BosquePintado`, los pétalos en `PetalosCamino` y el portal apagado en `Portal.jsx` (detalle en CLAUDE.md). `window.__ofrendas.poner('album')` prende el rayo y la estela de esa ofrenda; `window.__portalGlifo = 'prendido'` prende el portal.
- Los objetos: `scripts/ofrenda/objetos.py` los modela en Blender (`Character/Ofrendas.blend`) y exporta `public/3dmodels/ofrendas.glb`; `home/ObjetosOfrenda.jsx` los pone en su lugar. Al poner una ofrenda, su objeto cae del cielo con el rayo y rebota; ya puesto es sólido (menos la almohada). Detalle en CLAUDE.md (La plaza de la ofrenda).
- Conseguir, cargar y poner: una misión llama `conseguirOfrenda(id)` y Skulley carga el objeto flotando sobre la cabeza; en la plaza, su lugar lo llama con un rayo tenue y, al llegar a la orilla de su corona, el objeto vuela a su lugar y cae con el rayo. La almohada se pone al último. En desarrollo, `window.__ofrendas.conseguir('ipad')` o `.cargarTodas()`.

### El mapa grande (descartado el 2026-11-24)

Se probó crecer la home a un valle con lugares (el Foro, el Estudio de Skulley, la laguna con la pesca, el Castillo y el Mirador), relieve, senderos y props pintados, detrás de un interruptor de desarrollo. Al recorrerlo, Oscar se quedó con la home de producción (*"compacto definitivamente. lo que tenemos en producción ya me gusta"*), y de los props: *"no sé dónde encajan, la verdad mi trabajo y todo lo demás ya lo resuelven los portales"*. Quiere rescatar algunos, como los letreros de neón y la Renderbox; dónde, está por decidir.

- **Lo que se quitó de la home:** el relieve, lo caminable nuevo, los senderos de lozas, el bosque resembrado, la laguna con sus peces y los props en su lugar. Fuera del repo, en `D:\Work\mroscar\Website\new\Archivo\mundo-grande-2026-11-24\`, quedó:
  - el código del mapa, `Terreno.blend` y `terreno.py`;
  - el plano (`mapaHome.json`, en retícula, más el redondo);
  - los parches de lo que tocaba en la home;
  - el diseño completo (`features-mapa-grande.md`: misiones, pesca e inventario de props).
- **Lo que enseñó:**
  - Un mapa redondo con caminos curvos mata la experiencia top down: hacen falta líneas rectas en los ejes de la cámara y vueltas a 90°.
  - La laguna toon de bandas, rayitas y espuma ancha le pareció horrible.
  - Los senderos de tierra pintada no; si hay caminos, van las lozas del camino escondido.
  - El bosque tupido cansa, y las alturas, el mirador y los arroyos sobraban.
  - Los props necesitan lógica física: escaleras que suben a algo y tubos conectados.
  - Un campo con signo horneado en textura deja líneas finas donde el signo brinca: la distancia se mide en el shader.
- **Lo que se guardó en git** (commit `63faf0f2`, los .blend y sus texturas por LFS), con `scripts/estilo/pintura.py` como pincel de acuarela compartido para hornear el atlas de cada grupo:

  | Grupo | `.blend` | Lo que trae |
  |---|---|---|
  | barriles | `Character/Estilo.blend` | Barril natural y turquesa con el esténcil de Skulley (`public/grungeskullley.png`) |
  | laguna | `Estilo_laguna.blend` | Muelle, puesto de pesca con su neón PESCA y el pez neón, lancha, cubeta, rack de cañas y letrero |
  | foro | `Estilo_foro.blend` | Escenario con ESCENARIO en neón, torres de bocinas del concept del hermano de Oscar, micrófono, ampli y pad |
  | estudio | `Estilo_taller.blend` | El Estudio brutalista con ESTUDIO en neón, grafitis en SKULLEYGLYPH, escalera y tinaco |
  | taller | (en el mismo .blend) | Los muebles del Estudio: escritorio con la Cintiq, la Renderbox Nano, silla tipo Steelcase, estante, caballete con `prtivyImg.png` y los art toys |
  | pesca | `Estilo_pesca.blend` | Cuatro peces con el legendario, señuelos, basura y báscula |
  | rocas | `Estilo_rocas.blend` | Rocas, hito con runa y binoculares |
  | senderos | `Estilo_senderos.blend` | Letrero de cruce, banca, farol, tronco y tocón |

  Los GLB van en `public/3dmodels/estilo/props_<grupo>.glb` y se ven junto a Skulley en `estilo.html` (solo en desarrollo).
- **Ya rescatados en la home** (2026-11-24, detalle en CLAUDE.md, Los props pintados rescatados en el claro): la Renderbox viva en la orilla del claro con su cable y, en lugar de los menhires, un letrero de neón de doble cara por portal con el nombre en runas (antes hubo un hito labrado por portal y un letrero OPEN junto a la tienda; se quitaron).
- **Para reusar los neones:**
  - Son letras de bloque en runas, armadas con `runas_neon.mjs` desde la fuente.
  - Los tubos van como objetos aparte que se llaman `…_Neon_<Letrero>_<n>`.
  - `src/lib/pintado.js` (`NEON`) los prende arriba del umbral del bloom y los hace parpadear letra por letra.
- **Para reusar la Renderbox:**
  - Ventiladores que giran (`…_Ventilador_<n>`) y luces fijas (`…_Luz*`).
  - Temblor y sonido de camión de la basura agudo que escogió Oscar (`lib/ventiladoresRenderbox.js`, por el bus de SFX).
  - Una patada la apaga y otra la prende, con golpe toon sin moverla y chispas: `lib/renderbox.js` y `fx/ChispasGolpe.jsx`.
- **Si un prop va en la home:**
  - Si queda entre la cámara y Skulley, las líneas de tinta de él salen encima, porque el pase de normales solo recorre su grupo. Hace falta un registro de lo que tapa la tinta (los objetos de la ofrenda ya tienen ese problema).
  - Todo con contorno medido en pantalla, compilado en el warm-up y sin ocultar nada.

### Por hacer

1. Las misiones (con M.A.D.R.E. y con Argus); cada una llama `conseguirOfrenda(id)` al ganarse. Las que se diseñaron para el mapa grande (la pesca, la tocada, el castillo, el retrato, los recuerdos y el desvelo) dependían de sus lugares: hay que replantearlas en la home de producción, con Oscar (el diseño viejo está en el archivo del mapa grande).
2. Dormir con la almohada: cinemática y soliloquio, con voz pregrabada como la historia.
3. M.A.D.R.E. activa el portal con la esfera corrupta y aparecen las memorias. Hoy el portal prende cuando se desbloquea la sección 6 (la esfera corrupta que mete el jugador); en la historia lo hará ella.
4. Sección 6 → Goodies / Freebies.
5. Al abrir las misiones: `MISIONES_ABIERTAS = true` (el reproductor enseña cuántas ofrendas van en lugar de "??") y guardar las ofrendas en la cuenta, no solo en el navegador.
6. Decidir si la canción sigue sonando dentro de la sección 6. Hoy, al entrar, regresa la música del reproductor.
7. Medir en el Brave de Oscar lo que cuestan los rayos, la oscuridad y los objetos (en el navegador integrado la resolución adaptable cambiaba de escalón y no se pudo comparar).

## La prisión de M.A.D.R.E. (idea, sin construir)

Pedido de Oscar, 2026-11-24, para trabajarlo después en la oficina. Hoy M.A.D.R.E. castiga a Skulley solo con su rayo; la prisión sería su otro castigo.

### La idea

- Cuando Skulley se porta mal, a veces M.A.D.R.E. no lo parte con su rayo: lo manda a una prisión, otra instancia o mapa aparte de la home, donde el objetivo es escapar.
- El primer lugar para usarla son las escenas de cuando Skulley chamusca a Argus con el rayo de la esfera corrupta (`chamusca` en `lib/escenasArgusMadre.js`). Hoy casi siempre lo defiende y a veces termina en `{ castigo: true }`, su rayo. La prisión sería otro final, por ejemplo `{ prision: true }`. Otros candidatos: las trampas del juego de esferas, patearla o romperle el escudo tres veces.
- No prometerla en ningún texto del sitio hasta que exista: hoy ninguna escena la menciona.

### Lo que ya existe y sirve

- El paso de castigo de las escenas (`correrEscena` en `DroneNPC.jsx`): deja a Argus y va por Skulley. Un paso de prisión iría ahí.
- El iris y los puntos de las transiciones (`lib/irisTransition.js`, `irisCubrir`) para llevarse a Skulley y traerlo de regreso.
- El despiece y el rearme del rayo, por si lo manda en piezas.

### Por decidir con Oscar

1. Cómo se ve la prisión: una celda en el código crudo del borde del mundo, un rincón del data center, otra cosa.
2. Qué hay que hacer para escapar: un acertijo, esquivar, juntar algo, convencer a Argus (que podría ser el guardia).
3. Cuánto dura y qué pasa si no escapa: regresa solo después de un rato o hay que lograrlo.
4. Si cuenta para algo: un logro, un prop, una skin de presidiario.
5. Qué dice M.A.D.R.E. al mandarlo y al verlo regresar, en su voz maternal (lo manda por su bien, nunca como a un niño).

## Láser de la esfera (reemplazó la explosión de la E)

Pedido de Oscar, 2026-11-05. Las cuatro fases están hechas. Queda probarlo en una tablet real, y que Oscar afine la pose en el estudio cuando quiera.

### La idea

Skulley dispara un láser desde la esfera de su mano izquierda.

- **Pose:** estira el brazo con la palma al frente, y la esfera queda delante. La otra mano sostiene el brazo que carga.
- **Carga:** mientras se carga, la esfera brilla cada vez más.
- **Puntería:** sale una mira en el piso que sigue al cursor, y Skulley gira siguiéndola.
- **Disparo:** el láser va de la esfera a la mira.

### Lo que ya existe

| Pieza | Dónde |
|---|---|
| Mantener para cargar, soltar para disparar, carga de 0 a 1 | E en `Player.jsx` (`chargeRef`, `triggerManualExplosion`) |
| Barra de poder en el HUD | `PowerBar.jsx`, se conserva tal cual |
| Cursor convertido en un punto del piso | `aimRef` y `aimTools` en `Player.jsx` |
| Skulley gira hacia el cursor | `aimAngle` en `Player.jsx`, usado por la patada |
| Capa de pose encima de la animación | `applyKickPoseRef` en `Player.jsx` |
| Posar a mano y exportar | `?pose=1`, `src/components/dev/PoseStudio.jsx` |
| Dibujo proyectado en el piso | `src/components/fx/KickTrajectory.jsx` |
| Explosión con empujón radial a las esferas | `triggerManualExplosion` + `onPulse` + `HomeOrbs.radialImpulse` |

### Datos medidos del rig

- 152 huesos de Auto-Rig Pro. Cadena del brazo: `shoulderl` → `arm_stretchl` → `forearm_stretchl` → `handl`.
- La esfera es `Egg_EnergyBall`, hija de `handl`, con material emisivo verde (`emissiveIntensity` 4). Sigue a la palma sin código.
- En `handl` los dedos apuntan a +Y y la esfera sale por -Z (0.37, 0.34, -0.86). Palma al frente = -Z de `handl` hacia el blanco.
- La piel del antebrazo depende de `forearm_twistl` y `forearm_twist_2l`, hijos de `forearm_stretchl`. Girar solo `handl` retuerce la muñeca.

### Lo difícil

1. **Palma al frente:** pide doblar la muñeca hacia atrás y girar el antebrazo. Resuelto en la Fase 1: el estudio reconstruye y exporta los huesos de giro.
2. **Mano derecha agarrando el brazo:** resuelto en la Fase 1 con el control para cerrar la mano. Solo alcanza a medio antebrazo: más adelante el brazo derecho no llega.
3. **Altura del blanco:** cerca pide el brazo hacia abajo y lejos casi horizontal. Girar el cuerpo no lo resuelve. Resuelto en la Fase 2: el brazo se mezcla entre `cerca` y `lejos` con una tabla medida en el juego (`laserReachFor`).
4. **El rayo sale de un lado:** resuelto en la Fase 2: el giro se calcula desde la esfera y descuenta los 15° que el brazo apunta a la derecha del frente de Skulley (`LASER_ARM_YAW`). La palma queda a menos de 1° de la mira.
5. **Sin luces nuevas:** agregar una luz recompila todos los materiales, así que el brillo del impacto es falso (disco y aro en el piso más bloom).
6. **Primer disparo:** resuelto en la Fase 4; ver abajo.
7. **Cursor sobre el horizonte:** resuelto en la Fase 2: si el rayo del cursor no toca el piso se usa su dirección y la mira se queda en el tope.

### Fases

**Fase 1: la pose (hecha el 2026-11-05)**
- Ampliar el Pose Studio: exportar huesos de giro y dedos, y un botón para cerrar la mano.
- Posar tres claves: carga con blanco cercano, carga con blanco lejano y retroceso al disparar.
- Crear `src/lib/laserPose.js` y reproducirlas en el juego con el mismo patrón de la patada.
- Termina cuando, al mantener E, Skulley se ve bien de frente, de lado y desde arriba.
- Quedó así: al mantener E se planta en la pose de carga, y al soltar salta al retroceso y regresa a la animación.

**Fase 2: apuntar y cargar (hecha el 2026-11-05)**
- Mira en el piso que sigue al cursor, con distancia mínima y máxima (`fx/LaserTarget.jsx`, mismo lenguaje que `KickTrajectory`).
- Skulley gira hacia ella, con la corrección del punto 4.
- El brazo se mezcla entre la pose cercana y la lejana según la distancia.
- La esfera crece y brilla con la carga, y un sonido de carga sintetizado en `homeSounds.js`.
- Quedó así: la mira va de 2.2 a 60 unidades del cuerpo, o sea toda la pantalla (pedido de Oscar; antes eran 16, lo justo para los portales desde el centro), y a lo lejos crece y sus líneas engordan para no perderse, pero siempre como aro real en el piso, que es donde sale la explosión (Oscar). Estirarla hacia la cámara la inclinaba y dibujarla de frente la despegaba del piso: las dos se descartaron. Con joystick el tope sigue en 16. Desde que aprietas E la mira va al cursor, sin tener que moverlo, y la patada hace lo mismo (pedido de Oscar). Una tecla nueva le quita el mando, pero las que ya venías apretando no, para poder cargar caminando. A partir de 12 unidades el brazo ya no sube más: la diferencia con la mira son unos 2°, y el rayo la absorbe porque va de la esfera a la mira. Para la Fase 3, `laserAimRef` ya trae la mira y la posición de la esfera.

**Fase 3: el disparo (hecha el 2026-11-05)**
- Rayo toon con bandas duras y centro blanco, siempre montado y apagado cuando no se usa.
- Retroceso, temblor de cámara y sonido.
- Impacto en la mira con marca en el piso. Reutiliza la explosión actual en ese punto; se apaga la onda alrededor de Skulley.
- Quedó así: `fx/LaserBeam.jsx` dibuja tres bandas duras del color de la esfera, que se lee de su material en cada disparo. Dura de 0.3 a 0.7 s y va de fino a grueso según la carga. Al llegar al piso explota el área de contacto: nube de bolas con contorno negro, estrella de impacto, marca quemada y un aro que llega justo hasta donde empuja a las esferas. Pedido de Oscar: cada disparo vive por su cuenta, hasta ocho a la vez, y la nube dura cerca de 1.2 s, así que disparar otro no borra la explosión anterior. También salen runas de la nube y una se queda en el piso parpadeando cada vez más rápido unos 3.5 s; son letras reales del alfabeto, y disparo a disparo el piso va escribiendo SKULLEYRAD. Mientras carga, la esfera absorbe chispas del frente, las mismas de la carga de la patada, más y más rápido según la carga. Tras el jalón del retroceso el brazo regresa a la línea, porque el rayo sigue saliendo de la palma, y la esfera se vacía mientras dispara. El punto de impacto se congela al soltar. Si no hay pose de láser (patada a medias, modo orbe), queda la explosión alrededor de Skulley.

**Fase 4: cierre (hecha el 2026-11-06)**
- Primer disparo: hecho. Medido con un contador de `linkProgram`: pasó de 21 programas compilados a 0. La nube y las runas se quedan en la escena con cero instancias, porque al entrar cambian las luces y lo oculto se recompilaría en el primer disparo. El precalentado espera a que la escena se dibuje de verdad (`onAfterRender`), porque al montarse el preloader todavía la tapa. También se quitó la doble cara, que obliga a three a dibujar dos veces y recompilar, y `TrailSparks` dejó de remontarse en cada tecla (`ComponenteEstable`).
- Puntería con joystick en tablet, donde no hay cursor. Hecho: la dirección del stick es hacia dónde apunta, qué tanto lo empujas es qué tan lejos cae, y al soltarlo la mira se queda. Probado con el stick simulado, falta una tablet real.
- Pruebas contra patada, Customize, desarme, secciones y aterrizaje en home: hechas. Un desarme a media carga la corta sin disparar (`cancel`), en Customize la E no hace nada, y fuera de home ni la E ni la barra espaciadora hacen nada (`powerEnabled`). La E tampoco cuenta si estás escribiendo en un campo.

### Decisiones de Oscar

Confirmadas el 2026-11-05.

1. **¿Quién posa?** Claude deja una primera versión y Oscar hace la final en el estudio.
2. **¿Qué hace el láser en el juego?** Conserva el empujón a las esferas, pero en el punto del impacto.
3. **Tipo de disparo:** rayo corto de medio segundo, más largo y grueso con más carga. Un rayo sostenido que barre esferas es otro juego.
4. **¿Se mueve mientras carga?** Se queda plantado, como en la patada.
