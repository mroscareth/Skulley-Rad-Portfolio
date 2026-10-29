# Pendientes

Hilo de lo que falta, para no perderlo entre sesiones.
Última revisión: 2026-10-26.

---

## Bloqueado por tiempo o cuota

**Indexaciones pendientes.** `3d-heads-ii` y `2dheads` ya entraron solas.
Faltan `2dheads-2`, `the-unemployed-alien`, `halloween-characters-i` y la
página nueva de la tienda `lost-and-found-shop/skulley-rad-canvas`. El 24 a
las 16:40 Search Console seguía en "Cuota superada": la ventana es móvil de
~24 h desde que se gastó la noche del 23, así que reintentar después de las
23:00 del 24.

**Reindexar lo que cambió el 24.** `arttoys` y `heritage`. El sitemap ya manda
su `lastmod` real (antes decía la fecha de alta, febrero), así que puede que
Google los vuelva a visitar solo; si no, pedirlo con la cuota.

**Sitemap sin leer.** Reenviado el 24 a las 16:50 con las imágenes ya en URL
absoluta (antes salían relativas: bug de `$site` dentro de la función). La
prueba en vivo de Search Console sobre `/sitemap.xml` dice "La URL está
disponible para Google": Googlebot sí lo recibe. El "No se ha podido obtener"
es la cola de Google, no el servidor; ya no hace falta pasarlo a estático.

---

## Necesita a Oscar

**Conector de Claude: conectado y probado (24 oct).** Ya lo agregaste en
Claude y se usó de verdad: Galactic Conquest se creó, se describió y se
publicó por el conector. Desde ese día también sube archivos
(`create_upload_link`): en Claude Code van por `curl`, sin navegador; en
claude.ai o el celular, el colaborador abre el enlace y arrastra sus fotos.
Queda por hacer:

- Revocar la llave vieja "Llave anterior (otra computadora)" cuando ya no la
  uses (CMS → Acceso → Llaves de acceso). A los colaboradores de la tienda,
  llave con permiso **Tienda**.
- Si en una sesión de Claude no aparecen las herramientas nuevas (26 en vez
  de 21), desconecta y vuelve a conectar el conector: Claude guarda la lista
  de herramientas de cuando se conectó.

**GPTBot recibe 429 — pero importa menos de lo que parecía.** Revisado a fondo
el 24: de los tres agentes de OpenAI, solo GPTBot está bloqueado.
`OAI-SearchBot` (el índice de ChatGPT Search) y `ChatGPT-User` (cuando alguien
le pide a ChatGPT que abra el sitio) responden **200**. O sea que ChatGPT sí
encuentra y sí lee el sitio; lo único que no pasa es que el contenido se use
para entrenar modelos.

El log de 4xx de Hostinger lo confirma: `429`, **0 bytes, 1.3 ms**. A esa
velocidad la petición nunca llegó a PHP ni al disco — es una regla fija por
User-Agent en el borde, no un límite por carga. No aparece ningún interruptor
para eso en hPanel, así que si se quiere quitar hay que pedírselo a soporte de
Hostinger. **Prioridad baja**: muchos sitios bloquean GPTBot a propósito.

**Revisar la ficha de Heritage en Google.** Existe como "The Heritage Creative
Studio" (Av. Ricardo Covarrubias 3300, Distrito Tec, Plaza Mónaco, 81 1797
2333, categoría "Diseñador gráfico") pero se ve **sin horarios, sin fotos y con
el botón "Reclamar este negocio"** a la vista. O no está reclamada o lo está a
medias. Hoy, quien busque "diseñador gráfico Monterrey" encuentra una ficha de
Heritage vacía. Confirmarlo desde la cuenta de Oscar y llenarla.

**Verificar el Google Business Profile personal — pendiente por el video.**
La ficha existe y está llena, pero el panel dice **"0 % verificado"** y **"NO
ES PÚBLICAMENTE VISIBLE"**: hoy no la ve nadie, todo lo cargado existe solo
para Oscar.

