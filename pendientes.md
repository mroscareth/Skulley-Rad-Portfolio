# Pendientes

Hilo de lo que falta, para no perderlo entre sesiones.
Última revisión: 2026-11-02.

---

## Mañana (3 nov): skulleyrad.com como dominio principal

Oscar compró **skulleyrad.com** el 2 de noviembre y quiere que sea el dominio
principal, con **mroscar.xyz redirigiendo (301)** hacia él. Por marca: un `.com`
se recuerda y genera más confianza que un `.xyz`, y los filtros de spam
desconfían menos. Condición: el nombre de Oscar se queda en el título, la
descripción y el contenido ("Oscar Moctezuma Rodriguez — Creative Designer &
3D Artist"). El dominio es del personaje, pero el sitio presenta a Oscar.

**Hecho el 2 nov (paso 1).** skulleyrad.com vive en la misma cuenta de
Hostinger (`ssh mroscar` ya entra; no hizo falta llave nueva). Su
`public_html` ahora es un **symlink** a
`/home/u580124425/domains/mroscar.xyz/public_html`: los dos dominios sirven la
misma carpeta, la misma base y los mismos uploads, y el deploy de siempre los
actualiza a los dos. La página de bienvenida de Hostinger quedó en
`domains/skulleyrad.com/public_html.hostinger-default`. Probado desde fuera:
home, `www`, la API de la tienda, `robots.txt`, `llms.txt` y `sitemap.xml`
responden 200, y el SSL ya estaba activo. mroscar.xyz sigue igual, sin
redirigir.

**Avance del 3 nov.** Oscar creó `hola@skulleyrad.com` en Hostinger (MX, SPF,
DKIM y DMARC ya publicados): decidido, el correo pasa al dominio nuevo. En el
código (sin desplegar todavía): los dos dominios van fijos en
`ALLOWED_ORIGINS` desde `config.php` (se suman a lo que diga
`config.local.php`, que no toqué: el clasificador de permisos no deja leer ese
archivo con secretos), y el paso 2 hecho en 29 archivos: SEO, correos, tienda,
CMS, `hola@skulleyrad.com` y la fecha de `helpContent.js`. El conector (MCP) y
las listas de orígenes se quedan con mroscar.xyz. Hoy el sitio manda los
correos por Gmail con `om@theheritage.mx`.

Con permiso de Oscar, `config.local.php` del servidor ya tiene los orígenes de
skulleyrad.com y `SHOP_CONTACT_EMAIL` = `hola@skulleyrad.com` (respaldo:
`api/config.local.php.bak-20261103`). Leer en voz alta ya funciona en
skulleyrad.com. Faltan en ese archivo: `SITE_URL` (cuando esté Privy),
`ADMIN_URL` y `GOOGLE_REDIRECT_URI` (cuando esté Google, juntos) y, si Oscar
quiere mandar desde el buzón nuevo, el SMTP de Hostinger
(`smtp.hostinger.com`, 587, `tls`, usuario `hola@skulleyrad.com`); la
contraseña la pone él.

**Más tarde el 3 nov (pasos 0 a 3 hechos).** Desde el Chrome de Oscar: Privy
(orígenes de la app y del "Default web app client"), Google Cloud (origen y
las dos URI de regreso en el cliente `239639225794-hde0…`, proyecto
mroscarxyz) y Search Console (propiedad `https://skulleyrad.com/`, verificada
por Analytics). mroscar.xyz ya tenía renovación automática (vence 2029-08-28).
Código desplegado (commit `aaded9f0`) y en `config.local.php`: `SITE_URL`,
`ADMIN_URL` y `GOOGLE_REDIRECT_URI` ya en skulleyrad.com. Probado: login de
Privy abre en skulleyrad.com, Google acepta la URI nueva, canonical y `og:url`
en home y fichas, sitemap y robots con el dominio nuevo. **El CMS ahora se
entra por `skulleyrad.com/admin`** (entrar por mroscar.xyz/admin falla el
`state` hasta que exista el 301). Oscar probó el CMS en skulleyrad.com: entra.

**El 301 está encendido (3 nov).** Regla al inicio de `.htaccess` (respaldo
del anterior en el servidor: `.htaccess.bak-20261103`). Probado: home,
`/work/…`, `/blog`, `/help`, la tienda con su `?cuenta=`, `?lang=es`, `www` de
los dos dominios → skulleyrad.com con el mismo camino; `/api`, `/mcp` y
`.well-known` siguen respondiendo en mroscar.xyz. En Search Console: sitemap
de skulleyrad.com enviado y **Cambio de dirección confirmado** ("Este sitio
web se está trasladando", desde el 3 nov). Dos páginas de ejemplo salieron
como "No se ha podido obtener" en la validación; las dos redirigen bien y el
destino da 200 (fue del lado de Google).

**Lo que queda (nada urgente):**
- ~~Webhook de Stripe~~ **Hecho el 3 nov**: el destino
  `we_1UTZiCHPUX7sqUBjQoaX4fG6` (Workbench → Webhooks) ya apunta a
  `https://skulleyrad.com/api/shop-webhook.php`, con los mismos 6 eventos y el
  mismo secreto (no hubo que tocar el servidor). No se mandó evento de prueba:
  revisar en "Event deliveries" que el próximo pago real entregue 200.
- ~~Correo de salida~~ **Hecho el 3 nov**: el SMTP del servidor es
  `smtp.hostinger.com` (587, `tls`) con `hola@skulleyrad.com` de usuario y
  remitente; Oscar pegó la contraseña en el editor de Hostinger y el inicio de
  sesión se probó sin mandar correo (235). Respaldos con lo de Gmail:
  `api/config.local.php.bak-20261103-smtp`.
- ~~Mudar el conector de Claude~~ **Hecho el 3 nov**: `McpOAuth::publicUrl()`
  ya es `https://skulleyrad.com` (sin `MCP_PUBLIC_URL` en el config), igual que
  los textos del OAuth, los enlaces de subida, el panel de Llaves de acceso del
  CMS y `.mcp.json`. Oscar reconecta el conector en cada Claude con
  `https://skulleyrad.com/mcp`. Las rutas viejas (`/mcp`, `/oauth`, `/subir`,
  `.well-known`) siguen fuera del 301 en mroscar.xyz; cuando ya no haya
  conexiones viejas, se pueden quitar de la excepción.
- El párrafo de "Proyecto" de CLAUDE.md todavía dice "SkulleyRad /
  mroscar.xyz": está en los cambios de narrativa de Oscar sin commitear.

**Lo que hoy NO funciona en skulleyrad.com** (por eso no se anuncia todavía):
- **Login** (Privy) y el **CMS** (Google): falta dar de alta el dominio en sus
  paneles.
- **Leer en voz alta** del blog (`tts.php`): rechaza con 403 todo origen que no
  esté en `ALLOWED_ORIGINS`. Es lo primero que se arregla.
- El canonical, el sitemap y los enlaces de los correos siguen diciendo
  mroscar.xyz. Así debe quedarse hasta el 301, para que Google no lo vea
  como copia.

### Decisiones de Oscar (antes de empezar)

1. **Correo**: ¿`hola@mroscar.xyz` se queda o pasa a `hola@skulleyrad.com`?
   Si cambia, hay que crear el buzón en Hostinger y los registros SPF, DKIM y
   DMARC del dominio nuevo **antes** de mandar correos desde él (si no, caen
   en spam). Mientras tanto se puede seguir mandando desde mroscar.xyz con los
   enlaces ya hacia skulleyrad.com.
2. **Conector de Claude (MCP)**: mudarlo a `skulleyrad.com/mcp` obliga a
   reconectar el conector en cada Claude que lo use (el OAuth va atado a la
   URL). Propuesta: dejarlo en mroscar.xyz al principio (fuera del 301) y
   mudarlo después, con calma.
3. **¿`www` o sin `www`?** Propuesta: `https://skulleyrad.com` sin `www`, y
   `www` redirige ahí.

### Paso 0 — Oscar, en los paneles (necesita su sesión)

- [ ] **Privy** (dashboard → App settings → Domains): agregar
  `https://skulleyrad.com` y `https://www.skulleyrad.com`.
- [ ] **Google Cloud** (el cliente OAuth del login del CMS): en orígenes
  autorizados `https://skulleyrad.com`; en URIs de redirección
  `https://skulleyrad.com/api/auth.php?action=callback`. Sin quitar los de
  mroscar.xyz.
- [ ] **Stripe**: decir si el webhook lo cambio yo por API (endpoint
  `we_1UTZiCHPUX7sqUBjQoaX4fG6`, que hoy apunta a
  `https://mroscar.xyz/api/shop-webhook.php`) o lo cambia él en Dashboard →
  Developers → Webhooks. Y actualizar el sitio web del negocio en Settings.
- [ ] **Search Console**: dar de alta `https://skulleyrad.com` (por GA, como
  mroscar.xyz, o por DNS). El "Cambio de dirección" va hasta después del 301.
- [ ] **Renovar mroscar.xyz con renovación automática**: si caduca, el 301
  deja de existir y se pierden los enlaces viejos y lo que Google tiene.

### Paso 1 — Que todo funcione en skulleyrad.com (yo)

- **Orígenes permitidos**: agregar `https://skulleyrad.com` y
  `https://www.skulleyrad.com` a `ALLOWED_ORIGINS` en `config.local.php` del
  servidor y en `config.php`, y a `$allowedOrigins` de `contact.php`. Eso
  arregla el TTS.
- **Config del servidor** (`config.local.php`, solo vive allá): `SITE_URL`,
  `ADMIN_URL` y `GOOGLE_REDIRECT_URI` a skulleyrad.com. **Respaldo del archivo
  antes de tocarlo.** `GOOGLE_REDIRECT_URI` solo cuando Google ya tenga la URI
  nueva (paso 0), o el CMS deja de entrar.

### Paso 2 — El código (yo; ~145 menciones en ~40 archivos)

Reemplazar mroscar.xyz por skulleyrad.com, revisando cada una. No es un
buscar-y-reemplazar ciego.
- **SEO**: `index.html` (41 menciones: canonical, `og:url`, imágenes de
  compartir, JSON-LD), `seo-shell.php` (`SITE_URL`), `sitemap.php`,
  `sitemap-blog.php`, `robots.txt` (línea del sitemap), `llms.txt`,
  `llms-full.txt` y el canonical que restaura `Section5.jsx`.
- **Correos**: `email-template.php` (pie y `SUPPORT`), `shop-mailer.php` (texto
  de descargas, `Message-ID`, `EHLO`), `contact.php` (`$site`, `EHLO`,
  `Message-ID`). El remitente y `SUPPORT` dependen de la decisión del correo.
- **Tienda**: `shop-download.php` (mensajes), `shop-watermark.php` (pie de
  los PDF y huella), `OrderStatusModal.jsx`, `AccountModal.jsx` y
  `helpContent.js` (`SUPPORT_EMAIL`, según el correo). Ojo: `helpContent.js`
  es política publicada (LFPC): si cambia el correo, cambiar también su fecha.
- **CMS y conector**: `ProjectEditor.jsx` (la dirección de la página),
  `McpTokensPanel.jsx`, `mcp.php` y `mcp-write.php` (las URL que devuelven).
  `mcp-remote.php`, `mcp-oauth.php`, `mcp-oauth-lib.php` (`MCP_PUBLIC_URL`),
  `mcp-upload.php` y `.mcp.json` solo si se muda el conector (decisión 2).
- **Menores**: `ContactForm.jsx` (`source`), `generateRuneFont.js`,
  `composer.json`, el comentario de HSTS en `.htaccess`, `tts.php`
  (comentario), `vite.config.js` (comentario), README, CLAUDE.md, DESIGN.md
  (referencias rápidas).
- Build, deploy (lo de siempre a la carpeta de mroscar.xyz) y probar.

### Paso 3 — Probar en skulleyrad.com antes de redirigir

- [ ] Home de escritorio y de teléfono: preloader, glitch del nombre,
  personalizador, wallpaper 4K, reproductor.
- [ ] Login con Privy, Mi cuenta, descargas (enlace de un uso).
- [ ] Tienda: carrito y checkout hasta la página de Stripe; que el regreso
  (`?pedido=`) caiga en skulleyrad.com. Si se hace una compra real de prueba,
  reembolsarla desde el CMS.
- [ ] CMS: entrar con Google, editar algo y ver la dirección nueva en la ficha.
- [ ] Contacto (y que llegue la respuesta automática), leer en voz alta del
  blog.
- [ ] View-source de `/work/...` y `/blog/...` con canonical y `og:url` en
  skulleyrad.com; `/sitemap.xml` con URLs nuevas.

### Paso 4 — El 301 (cuando todo lo de arriba pasó)

En `public/.htaccess`, después de la regla de HTTPS:

```apache
# mroscar.xyz → skulleyrad.com (2026-11): mismo camino. Fuera del 301 lo que
# llaman servicios de afuera (Stripe no sigue redirecciones; el OAuth del
# conector va atado a la URL).
RewriteCond %{HTTP_HOST} ^(www\.)?mroscar\.xyz$ [NC]
RewriteCond %{REQUEST_URI} !^/(api|mcp|oauth|subir|\.well-known)(/|$)
RewriteRule ^ https://skulleyrad.com%{REQUEST_URI} [L,R=301]

RewriteCond %{HTTP_HOST} ^www\.skulleyrad\.com$ [NC]
RewriteRule ^ https://skulleyrad.com%{REQUEST_URI} [L,R=301]
```

- Probar con `curl -I` varias rutas (home, `/work/x`, `/blog/x`,
  `/lost-and-found-shop`, `/help`, `?lang=es`) y que `/api/...` en
  mroscar.xyz siga respondiendo 200.
- Cambiar el webhook de Stripe a `https://skulleyrad.com/api/shop-webhook.php`
  (mismo `whsec_`, no cambia el secreto) y mandar un evento de prueba.
- Search Console: **Cambio de dirección** de mroscar.xyz a skulleyrad.com y
  enviar el sitemap nuevo. Reacomodo esperado: unas semanas.

### Efectos esperados (avisarle a Oscar, no son bugs)

- El navegador guarda por dominio: al pasar a skulleyrad.com cada visitante
  **vuelve a iniciar sesión** y pierde lo guardado en localStorage (carrito,
  skin y colores de Skulley, idioma, ticket "guardado para después"). Los
  pedidos, descargas, tickets y logros viven en la base: no se pierden.
- El CMS pide entrar otra vez (la cookie `mroscar_session` es del dominio
  viejo).

### Después

- ~~Mudar el conector a `skulleyrad.com/mcp`~~ hecho el 3 nov. Falta que Oscar
  lo reconecte en cada Claude; cuando ya nadie use el viejo, quitar `mcp`,
  `oauth` y `subir` de la excepción del 301.
- ~~Correo nuevo~~ hecho el 3 nov: salen de `hola@skulleyrad.com` por el SMTP
  de Hostinger.
- Ligas en Instagram, LinkedIn, Behance, firma de correo y lo impreso.
- ~~Actualizar la memoria de deploy y CLAUDE.md~~ hecho el 3 nov.

**Cómo deshacer**: quitar el bloque del 301 del `.htaccess` y desplegar. El
symlink se quita con `rm public_html && mv public_html.hostinger-default
public_html` en `domains/skulleyrad.com`. `config.local.php` se restaura de su
respaldo.

---

## Bloqueado por tiempo o cuota

**Indexaciones en skulleyrad.com (desde el 3 nov, tras los arreglos de SEO).**
Pedidas el 3 nov hacia las 16:30 (11, la cuota del día): `/`, `/?lang=es`,
`/work`, `/work?lang=es`, `/work/3d-heads?lang=es`, `/work/2dheads`,
`/lost-and-found-shop`, `henrietta-the-witch`, `skulley-rad-canvas`, el post
en español y `/contact?lang=es`. Faltan, después de las 16:30 del 4 nov:
`/about`, `/about?lang=es`, `/blog`, `/blog?lang=es`, `/lost-and-found-shop?lang=es`,
`/help`, `/ayuda` y los proyectos (`3d-heads`, `3d-heads-ii`, `2dheads-2`,
`arttoys`, `heritage`, `ethereans`, `galactic-conquest`,
`the-unemployed-alien`, `halloween-characters-i`). Search Console a veces
contesta "Se ha producido un error" al pedir: al segundo intento entra. El
home tenía un rastreo de las 14:47 del 3 nov con el canonical viejo
(mroscar.xyz); ya se pidió de nuevo.

**Revisión del 10 nov** (correo de Google "Página alternativa con etiqueta
canónica adecuada"): 27 indexadas y 7 sin indexar. La del correo es
`/contact?topic=shop`, que apunta a `/contact` a propósito: no se toca. Las 5
"Descubierta" del informe (con datos del 5 nov): `/blog`, `2dheads-2` y
`3d-heads-ii` ya salen indexadas al inspeccionarlas; se pidió indexar
`ethereans` y `galactic-conquest`. `/work/2dheads-2?lang=es` sale "Rastreada:
actualmente sin indexar" (Google no le vio valor propio; ayuda el dato de qué
cambia entre 2D Heads I y II, abajo en "Necesita a Oscar"). Pendiente de código:
el post del blog en español cambia su canónica a la versión en inglés al montar
(`Section5.jsx`, `seoUrl` sin `?lang=es`).

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

**"Conocer la historia": lo que falta.** Ya están los ojos de M.A.D.R.E. en
la oscuridad, los rojos de la furia, el fondo (tema de M.A.D.R.E. al revés a
dos voces y vacío), la voz de la furia en el rayo y el rearmado al revés
(12 nov, ver CLAUDE.md). **Tirón al partirse Skulley:** al pegar el rayo se
compilan 5 shaders (medido con `linkProgram`: los materiales de las piezas,
Head y Eyes con toon, un MeshBasic y uno sin nombre), de 34.6 a 35.2 s en
inglés; ya pasaba antes de los ojos. Precalentar las piezas del desarme
montándolas desde el inicio (regla 4 de los tirones). Por revisar con Oscar de
oído: el volumen del fondo (~16 dB bajo la voz) y cuánto demonio lleva la
furia (`DEMONIO` en `historiaMadre.js`). En el teléfono el haz cubre casi todo
el ancho y se ven pocos ojos (los que caen en la luz se quedan cerrados): si
Oscar quiere más ahí, reacomodar `OJOS_CUADRO.vertical`.

**Precalentamiento del home durante la historia.** En una corrida en tiempo
real (12 nov) se compilaron ~100 shaders a media historia (de 33 a 36 s), en un
canvas del mismo tamaño que el del rig; en otras corridas no pasó. Todo indica
que es el precalentamiento del home (`PreloaderWarmRender`) que corre detrás
del preloader cuando hay un rato libre y le cae encima a la historia. Medir con
`linkProgram` por canvas y, si es eso, no precalentar mientras
`escenaRef.current.enHistoria`.

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

- Nueva entrada a las experiencias (13 nov): sin el scroll simulado; la
  cámara se aleja, Skulley voltea arriba, el rayo cae rápido y lo despieza,
  la cabeza queda en medio y el iris se cierra sobre ella (CLAUDE.md,
  DesktopScrollPreloader). Y la música entre el lobby y las experiencias:
  fundido de salida, carga en silencio y fundido de entrada.
- "Conocer la historia" desde las experiencias (13 nov): botón ▶ junto a
  Volver al inicio en la completa y en la simple; el iris negro se cierra
  sobre el Skulley que se ve y la historia corre en el escenario del
  preloader encima (CLAUDE.md, `soloHistoria`).

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
