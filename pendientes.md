# Pendientes

Hilo de lo que falta, para no perderlo entre sesiones.
Última revisión: 2026-10-25.

---

## Bloqueado por tiempo o cuota

**5 indexaciones de proyectos.** Faltan `3d-heads-ii`, `2dheads`, `2dheads-2`,
`the-unemployed-alien` y `halloween-characters-i`. La cuota de Search Console
es de 11 al día en ventana móvil de ~24 h, no se reinicia a medianoche. Se
gastó la noche del 23.

**Reindexar lo que cambió el 24.** `arttoys` (descripción nueva con The Voxels
y link a Behance) y `heritage` (texto nuevo). Google los tiene con la versión
vieja.

**Sitemap sin leer.** Enviado el 23, reenviado el 24. Sigue en "No se ha podido
obtener" con "Última lectura" vacía y 0 páginas. Hipótesis: su único intento
cayó mientras se desplegaba y no ha reintentado. **Si para el 25 sigue igual**,
pasar `/sitemap.xml` de PHP a archivo estático regenerado por cron — eso saca
de la ecuación el rewrite, el PHP y la protección anti-bots de Hostinger.

---

## Necesita a Oscar

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

**El post en borrador.** "The Digital Economy Frontier for Creators", 403
palabras en inglés y 440 en español, listo desde febrero. Publicarlo es
decisión de Oscar. Si se publica, antes hay que arreglar el español: tiene
frases de traducción automática ("se convirtió en influencia" por *leverage*,
"ocurrencia tardía" por *afterthought*).

---

## Trabajo técnico pendiente

**El anti-trampa del golden ticket es débil, y vale dinero.** No es nuevo ni
lo introdujo el reclamo tras login — se vio al implementarlo.

Las constantes de `profile.php` son `GAME_MAX_POINTS_PER_SECOND = 100`,
`GAME_SCORE_GRACE = 300` y `GOLDEN_TICKET_SCORE_THRESHOLD = 5000`. O sea que
para que 5000 puntos sean "verosímiles" basta con que hayan pasado **47
segundos**. Un script puede pedir boleto, esperar menos de un minuto, sellar y
mandar 5000: golden ticket, 35% de descuento real. Lo único que exige es una
cuenta, y las cuentas son gratis y self-serve.

El servidor no tiene forma de saber que de verdad se jugó: solo ve cuándo
empezó, cuándo terminó y qué número le mandaron. Cerrarlo de verdad pide
telemetría durante la partida —latidos periódicos con la progresión del
puntaje— y es un proyecto, no un parche. Mientras tanto se puede subir el
umbral, bajar los puntos por segundo o revisar a mano los tickets otorgados
(`game_sessions` guarda token, tiempos y score de cada partida).

**Shader roto en las pupilas del personaje.** La consola tira
`ERROR: 0:540: 'worldPosition' : undeclared identifier` al compilar el
material `Pupils`. El banding toon le inyecta `vWorldY = worldPosition.y` a un
`MeshBasicMaterial`, que no declara esa variable, así que ese shader no
compila. Las pupilas deberían quedar fuera del banding — son negro unlit a
propósito (DESIGN.md §7.8). Visto el 2026-10-25, no lo introdujo nada de ese
día; se ve en el dev server desde antes.

**Error de datos estructurados en el home.** Search Console marca
"Fragmentos de productos: 1 elemento no válido". Es lo que decide si las piezas
salen con foto y precio en los resultados.

**Las dos menciones a Behance "Best of the Best"** están enterradas a media
descripción en `3d-heads` y `2dheads`. Son una credencial de un jurado externo
y deberían estar en el About y en el home, no solo ahí.

**Bing Webmaster Tools.** Gratis, y Bing alimenta a ChatGPT. Nadie lo hace.

**Schema de producto para la tienda** (`Product` con precio y stock), para
aparecer en Google Shopping orgánico.

---

## Hecho (para no re-preguntar)

- Render real para crawlers y agentes; el contenido viaja en el HTML
- Canonical, hreflang y JSON-LD por ruta
- Sitemap armado desde la base (16 URLs, antes 6 con fragmentos)
- Propiedad de Search Console dada de alta y verificada
- Las 9 fichas de proyecto reescritas, en inglés y español
- CMS renombrado de "Blog" a "Memories"
- MCP fases 1, 2 y 3: 20 herramientas. Contenido (proyectos, posts) y tienda
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
- Instagram (@mroscar.eth) y X (@mroscareth) conectados a Search Console.
  Los datos de rendimiento tardan días en aparecer; revisar la semana que entra
  qué búsquedas traen gente a esas cuentas — son las palabras que deberían
  estar en las fichas y en el About.