Google pide **verificación por video**, que es lo que frenó el 2026-10-24. Para
cuando se retome, el video es de una sola toma continua, sin cortes, y tiene
que mostrar tres cosas: (1) algo que ubique el lugar —la calle, el edificio,
un letrero—, (2) prueba de que ahí se trabaja —el equipo, las piezas, las
herramientas— y (3) que quien graba tiene acceso, entrando o abriendo. Dura
unos 30-60 segundos y se graba desde el celular. Revisarlo tarda días.

Antes de grabar vale la pena abrir el flujo y ver si ofrece **código por
correo**: se dio una dirección postal al crearla, así que puede estar
disponible y evita el video.

Cargado el 2026-10-24: nombre "Oscar Moctezuma", categoría principal
**Diseñador gráfico** más **Artista** y **Diseñador web**, descripción de 490
caracteres, sitio mroscar.xyz, sin dirección pública y cinco zonas (Monterrey,
San Pedro, San Nicolás, Guadalupe, Santa Catarina).

Falta cuando esté verificada:
- **Teléfono**: se dejó vacío a propósito; tiene que ser distinto al de
  Heritage (81 1797 2333) para no atar las dos fichas.
- **Fotos** del trabajo y **perfiles de redes sociales** (Instagram, X,
  Behance), que el editor sí permite agregar.

Nota: **"Ilustrador" no existe** en el catálogo de categorías de Google —
se probó "Ilustrador" e "Ilustra" y solo devuelve coincidencias falsas como
"Industria cosmética". Lo más cercano a frontend developer es "Diseñador web".

**Diferencia de estilo entre 2D Heads I y II.** Las fichas quedaron
diferenciadas como "primer lote" y "segunda vuelta", pero falta el dato
concreto de qué cambia entre una y otra — más sucio, más plano, más color.
Con eso la segunda ficha mejora bastante.

**Best of Behance en el About.** El About vive en la base (CMS → About), no
en el código, así que no lo toqué. Párrafo propuesto, después del de The
Ethereans / The Voxels:

- EN: *Behance's curators picked two of my projects, 3D Heads and 2D Heads,
  for the Best of Behance gallery, and five have been featured across their
  3D Art, Illustration and Photoshop galleries.*
- ES: *Los curadores de Behance eligieron dos de mis proyectos, 3D Heads y
  2D Heads, para la galería Best of Behance, y cinco han aparecido en sus
  galerías de 3D Art, Illustration y Photoshop.*

De paso, el p4 en español tiene dos erratas: "colaboración **co** iconic
design objects" (→ "con Iconic Design Objects") y "proyectos **dónde**" (→
"donde"). El home, el JSON-LD, el FAQ y `llms.txt` ya lo dicen.

**Tickets dorados otorgados antes del 24.** El anti-trampa nuevo solo cubre
partidas desde el deploy del 24. Los tickets que ya existían se ganaron con
la regla vieja (bastaban 47 s); vale la pena revisarlos a mano en el CMS
(usuarios con `golden_ticket=1` y sin `ticket_burned`).

**El post en borrador.** "The Digital Economy Frontier for Creators", 403
palabras en inglés y 440 en español, listo desde febrero. Publicarlo es
decisión de Oscar. Si se publica, antes hay que arreglar el español: tiene
frases de traducción automática ("se convirtió en influencia" por *leverage*,
"ocurrencia tardía" por *afterthought*).

---

## Trabajo técnico pendiente

**Versión para teléfonos: el cartel no pasó, falta rediseñarlo.** El 26 de
octubre se construyó una home aparte para celular —cámara fija, sin escena
3D— y **el diseño se rechazó: se ve plano y nada atractivo**. El código quedó
en el repo pero **apagado**: ningún teléfono cae ahí solo. Solo se entra a
propósito con `?mobile=1`, y `?full=1` fuerza la experiencia completa. Para
reactivarlo hay que poner en `true` las DOS banderas: `AUTO_DETECT` en
`src/lib/mobileExperience.js` y `AUTO_DETECT_PHONE` en el boot inline de
`index.html`. Nada de esto se subió a producción.

