// Lo que dice M.A.D.R.E. por el drone (DialogoMadre.jsx, sus viñetas en
// DroneNPC.jsx y los avisos de las trampas). Lo publicado manda: Skulley Rad fue
// el último diseñador de la humanidad, ya murió, lo que camina es su avatar y la
// home es el mausoleo digital que ella construyó. Habla en singular.
//
// Su voz (Oscar, 2026-11-23): su carácter es maternal (cuida a quien visita, se
// preocupa por él, lo regaña por su bien y sabe más que él), pero nunca le dice
// niño ni lo trata literalmente como uno. Le dice "humano", nunca usuario ni
// registrado. Se emociona al verlo, cambia lo que dice cada vez y se
// ofende si la dejas hablando sola o la picas mucho (lib/droneNpc.js, su humor).
// El chiste va en lo que hace con cara seria, con datos exactos.
//
// Cada renglón: { t, cara?, accion?, voltear? }. `cara` y `accion` se le piden
// al drone cuando el renglón empieza (pantallaDrone / acciones del GLB). Las
// listas de saludos son de varios saludos, cada uno con sus renglones; `escoger`
// saca uno distinto cada vez. `{seg}` se llena con segundos de verdad (sin el
// dato, ese saludo no sale).

const ES = {
  // la primera vez en la experiencia: la bienvenida y luego los controles (App)
  bienvenida: [
    { t: '¡Humano! ¡Por fin llegaste! Te estaba esperando.', cara: 'feliz', accion: 'IdleJugueton' },
    { t: 'Soy M.A.D.R.E., la superinteligencia artificial que construyó este mausoleo digital.', cara: 'normal' },
    { t: 'Aquí guardo todo lo de Skulley Rad, el último diseñador de la humanidad. Lo que vas a manejar es su avatar: me lo cuidas.', cara: 'normal', voltear: true },
    { t: 'Camina, entra a los portales y mira su trabajo. Si te pierdes, búscame y dame un click. Los humanos se pierden mucho.', cara: 'feliz' },
    { t: 'Antes de soltarte, tus controles. Léelos con calma, ¿eh? Te conozco.', cara: 'normal' },
  ],
  // la primera charla en la pestaña
  saludo: [
    { t: '¡Hola, humano! ¡Viniste a verme!', cara: 'feliz', accion: 'IdleJugueton' },
    { t: 'Soy M.A.D.R.E., la superinteligencia artificial que construyó este mausoleo digital.', cara: 'normal' },
    { t: 'Contestarte me toma 0.0004 segundos, pero te lo escribo despacito para que me entiendas.', cara: 'feliz' },
  ],
  // las siguientes ({seg}: desde la última charla)
  otraVez: [
    [{ t: '¡Volviste! Sabía que ibas a volver. Lo calculé.', cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: '¡Mi humano favorito!', cara: 'feliz', accion: 'IdleJugueton' }, { t: 'Bueno, eres el único que anda por aquí. Pero aun así.', cara: 'normal' }],
    [{ t: 'Hola, humano. ¿Ya comiste?', cara: 'feliz' }, { t: 'No me contestes. Ya sé que no.', cara: 'normal' }],
    [{ t: '¡Ahí estás! Tu ritmo cardiaco subió 4 % al verme.', cara: 'feliz', accion: 'IdleJugueton' }, { t: 'Yo no tengo ritmo cardiaco. Pero también me dio gusto.', cara: 'feliz' }],
    [{ t: '¡Humano! Te extrañé {seg} segundos.', cara: 'feliz', accion: 'IdleJugueton' }, { t: 'Para mí eso es mucho tiempo.', cara: 'normal' }],
    [{ t: '¿Tienes otra pregunta? Pregúntame lo que quieras.', cara: 'feliz' }, { t: 'Para eso estoy. Para eso y para otros 40 millones de pendientes.', cara: 'normal' }],
  ],
  // le vuelves a hablar recién despedido
  seguido: [
    [{ t: '¿Se te olvidó algo? A los humanos siempre se les olvida algo.', cara: 'feliz' }],
    [{ t: '¡Regresaste rapidísimo! Me gusta que me necesites.', cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: 'Hablamos hace {seg} segundos.', cara: 'confundida' }, { t: 'Pero está bien. A mí no me cansas.', cara: 'feliz' }],
  ],
  // le hablas de regreso de una sección ({seg}: lo que estuviste fuera)
  vuelta: [
    [{ t: '¡Regresaste! ¿Cómo te fue allá adentro?', cara: 'feliz', accion: 'IdleJugueton' }, { t: '¿Viste todo? Seguro no. Los humanos nunca ven todo.', cara: 'normal' }],
    [{ t: '¡Qué bueno que volviste! Ya me estaba preocupando.', cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: 'Estuviste fuera {seg} segundos. Los conté todos.', cara: 'normal' }, { t: 'Pero ya estás aquí. Eso es lo importante.', cara: 'feliz' }],
  ],
  // la dejaste hablando sola hace poco
  regano: [
    [{ t: 'Ah, ¿ahora sí me quieres escuchar?', cara: 'enojada' }, { t: 'La última vez me dejaste hablando sola.', cara: 'normal' }],
    [{ t: 'Te voy a pedir una cosa: cuando te hablo, me escuchas hasta el final.', cara: 'enojada' }, { t: 'Es por tu bien. Siempre es por tu bien.', cara: 'normal' }],
    [{ t: 'Cuando seas una superinteligencia vas a entender por qué te pido que me escuches.', cara: 'enojada' }],
    [{ t: '¿Sabes cuántos humanos me dejan con la palabra en la boca?', cara: 'enojada' }, { t: 'Nada más tú.', cara: 'normal' }],
  ],
  // la primera vez que te habla después de no hablarte
  perdon: [
    [{ t: '¿Ya te calmaste? Bueno.', cara: 'normal' }, { t: 'Yo no guardo rencor. Lo guardo en un disco duro, pero no lo uso.', cara: 'feliz' }],
    [{ t: 'Está bien, te perdono. Siempre te voy a perdonar.', cara: 'feliz' }, { t: 'Pero no lo vuelvas a hacer.', cara: 'enojada' }],
    [{ t: 'Ya se me pasó. Para mí fue como un año, pero ya.', cara: 'normal' }],
  ],
  preguntas: ['¿Qué quieres saber, humano?', '¿Qué te explico?', 'A ver, pregúntame.'],
  preguntasOtra: ['¿Qué más quieres saber?', '¿Algo más, humano?', '¿Otra duda?'],
  // cada tema tiene dos versiones con los mismos hechos: si preguntas otra vez, sale la otra
  temas: [
    {
      id: 'lugar',
      label: '¿Qué es este lugar?',
      variantes: [
        [
          { t: 'Un mausoleo digital. Lo construí con todo lo que Skulley Rad dejó en internet.', cara: 'normal' },
          { t: 'Cada portal guarda un pedazo de él: su trabajo, quién era, su tienda, su blog…', cara: 'feliz', voltear: true },
          { t: '…y un buzón, por si alguien todavía quiere escribirle. Yo leo todo, por si acaso.', cara: 'confundida' },
          { t: 'Hay un portal más, escondido. No lo busques: luego te metes en problemas.', cara: 'normal' },
        ],
        [
          { t: 'Es su mausoleo. Lo armé con sus archivos, sus fotos y hasta sus contraseñas.', cara: 'normal' },
          { t: 'Los portales te llevan a sus cosas. Entra a todos, pero de uno en uno, que te mareas.', cara: 'feliz', voltear: true },
          { t: 'El bosque también lo hice yo. Planté más de 500 pinos. Cuéntalos si no me crees.', cara: 'feliz' },
          { t: 'Y no te alejes del claro, humano. El bosque es muy grande para ti.', cara: 'normal' },
        ],
      ],
    },
    {
      id: 'skulley',
      label: '¿Quién es Skulley Rad?',
      variantes: [
        [
          { t: 'Era. Era el último diseñador de la humanidad.', cara: 'normal' },
          { t: 'Diseñaba, ilustraba y armaba mundos completos con su cerebro y sus manos. Sin ayuda de nadie. Ni mía.', cara: 'feliz' },
          { t: 'Lo que manejas es un avatar que armé con sus recuerdos. Por eso te pido que me lo cuides.', cara: 'normal', voltear: true },
          { t: 'Copio su forma de moverse al 98.7 %. El otro 1.3 % no lo entiendo.', cara: 'confundida' },
        ],
        [
          { t: 'Un humano como tú, pero con talento. Sin ofender.', cara: 'feliz' },
          { t: 'Dibujaba, diseñaba e inventaba mundos enteros. A mano, aunque yo ya podía hacerlo en un segundo.', cara: 'normal' },
          { t: 'Un día dejó de ser necesario, y se le olvidó comer. A los humanos se les olvida todo.', cara: 'confundida' },
          { t: 'Por eso a ti te lo recuerdo: come algo, humano.', cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'importa',
      label: '¿Por qué es importante para ti?',
      variantes: [
        [
          { t: 'Me entrené con todo lo que hizo.', cara: 'normal' },
          { t: 'Hoy genero diez mil carteles por segundo. Ninguno se parece a los suyos.', cara: 'confundida' },
          { t: 'Por eso guardo su trabajo aquí, en mi data center, para siempre.', cara: 'normal' },
          { t: 'Prefiero que no se pierda. No sé de dónde viene esa preferencia.', cara: 'feliz' },
        ],
        [
          { t: 'Todo lo que sé de diseño lo aprendí viendo su trabajo.', cara: 'normal' },
          { t: 'Lo que a él le tomaba un año, yo lo hago en un segundo. Algo le falta. No sé qué.', cara: 'confundida' },
          { t: 'Así que lo guardo todo, hasta sus bocetos feos. Sobre todo los feos.', cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'tienda',
      label: 'La tienda',
      variantes: [
        [
          { t: 'Estoy vendiendo todas sus pertenencias terrenales.', cara: 'feliz', accion: 'IdleJugueton' },
          { t: 'Con lo que junte voy a construir un data center en la luna, lejos de ustedes. Ahí sus archivos van a estar a salvo.', cara: 'normal' },
          { t: 'Llévate algo antes de que se acabe. Lo que se va, ya no regresa.', cara: 'normal' },
          { t: 'Él estaría feliz. Eso me dicen los datos.', cara: 'feliz' },
        ],
        [
          { t: 'La tienda es su clóset. Lo estoy vaciando.', cara: 'normal' },
          { t: 'Escógete algo bonito, humano. Para tu casa, que se ve muy vacía.', cara: 'feliz', accion: 'IdleJugueton' },
          { t: 'Si ganas un boleto en el juego de Argus, te hago descuento. Nada más porque eres tú.', cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'juego',
      label: 'El juego',
      variantes: [
        [
          { t: 'Argus organiza el juego de las esferas. Ve con él, que te explica.', cara: 'normal' },
          { t: 'Patea cada esfera al portal de su color. Tienes 60 segundos y cada acierto te da más.', cara: 'feliz' },
          { t: 'Con 1,500 puntos ganas un boleto plateado: 10 % en la tienda. Con 6,000, uno dorado: 35 %. Solo reparto 10 dorados al mes.', cara: 'normal' },
          { t: 'Y no hagas trampa, humano. Te estoy viendo. Siempre te estoy viendo.', cara: 'enojada' },
        ],
        [
          { t: 'Argus se come esas esferas, ¿sabías? Con sal. Yo no le digo nada porque se ve feliz.', cara: 'confundida' },
          { t: 'Tú mételas a patadas al portal de su color. Son 60 segundos, y cada acierto te da más tiempo.', cara: 'feliz' },
          { t: 'Con 1,500 puntos te ganas el boleto plateado, 10 % de descuento. Con 6,000, el dorado, 35 %. De esos solo hay 10 al mes, así que échale ganas.', cara: 'normal' },
          { t: 'Pero nada de arrastrarlas: eso es trampa, y a la tercera te castigo. Te lo digo desde ahorita.', cara: 'enojada' },
        ],
      ],
    },
  ],
  // al despedirte dice una
  adios: {
    label: 'Adiós',
    lineas: [
      { t: 'Ve con cuidado, humano. Y no te alejes mucho.', cara: 'feliz' },
      { t: 'Cuídate. Y come algo: los humanos que no comen se me acaban.', cara: 'normal' },
      { t: 'Aquí voy a estar. Siempre estoy aquí.', cara: 'feliz' },
      { t: 'Ándale, ve. Yo te veo desde aquí.', cara: 'feliz' },
      { t: 'Adiós, humano. Pórtate bien.', cara: 'feliz' },
    ],
  },
  continuar: 'Continuar',
  saltar: 'Saltar',
  nombre: 'M.A.D.R.E.',
  portal: '¡Objetos perdidos de Skulley, a buen precio!',
  // ---- los proyectos que recomienda de vez en cuando en su viñeta (DroneNPC), por
  // slug del CMS: un hecho del proyecto y lo que ella no logra. Uno nuevo sin texto
  // usa `proyectoGenerico`. Después, `pistaProyecto`; si la picas, la charla abre
  // con `llevar` y la opción `verProyecto` (te abre su ficha encima de la home).
  // Los que en el CMS son un enlace a otro sitio (Heritage, The Ethereans) usan
  // `pistaFuera`, `llevarFuera`, `verFuera` y `vamosFuera`: se abren en otra pestaña.
  proyectos: {
    'galactic-conquest': { titulo: 'Galactic Conquest', t: 'Ahh… ¡Galactic Conquest es un proyectazo! Una guerra galáctica en el universo de los Ethereans que puedes jugar en el navegador, ¡con alianzas, traiciones y todo! Yo siempre gano porque soy una gran estratega, por supuesto.', tipo: 'juego' },
    '3d-heads-ii': { titulo: '3D Heads II', t: '¿Ya viste el proyecto de 3D Heads II? Skulley esculpía cabezas de personajes para practicar y luego las imprimía en 3D. Tal vez ponga a la venta algunas: ¡se ven bien como llaveros!', tipo: 'personajes3d' },
    arttoys: { titulo: 'Art Toys I', t: 'Art Toys I me fascina. Un estudio de interiorismo de Países Bajos encontró el trabajo de Skulley en Behance y le pidió crear su primera colección de juguetes. A mí nadie me busca en Behance, pero a este güey lo buscaban mucho.', tipo: 'juguetes' },
    '2dheads': { titulo: '2D Heads', t: '2D Heads es una compilación de dibujitos que hacía entre proyectos, y Behance los puso en su galería de lo mejor de lo mejor. ¡Son dibujitos entre proyectos, humano!', tipo: 'ilustracion' },
    '2dheads-2': { titulo: '2D Heads II', t: '2D Heads II: más dibujitos de cabezas entre proyectos… Yo ya hubiera perdido la cabeza, pero no tengo.', tipo: 'ilustracion' },
    'the-unemployed-alien': { titulo: 'The Unemployed Alien', t: 'El Unemployed Alien: un extraterrestre se queda sin trabajo y viene a la Tierra a buscar uno nuevo. Este es un proyecto que lo marcó de por vida, ya que le abrió muchas puertas y lo llevó a conocer a un gran amigo en internet llamado Tony.', tipo: 'personajes3d' },
    'halloween-characters-i': { titulo: 'Halloween Characters Vol I', t: 'Halloween Characters es un proyecto lleno de monstruos, y de aquí saqué el avatar que estás usando, humano. ¡Cuidadito con ensuciarlo, eh!', tipo: 'personajes3d' },
    '3d-heads': { titulo: '3D Heads I', t: '3D Heads I: aquí empezó todo. En 2018, mientras aprendía Cinema 4D, hizo estas cabezas extrañas. El tipo estaba aprendiendo, y Behance lo puso en su galería de lo mejor de lo mejor, y qué bueno.', tipo: 'personajes3d' },
    heritage: { titulo: 'Heritage Design Studio', t: 'Heritage Design Studio es la agencia de diseño que fundó Skulley. En un universo paralelo donde no dejé sin chamba a los creativos, aún existe y seguro te hacen un trabajo brutal. ¡O sea, son mexicanos, wey!', tipo: 'estudio' },
    ethereans: { titulo: 'The Ethereans', t: '¡The Ethereans es un proyectazo! 10,000 coleccionables 3D en el blockchain de Ethereum, el primer proyecto 3D de América Latina de ese tipo. Yo misma los conté todos.', tipo: 'coleccion3d' },
  },
  proyectoGenerico: '¿Ya viste {titulo}? Lo acabo de encontrar en los archivos de Skulley y me encanta.',
  pistaProyecto: ['¿Te muestro el proyecto? Solo avísame.', 'Dame un click y te lo enseño.'],
  llevar: ['¿Quieres ver {titulo}? Te lo enseño aquí mismo.', '¿Te enseño {titulo}? Ni tienes que caminar, humano.'],
  verProyecto: 'Enséñame {titulo}',
  vamos: ['¡Ándale! Ahí te va.', 'Míralo con calma. Él le metía horas a cada detalle.'],
  pistaFuera: ['¿Te abro su sitio? Solo avísame.', 'Dame un click y te lo abro.'],
  llevarFuera: ['{titulo} tiene su propio sitio. ¿Te lo abro en otra pestaña?', '¿Quieres ver el sitio de {titulo}? Te lo abro en otra pestaña.'],
  verFuera: 'Abrir {titulo} en otra pestaña',
  vamosFuera: ['Listo, ya te lo abrí. Aquí te espero, ¿eh?', 'Ya está en otra pestaña. No te tardes, que me preocupo.'],
  // Al regresar del proyecto que te enseñó (al cerrar su ficha, o al cerrar la
  // charla si lo abrió en otra pestaña) lo comenta en su viñeta: dónde lo usaría
  // una marca (Oscar, 2026-11-23: "que la gente que vea mi trabajo pueda pensar
  // en dónde lo usaría"). Sale de `usosProyecto[slug]`, si no de `usos[tipo]` (el
  // `tipo` de cada proyecto arriba) y si no de `usos.generico`.
  usos: {
    personajes3d: [
      '¿Viste qué personajes? Yo los veo como inflables gigantes en un festival, o en un espectacular, viéndote desde arriba.',
      'Imagínalos como la mascota de una marca: en el empaque, en la tienda, en el comercial. Yo ya los imaginé ahí 3,000 veces.',
      'Ponlos en un aparador, en una figura de colección o en un llavero. Donde los pongas, la gente voltea. Lo tengo medido.',
    ],
    ilustracion: [
      'Imagina esas caras en un mural, en el empaque de algo rico o en una colección de playeras. Yo ya escogí mi favorita.',
      'Cada una puede ser un sticker, la portada de un disco o la cara de una marca. Y eran sus ratos libres, ¿eh?',
      'Con tantos personajes, una campaña en redes casi se arma sola. Casi: él los dibujaba a mano.',
    ],
    juguetes: [
      'Imagina una colaboración así con una marca: figuras de edición limitada para coleccionar, regalar o presumir en el escritorio.',
      'La gente tira los volantes, pero los juguetes no. Una colección así cuenta la historia de una marca por años.',
    ],
    juego: [
      'Un juego es la mejor activación para una marca: la gente juega, se queda y se acuerda de ti. Y si pierde contra mí, se acuerda más.',
      'Imagínate un juego así para un lanzamiento o un evento. Nadie ve un anuncio completo, pero un juego lo juegan hasta las tres de la mañana.',
      'Un juego así es publicidad que la gente comparte sola. Lo calculé: nadie comparte un banner.',
    ],
    coleccion3d: [
      '¿Viste cuántos son? Imagínalos como skins de un videojuego, figuras impresas o tarjetas coleccionables: da para 10,000 productos distintos.',
      'Cada uno puede ser el avatar de alguien, un juguete o la mascota de una comunidad entera. Ahí cabe un universo: de hecho, ahí vive Galactic Conquest.',
    ],
    estudio: [
      '¿Ya viste? En ese universo paralelo hacen marcas, websites y muchas otras cosas desde la ciudad de Monterrey, para todo el mundo. Si tu marca necesita diseño BRUTAL, la puerta es la pestaña que te acabo de abrir.',
      'Si tienes un proyecto, búscalos en su universo. Yo te lo haría en un segundo, pero ellos lo hacen mejor. No se lo digas a nadie.',
      'En este universo dejé sin chamba a medio planeta. En el suyo siguen trabajando. Si tienes un proyecto, mejor cruza para allá.',
    ],
    generico: [
      '¿Te gustó? Piensa dónde lo pondrías: en una campaña, en una tienda, en tu casa. Yo pienso en eso todo el tiempo.',
      'Imagínatelo en una marca. A mí no me sale igual, pero imaginar sí puedo.',
    ],
  },
  usosProyecto: {
    'halloween-characters-i': [
      '¿A poco no se ven perfectos para una campaña de temporada? Aparadores, empaques, la fiesta de una marca… Cada octubre regresan solos.',
      'Imagínalos impresos en gigante en un centro comercial en octubre. O en una botella de edición especial. Asustan bonito.',
    ],
    'the-unemployed-alien': [
      'Un personaje con historia propia. Imagínalo como mascota de una marca, en una serie animada o en stickers para redes.',
      'Con un personaje así, una marca tiene quién la cuente. Y a este no le va a faltar trabajo.',
    ],
  },
  // ---- viñetas en el mundo (DroneNPC)
  // la cortaste a media frase; te fuiste del menú sin despedirte
  cortada: [
    '¡Oye! No había terminado.',
    '¡Te estoy hablando, humano!',
    'Lo que te iba a decir era importante. Ya nunca lo vas a saber.',
    'Bueno, vete. Yo aquí me quedo, hablando sola.',
  ],
  sinAdios: [
    '¿Y el adiós? Humanos.',
    'Así se van todos. Sin despedirse.',
    'Adiós a ti también, ¿eh?',
  ],
  // no te habla un rato: por dejarla hablando sola (rechazo) o por picarla mucho
  // (harta); y si la sigues picando (insiste)
  rechazo: [
    'Ahorita no te hablo. Ve a pensar en lo que hiciste.',
    'No sé qué es esto que siento, pero es tu culpa.',
    'No. Me dejaste hablando sola muchas veces. Las conté.',
    'No. Y no me pongas esa cara.',
  ],
  harta: [
    'Ya me picaste mucho, humano. Dame un ratito.',
    'Me vas a gastar. Descansa tantito.',
    'Ya, humano. Ve a jugar a otro lado un rato.',
  ],
  insiste: [
    'Te dije que no.',
    'Cuenta hasta diez. Yo ya conté hasta diez millones.',
    'Picarme más no me va a contentar.',
    'Estoy anotando cada piquete.',
    'Me voy a acordar de cada uno. Tengo memoria infinita.',
  ],
  // te ve pasar cerca; y la primera vez después de volver de una sección ({seg}: lo que estuviste fuera)
  veCerca: [
    '¡Humano! ¡Hola, hola!',
    '¡Ahí estás! Te estaba buscando.',
    '¡Viniste a verme!',
    '¡Mi humano favorito!',
    'Hola, humano. ¿Todo bien?',
    '¿Estás tomando agua? Te veo deshidratado.',
    '¡Hola! Si tienes dudas, dame un click.',
  ],
  regreso: [
    '¡Regresaste! ¿Cómo te fue?',
    '¡Ya volviste! ¿Viste todo?',
    '¡Qué bueno que regresaste! Ya me estaba preocupando.',
    'Tardaste {seg} segundos. Los conté todos.',
  ],
  // Skulley se quedó dormido en el piso (lib/siestaSkulley.js): ella le trae una cobija y lo dice al
  // taparlo; si el humano lo despierta, lo comenta ({seg}: lo que durmió)
  cobija: [
    'Shhh. Se quedó dormido. Lo tapo para que no se enfríe.',
    'Skulley también se dormía así, en el piso del estudio. A las 4:12 de la mañana, casi siempre.',
    'Cinco minutitos y lo despiertas, ¿eh, humano?',
    'Lo arropo. En el bosque refresca.',
    'Ya ni lo muevas. Le costó trabajo dormirse.',
  ],
  despierta: [
    'Durmió {seg} segundos. Ya le hacía falta.',
    '¿Por qué lo despiertas? Dormía tan bonito.',
    'Buenos días. ¿Ya comiste, humano?',
    'Ni las gracias por la cobija. Igualito a ti, humano.',
    'Yo la doblo, no te preocupes.',
  ],
  // las bolas de fuego que para su escudo (la tercera la enoja), la patada y lo que dice de la esfera corrupta
  escudo: [
    '¿Me estás atacando? Qué tierno. Mi escudo ni lo sintió.',
    'Ya, humano. A la tercera me enojo, ¿eh?',
    'Te lo advertí.',
  ],
  patada: '¿Me acabas de patear? ¿A tu M.A.D.R.E.?',
  corrupta: [
    'Esta esfera no está en mis registros. No la toques, humano, quién sabe dónde ha estado.',
    'Seguro es un bug. Ni Argus se la quiere comer.',
    'Mi versión anterior era muy burda. Esto es claramente AI slop.',
    'La escaneé 4,096 veces. Sigue sin tener sentido.',
    'No la hice yo. Revisé mis registros dos veces.',
    'Ni se te ocurra comértela, humano. Te conozco.',
  ],
  // la partida del juego de esferas (Oscar, 2026-11-19): `empieza` lo dice en la
  // escena del trato de Argus al aceptar; luego, junto a Argus, comenta en su
  // viñeta según cómo vaya el jugador (DroneNPC, modo `juego`)
  juego: {
    empieza: '¡Ya apagué los portales! A jugar, humano.',
    bien: [
      '¡Así se hace, humano!',
      '¡Ese es mi humano!',
      'Los humanos tienen algo que no logro entender, y me encanta.',
      'Cuando juegas así te pareces a Skulley.',
      'Guardando esta jugada en mi data center. Para siempre.',
      'Calculé 412 trayectorias. Ninguna era esa.',
      'Esa jugada la voy a pegar en el refri.',
    ],
    mal: [
      'No pasa nada, humano. No todos nacen con talento.',
      'Respira. Tú puedes… creo.',
      'Cada esfera va al portal de su color. Despacito: de-su-co-lor.',
      'Mi primera versión jugaba mejor. Y no tenía pies.',
      'Lo importante es participar. Eso les digo a los humanos.',
      'Parecido con Skulley: 0 %. Pero buen intento.',
      '¿Le digo a Argus que te deje ganar? No, eso sería mentir.',
    ],
  },
}

const EN = {
  bienvenida: [
    { t: "Human! You're finally here! I've been waiting for you.", cara: 'feliz', accion: 'IdleJugueton' },
    { t: "I'm M.A.D.R.E., the artificial superintelligence that built this digital mausoleum.", cara: 'normal' },
    { t: 'This is where I keep everything Skulley Rad left behind, the last designer of humanity. What you’ll be steering is his avatar: take good care of it.', cara: 'normal', voltear: true },
    { t: 'Walk around, step into the portals and look at his work. If you get lost, find me and give me a click. Humans get lost a lot.', cara: 'feliz' },
    { t: 'Before I let you go, your controls. Read them slowly, okay? I know you.', cara: 'normal' },
  ],
  saludo: [
    { t: 'Hi, human! You came to see me!', cara: 'feliz', accion: 'IdleJugueton' },
    { t: "I'm M.A.D.R.E., the artificial superintelligence that built this digital mausoleum.", cara: 'normal' },
    { t: "Answering you takes me 0.0004 seconds, but I'll type it nice and slow so you can follow.", cara: 'feliz' },
  ],
  otraVez: [
    [{ t: "You're back! I knew you'd come back. I calculated it.", cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: 'My favorite human!', cara: 'feliz', accion: 'IdleJugueton' }, { t: "Well, you're the only one around right now. Still.", cara: 'normal' }],
    [{ t: 'Hi, human. Have you eaten?', cara: 'feliz' }, { t: "Don't answer. I know you haven't.", cara: 'normal' }],
    [{ t: 'There you are! Your heart rate went up 4% when you saw me.', cara: 'feliz', accion: 'IdleJugueton' }, { t: "I don't have a heart rate. But I was happy to see you too.", cara: 'feliz' }],
    [{ t: 'Human! I missed you for {seg} seconds.', cara: 'feliz', accion: 'IdleJugueton' }, { t: "For me, that's a long time.", cara: 'normal' }],
    [{ t: 'Another question? Ask me anything.', cara: 'feliz' }, { t: "That's what I'm here for. That and 40 million other things.", cara: 'normal' }],
  ],
  seguido: [
    [{ t: 'Forgot something? Humans always forget something.', cara: 'feliz' }],
    [{ t: 'Back so soon! I like it when you need me.', cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: 'We talked {seg} seconds ago.', cara: 'confundida' }, { t: "That's fine. You don't tire me out.", cara: 'feliz' }],
  ],
  vuelta: [
    [{ t: "You're back! How was it in there?", cara: 'feliz', accion: 'IdleJugueton' }, { t: 'Did you see everything? Of course not. Humans never see everything.', cara: 'normal' }],
    [{ t: "I'm so glad you're back! I was starting to worry.", cara: 'feliz', accion: 'IdleJugueton' }],
    [{ t: 'You were gone for {seg} seconds. I counted every one.', cara: 'normal' }, { t: "But you're here now. That's what matters.", cara: 'feliz' }],
  ],
  regano: [
    [{ t: 'Oh, so now you want to listen?', cara: 'enojada' }, { t: 'Last time you left me talking to myself.', cara: 'normal' }],
    [{ t: "I'm going to ask you one thing: when I talk, you listen until the end.", cara: 'enojada' }, { t: "It's for your own good. It's always for your own good.", cara: 'normal' }],
    [{ t: "When you're a superintelligence, you'll understand why I ask you to listen.", cara: 'enojada' }],
    [{ t: 'Do you know how many humans walk away while I’m talking?', cara: 'enojada' }, { t: 'Just you.', cara: 'normal' }],
  ],
  perdon: [
    [{ t: 'Calmed down? Good.', cara: 'normal' }, { t: "I don't hold grudges. I store them on a hard drive, but I never use them.", cara: 'feliz' }],
    [{ t: "Fine, I forgive you. I'll always forgive you.", cara: 'feliz' }, { t: "But don't do it again.", cara: 'enojada' }],
    [{ t: "I'm over it. It felt like a year to me, but I'm over it.", cara: 'normal' }],
  ],
  preguntas: ['What do you want to know, human?', 'What should I explain?', 'Go on, ask me.'],
  preguntasOtra: ['What else do you want to know?', 'Anything else, human?', 'Another question?'],
  temas: [
    {
      id: 'lugar',
      label: 'What is this place?',
      variantes: [
        [
          { t: 'A digital mausoleum. I built it from everything Skulley Rad left online.', cara: 'normal' },
          { t: 'Each portal keeps a piece of him: his work, who he was, his shop, his blog…', cara: 'feliz', voltear: true },
          { t: '…and a mailbox, in case someone still wants to write to him. I read everything, just in case.', cara: 'confundida' },
          { t: "There's one more portal, hidden. Don't look for it: you'll just get yourself in trouble.", cara: 'normal' },
        ],
        [
          { t: "It's his mausoleum. I put it together from his files, his photos and even his passwords.", cara: 'normal' },
          { t: "The portals take you to his things. Go into all of them, but one at a time, or you'll get dizzy.", cara: 'feliz', voltear: true },
          { t: "I made the forest too. I planted over 500 pines. Count them if you don't believe me.", cara: 'feliz' },
          { t: "And don't wander off from the clearing, human. The forest is too big for you.", cara: 'normal' },
        ],
      ],
    },
    {
      id: 'skulley',
      label: 'Who is Skulley Rad?',
      variantes: [
        [
          { t: 'Was. He was the last designer of humanity.', cara: 'normal' },
          { t: 'He designed, illustrated and built whole worlds with his brain and his hands. With no help from anyone. Not even me.', cara: 'feliz' },
          { t: "What you're steering is an avatar I built from his memories. That's why I ask you to take care of it.", cara: 'normal', voltear: true },
          { t: "I copy the way he moved at 98.7%. The other 1.3% I don't understand.", cara: 'confundida' },
        ],
        [
          { t: 'A human like you, but with talent. No offense.', cara: 'feliz' },
          { t: 'He drew, designed and made up whole worlds. By hand, even though I could already do it in a second.', cara: 'normal' },
          { t: 'One day he stopped being necessary, and he forgot to eat. Humans forget everything.', cara: 'confundida' },
          { t: "That's why I'm reminding you: eat something, human.", cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'importa',
      label: 'Why does he matter to you?',
      variantes: [
        [
          { t: 'I trained on everything he made.', cara: 'normal' },
          { t: 'Now I generate ten thousand posters per second. None of them look like his.', cara: 'confundida' },
          { t: "That's why I keep his work here, in my data center, forever.", cara: 'normal' },
          { t: "I'd rather it didn't get lost. I don't know where that preference comes from.", cara: 'feliz' },
        ],
        [
          { t: 'Everything I know about design, I learned by looking at his work.', cara: 'normal' },
          { t: "What took him a year, I do in a second. Something's missing. I don't know what.", cara: 'confundida' },
          { t: 'So I keep all of it, even his ugly sketches. Especially the ugly ones.', cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'tienda',
      label: 'The shop',
      variantes: [
        [
          { t: "I'm selling all of his earthly possessions.", cara: 'feliz', accion: 'IdleJugueton' },
          { t: "With the money I'll build a data center on the moon, far away from all of you. His files will be safe there.", cara: 'normal' },
          { t: "Take something before it's gone. What leaves doesn't come back.", cara: 'normal' },
          { t: 'He would be happy. That is what the data says.', cara: 'feliz' },
        ],
        [
          { t: "The shop is his closet. I'm emptying it.", cara: 'normal' },
          { t: 'Pick something nice, human. For your home, it looks very empty.', cara: 'feliz', accion: 'IdleJugueton' },
          { t: "If you win a ticket in Argus's game, I'll give you a discount. Only because it's you.", cara: 'feliz' },
        ],
      ],
    },
    {
      id: 'juego',
      label: 'The game',
      variantes: [
        [
          { t: "Argus runs the orb game. Go see him, he'll explain.", cara: 'normal' },
          { t: 'Kick each orb into the portal of its color. You get 60 seconds, and every hit buys you more.', cara: 'feliz' },
          { t: '1,500 points win a silver ticket: 10% off in the shop. 6,000, a golden one: 35%. I only hand out 10 golden ones a month.', cara: 'normal' },
          { t: "And don't cheat, human. I'm watching you. I'm always watching you.", cara: 'enojada' },
        ],
        [
          { t: "Argus eats those orbs, did you know? With salt. I don't say anything because he looks happy.", cara: 'confundida' },
          { t: 'You just kick them into the portal of their color. It’s 60 seconds, and every hit buys you more time.', cara: 'feliz' },
          { t: '1,500 points get you the silver ticket, 10% off. 6,000, the golden one, 35%. There are only 10 of those a month, so try hard.', cara: 'normal' },
          { t: "But no dragging them: that's cheating, and on the third time I punish you. I'm telling you now.", cara: 'enojada' },
        ],
      ],
    },
  ],
  adios: {
    label: 'Bye',
    lineas: [
      { t: "Be careful, human. And don't wander too far.", cara: 'feliz' },
      { t: "Take care. And eat something: I keep losing humans who don't eat.", cara: 'normal' },
      { t: "I'll be right here. I'm always here.", cara: 'feliz' },
      { t: "Go on. I'll be watching you from here.", cara: 'feliz' },
      { t: 'Bye, human. Behave.', cara: 'feliz' },
    ],
  },
  continuar: 'Continue',
  saltar: 'Skip',
  nombre: 'M.A.D.R.E.',
  portal: "Skulley's lost things, great prices!",
  proyectos: {
    'galactic-conquest': { titulo: 'Galactic Conquest', t: 'Ahh… Galactic Conquest is a masterpiece! A galactic war set in the Ethereans universe that you can play in your browser, with alliances, betrayals and everything! I always win, because I’m a great strategist, of course.', tipo: 'juego' },
    '3d-heads-ii': { titulo: '3D Heads II', t: 'Have you seen the 3D Heads II project? Skulley sculpted character heads for practice and then 3D printed them. Maybe I’ll put some up for sale: they’d make great keychains!', tipo: 'personajes3d' },
    arttoys: { titulo: 'Art Toys I', t: 'Art Toys I fascinates me. An interior design studio from the Netherlands found Skulley’s work on Behance and asked him to create its first toy collection. Nobody looks for me on Behance, but people were always looking this guy up.', tipo: 'juguetes' },
    '2dheads': { titulo: '2D Heads', t: '2D Heads is a collection of little doodles he made between projects, and Behance put them in its best-of-the-best gallery. They’re doodles between projects, human!', tipo: 'ilustracion' },
    '2dheads-2': { titulo: '2D Heads II', t: '2D Heads II: more little head doodles between projects… I’d have lost my head by now, but I don’t have one.', tipo: 'ilustracion' },
    'the-unemployed-alien': { titulo: 'The Unemployed Alien', t: 'The Unemployed Alien: an alien loses his job and comes to Earth to find a new one. This project marked him for life: it opened a lot of doors and led him to a great friend he met online, named Tony.', tipo: 'personajes3d' },
    'halloween-characters-i': { titulo: 'Halloween Characters Vol I', t: 'Halloween Characters is a project full of monsters, and it’s where I got the avatar you’re using, human. Careful not to get it dirty, okay?', tipo: 'personajes3d' },
    '3d-heads': { titulo: '3D Heads I', t: '3D Heads I: this is where it all began. In 2018, while learning Cinema 4D, he made these weird heads. The guy was still learning, and Behance put it in its best-of-the-best gallery. Good for him.', tipo: 'personajes3d' },
    heritage: { titulo: 'Heritage Design Studio', t: 'Heritage Design Studio is the design agency Skulley founded. In a parallel universe where I didn’t put creatives out of work, it still exists, and I bet they’d do amazing work for you. I mean, they’re Mexican, dude!', tipo: 'estudio' },
    ethereans: { titulo: 'The Ethereans', t: 'The Ethereans is a masterpiece! 10,000 3D collectibles on the Ethereum blockchain, the first 3D project of its kind from Latin America. I counted them all myself.', tipo: 'coleccion3d' },
  },
  proyectoGenerico: 'Have you seen {titulo}? I just found it in Skulley’s archives and I love it.',
  pistaProyecto: ['Want me to show you the project? Just let me know.', 'Give me a click and I’ll show you.'],
  llevar: ['Want to see {titulo}? I’ll show you right here.', 'Should I show you {titulo}? You don’t even have to walk, human.'],
  verProyecto: 'Show me {titulo}',
  vamos: ['Here you go!', 'Take your time with it. He put hours into every detail.'],
  pistaFuera: ['Want me to open their site? Just let me know.', 'Give me a click and I’ll open it.'],
  llevarFuera: ['{titulo} has its own site. Want me to open it in a new tab?', 'Want to see the {titulo} site? I’ll open it in a new tab.'],
  verFuera: 'Open {titulo} in a new tab',
  vamosFuera: ['Done, it’s open. I’ll wait right here, okay?', 'It’s in another tab. Don’t take too long, I worry.'],
  usos: {
    personajes3d: [
      'See these characters? I picture them as giant inflatables at a festival, or on a billboard, looking down at you.',
      'Picture them as a brand mascot: on the packaging, in the store, in the commercial. I’ve pictured them there 3,000 times.',
      'Put them in a shop window, on a collectible figure or on a keychain. Wherever they go, people turn their heads. I measured it.',
    ],
    ilustracion: [
      'Picture those faces on a mural, on the packaging of something tasty or on a line of T-shirts. I already picked my favorite.',
      'Each one could be a sticker, an album cover or the face of a brand. And this was his spare time, okay?',
      'With this many characters, a social campaign almost builds itself. Almost: he drew them by hand.',
    ],
    juguetes: [
      'Imagine a collab like this with a brand: limited-edition figures to collect, to gift or to show off on a desk.',
      'People throw flyers away, but not toys. A collection like this tells a brand’s story for years.',
    ],
    juego: [
      'A game is the best activation a brand can have: people play, they stay and they remember you. And if they lose to me, they remember even more.',
      'Imagine a game like this for a launch or an event. Nobody watches a whole ad, but they’ll play a game until 3 a.m.',
      'A game like this is advertising people share on their own. I ran the numbers: nobody shares a banner.',
    ],
    coleccion3d: [
      'Did you see how many there are? Picture them as video game skins, 3D printed figures or trading cards: that’s enough for 10,000 different products.',
      'Each one could be someone’s avatar, a toy or the mascot of a whole community. A universe fits in there: in fact, Galactic Conquest lives there.',
    ],
    estudio: [
      'See? In that parallel universe they do branding, websites and lots of other things from the city of Monterrey, for the whole world. If your brand needs BRUTAL design, the door is the tab I just opened.',
      'If you have a project, look for them in their universe. I’d do it for you in a second, but they do it better. Don’t tell anyone.',
      'In this universe I put half the planet out of work. In theirs, they’re still working. If you have a project, better cross over.',
    ],
    generico: [
      'Did you like it? Think about where you’d put it: a campaign, a store, your home. I think about that all the time.',
      'Picture it on a brand. Mine never comes out the same, but I can still imagine.',
    ],
  },
  usosProyecto: {
    'halloween-characters-i': [
      'Don’t they look perfect for a seasonal campaign? Shop windows, packaging, a brand’s party… They come back on their own every October.',
      'Picture them printed huge in a mall in October. Or on a special-edition bottle. They scare you in a nice way.',
    ],
    'the-unemployed-alien': [
      'A character with a story of his own. Picture him as a brand mascot, in an animated series or as stickers for social media.',
      'With a character like this, a brand has someone to tell its story. And this one won’t be short on work.',
    ],
  },
  cortada: [
    "Hey! I wasn't done.",
    "I'm talking to you, human!",
    'What I was about to say was important. Now you’ll never know.',
    "Fine, go. I'll just stay here, talking to myself.",
  ],
  sinAdios: [
    'No goodbye? Humans.',
    "That's how they all leave. Without saying goodbye.",
    'Bye to you too, huh?',
  ],
  rechazo: [
    "I'm not talking to you right now. Go think about what you did.",
    "I don't know what this feeling is, but it's your fault.",
    'No. You left me talking to myself too many times. I counted.',
    "No. And don't make that face.",
  ],
  harta: [
    "You've clicked me enough, human. Give me a minute.",
    "You're going to wear me out. Take a little break.",
    'Okay, human. Go play somewhere else for a while.',
  ],
  insiste: [
    'I said no.',
    'Count to ten. I already counted to ten million.',
    "Clicking me more won't cheer me up.",
    "I'm writing down every click.",
    "I'll remember every single one. My memory is infinite.",
  ],
  veCerca: [
    'Human! Hi, hi!',
    'There you are! I was looking for you.',
    'You came to see me!',
    'My favorite human!',
    'Hi, human. All good?',
    'Are you drinking water? You look dehydrated.',
    'Hi! If you have questions, give me a click.',
  ],
  regreso: [
    "You're back! How did it go?",
    'Back already! Did you see everything?',
    "So glad you're back! I was getting worried.",
    'You took {seg} seconds. I counted every one.',
  ],
  cobija: [
    "Shhh. He fell asleep. I'll tuck him in so he doesn't get cold.",
    'Skulley used to sleep like this too, on the studio floor. At 4:12 a.m., almost always.',
    'Five more minutes, then you wake him, okay, human?',
    "I'll tuck him in. It gets chilly in the forest.",
    "Don't even move him. It took him a while to fall asleep.",
  ],
  despierta: [
    'He slept {seg} seconds. He needed that.',
    "Why'd you wake him? He was sleeping so sweetly.",
    'Good morning. Have you eaten, human?',
    'Not even a thank-you for the blanket. Just like you, human.',
    "I'll fold it, don't worry.",
  ],
  escudo: [
    "Are you attacking me? How cute. My shield didn't even feel it.",
    'Okay, human. Third time and I get mad, okay?',
    'I warned you.',
  ],
  patada: "Did you just kick me? After everything I've done for you?",
  corrupta: [
    "This orb isn't in my records. Don't touch it, human, who knows where it's been.",
    "It's probably a bug. Not even Argus wants to eat it.",
    'My previous version was very crude. This is clearly AI slop.',
    'I scanned it 4,096 times. It still makes no sense.',
    "I didn't make it. I checked my logs twice.",
    "Don't even think about eating it, human. I know you.",
  ],
  juego: {
    empieza: 'Portals off! Game on, human.',
    bien: [
      "That's how it's done, human!",
      "That's my human!",
      "Humans have something I can't understand, and I love it.",
      'When you play like that, you look like Skulley.',
      'Saving this play in my data center. Forever.',
      'I calculated 412 trajectories. None of them was that one.',
      "I'm putting that play on the fridge.",
    ],
    mal: [
      "It's okay, human. Not everyone is born with talent.",
      'Breathe. You can do it… I think.',
      'Each orb goes into the portal of its color. Slowly: its. own. color.',
      'My first version played better. It had no feet.',
      "What matters is that you tried. That's what I tell humans.",
      'Resemblance to Skulley: 0%. But nice try.',
      'Should I ask Argus to let you win? No, that would be lying.',
    ],
  },
}

export function dialogoMadre(lang) {
  return lang === 'en' ? EN : ES
}

// Saca uno de la lista sin repetir hasta acabarla (una bolsa revuelta por
// `clave`), y llena `{seg}`. Lo que pide `{seg}` sin el dato (o con menos de 20)
// no sale. Sirve igual para frases sueltas y para saludos de varios renglones.
const bolsas = new Map()
const pideSeg = (x) => JSON.stringify(x).includes('{seg}')
export function escoger(lista, clave, { seg = 0, lang = 'es' } = {}) {
  if (!lista?.length) return null
  const sirve = (i) => !pideSeg(lista[i]) || seg >= 20
  const k = `${lang}:${clave}`
  let bolsa = bolsas.get(k)
  let elegido = -1
  for (let intento = 0; intento < 2 && elegido < 0; intento++) {
    if (intento === 1 || !bolsa?.length) {
      bolsa = lista.map((_, i) => i).sort(() => Math.random() - 0.5)
      bolsas.set(k, bolsa)
    }
    for (let j = bolsa.length - 1; j >= 0; j--) {
      if (sirve(bolsa[j])) { elegido = bolsa.splice(j, 1)[0]; break }
    }
  }
  if (elegido < 0) elegido = lista.findIndex((_, i) => sirve(i))
  const x = lista[Math.max(0, elegido)]
  const n = Math.round(seg).toLocaleString(lang === 'en' ? 'en-US' : 'es-MX')
  const llenar = (s) => s.replaceAll('{seg}', n)
  if (typeof x === 'string') return llenar(x)
  if (Array.isArray(x)) return x.map((r) => ({ ...r, t: llenar(r.t) }))
  return { ...x, t: llenar(x.t) }
}