Lo que sí sirve y se queda, independientemente del rediseño:

- `src/components/SectionSwitch.jsx` — qué componente monta cada sección, con
  qué props y en qué contenedor de ancho, en un solo lugar. `App.jsx` ya lo
  usa (antes el switch estaba inline con los seis `lazy`). Verificado en
  escritorio: el preloader y `/work` cargan igual que antes.
- El gate de descarga en `App.jsx`: el `import()` de `HomeCanvas` corre **al
  cargar el módulo**, así que ningún early return llegaba a tiempo y la escena
  entera se bajaba aunque no se montara. Ahora está condicionado. Mismo caso
  con el preload del HDRI en `index.html`.

Lo que quedó a medias de esa versión, por si se retoma: el shell no tiene
carrito, cuenta/login, el regreso de Stripe (`?pedido=`), música ni el botón
🎨 del customizer; no hay preloader ni ENTER en teléfono (entra directo); las
secciones van sin marquee de título; y `src/components/mobile/
MobileArgusPrizes.jsx` (los dos boletos en DOM puro, sin WebGL ni el GLB de
2 MB de Argus) existe pero **no está montado** en ningún árbol.

El diagnóstico de fondo **sigue siendo válido** y no depende del diseño que se
rechazó: en un teléfono el sitio monta hoy dos contextos WebGL (la escena y el
retrato, los dos con el personaje riggeado y su propio pase de normales), baja
`zoidian.glb` (2 MB) para un NPC y el HDRI, y el juego de esferas es
inalcanzable ahí (el apuntado con cursor está desactivado en touch, así que se
apunta girando con el joystick; el Silver pide 3,000 puntos). Lo medido con el
cartel andando: de 3 canvas a 1, y cero descargas de `HomeCanvas`,
`HomeScene`, `Player`, `HomeOrbs`, `PostFX`, el retrato, `zoidian.glb` y el
HDRI. El problema a resolver no es si hay que aligerar, es **qué se pone en su
lugar**.

Para el rediseño, lo que no funcionó: título display gigante arriba, el
personaje de cuerpo entero a un lado y los capítulos como lista de colores
abajo, cortados por un filo blanco. Leyó como cartel estático. Falta decidir
una dirección nueva antes de volver a tocar código.

**Correos con Skulley: confirmar en el iPhone de Oscar.** La primera prueba
(25 oct) salió clara en Gmail de iPhone con modo oscuro: Gmail invierte todos
los colores. Se blindó la plantilla (fondos con degradado + texto con
mix-blend-mode; simulado en el navegador, se ve igual que el diseño). Falta
confirmarlo en su iPhone, y de paso en Apple Mail y Outlook. En Gmail con modo
oscuro el texto del botón sale blanco en vez de negro (aceptado).

**Bing Webmaster Tools.** Gratis, y Bing alimenta a ChatGPT. Pide crear o
conectar la cuenta de Microsoft (o importar desde Search Console con permiso
de Google): eso lo tiene que hacer Oscar.

**Fichas de comerciante: avisos no críticos.** La prueba en vivo de
`lost-and-found-shop/skulley-rad-canvas` da Product válido para fragmentos y
para fichas de comerciante, con avisos opcionales. Los que suele pedir Google
son `shippingDetails` (sale de `shop_zones`: tarifas y envío gratis) y
`hasMerchantReturnPolicy` (desde el 25 oct la política existe: 5 días hábiles
desde la entrega, regreso a cargo del cliente, publicada en `/help`; ya no es
"ventas finales"). Agregarlos sube la pieza a la pestaña de Shopping con más datos.

**Anti-trampa: siguiente nivel.** Lo que entró el 24 obliga a transmitir
capturas verosímiles en tiempo real (ver `profile.php`, `ingestGameEvents`).
Un bot que simule una partida entera de ~2 min sigue siendo posible. Si
aparece, el log de PHP lo deja ver (`[profile] game N flagged` y `claimed X,
server saw Y`) y `game_sessions.events` guarda la bitácora de cada partida.
Calibrar los topes (40 pts/s, 700 en 10 s) con partidas reales cuando haya
datos.

---

## Hecho (para no re-preguntar)

- Descargas digitales protegidas (25 oct): solo con cuenta, enlaces de un uso
  de 5 minutos, tope diario y bitácora con aviso de cuenta compartida (y
  pausa) en el CMS, y cada PDF/ZIP sale con los datos del comprador. Mi cuenta
  → Descargas como cards de la tienda. Detalle en CLAUDE.md (Tienda →
  Digitales). Lo que ninguna capa evita: que quien pagó comparta el archivo
  ya descargado; la marca deja rastro.
- Correos con Skulley Rad (25 oct, diseños aprobados por Oscar): plantilla
  `public/api/email-template.php` (logo, Skulley sobre su azul, tarjeta
  oscura, botón magenta, firma "Skulley Rad"; el globo con frases se quitó el
  mismo día). La usan las dos respuestas automáticas de Contacto (general y
  tienda) y todos los de `shop-mailer.php`, en español e inglés. Imágenes en
  `public/email/` (`skulley-hero.jpg`, `skulley-wordmark.png`).
- Render real para crawlers y agentes; el contenido viaja en el HTML
- Canonical, hreflang y JSON-LD por ruta
- Sitemap armado desde la base (16 URLs, antes 6 con fragmentos)
- Propiedad de Search Console dada de alta y verificada
- Las 9 fichas de proyecto reescritas, en inglés y español
- CMS renombrado de "Blog" a "Memories"
- Conector de Claude con archivos (24 oct): enlaces de subida de 1 h por destino (`mcp-upload.php`), galería/portada/orden/papelera por MCP (`mcp-media.php`), subidas del CMS y del conector por la misma `upload-lib.php`; rutas `api/../uploads` sanadas; la portada vieja ya no se borra si sigue en la galería. 26 herramientas.
- MCP remoto como conector de Claude (24 oct): OAuth propio + llaves por persona en el CMS (Access keys), permisos Read only / Store / Everything. 21 herramientas. Antes: MCP fases 1-3 con servidor local y 20 herramientas. Contenido (proyectos, posts) y tienda
  completa (catálogo, pedidos, cupones de Stripe). Con token NO se puede
  reembolsar, cancelar un pedido sin pagar ni reenviar correos al comprador:
  esas tres responden unauthorized y siguen pidiendo la sesión del CMS.
- La sección Codes del CMS ya enseña los promotion codes de Stripe en vez de
  la tabla muerta `cheat_codes`, y se mudó de Monitor a Store. `codes.php` y la
  tabla siguen ahí intactos, solo dejaron de usarse desde el panel.
- The Ethereans fechada y comprobable. La fecha enlaza a la transacción que
  creó el contrato (`Sep-01-2021 08:08:49 PM UTC`, bloque 13141831) y la
  palabra "contrato" al token ETHRS. La afirmación de ser el primer proyecto 3D
  en Ethereum hecho en América Latina se verifica en dos clics, sin tener que
  creerle a nadie.
- Anti-trampa del golden ticket (24 oct): el servidor cuenta las capturas
  en latidos y nunca acepta más que su suma; fechas futuras, deltas
  inventados, ritmo >40 pts/s o rachas >700 en 10 s marcan la partida sin
  ticket; tope de 2 cuentas con ticket por IP cada 30 días.
- Shader de pupilas en el barrido dorado arreglado (24 oct).
- JSON-LD sin el Product falso de The Voxels; Best of Behance en el home,
  el FAQ y llms.txt; Behance en sameAs (24 oct).
- Cada pieza de la tienda con página propia y Product válido para Google
  (`/lost-and-found-shop/{slug}`), enlazada desde el listado y el sitemap.
- Instagram (@mroscar.eth) y X (@mroscareth) conectados a Search Console.
  Los datos de rendimiento tardan días en aparecer; revisar la semana que entra
  qué búsquedas traen gente a esas cuentas — son las palabras que deberían
  estar en las fichas y en el About.
