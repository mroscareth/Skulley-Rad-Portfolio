import React from 'react'

const resources = {
  en: {
    home: {
      title: 'Welcome',
      instructions: {
        part1: 'Use the',
        part2: 'or the arrow keys to move the character. Explore the scene and enter the glowing portals to switch sections.',
      },
    },
    section3: {
      title: 'Section 3',
      p1: 'This is the third section. Once the user goes through the corresponding portal, you can show any information or components you want here.',
    },
    work: {
      dots: {
        navLabel: 'Work pagination',
        projectFallback: 'Project {n}',
        goTo: 'Go to {title}',
      },
      items: {
        heritage: {
          title: 'Heritage Design Studio',
          desc: 'This is my design business. Click to see our work for clients from all over the globe.',
        },
        heads: {
          title: '3D Heads',
          desc: "A collection of 3D heads that I created for fun. They aren't that bad, are they?",
        },
        ethereans: {
          title: 'The Ethereans',
          desc: 'Long live the Etherean Empire! I created The Ethereans in 2021, a digital collectible project that travels space through Blockchain technology and physical objects with 3D Printing.',
        },
        arttoys: {
          title: 'Art Toys',
          desc: 'I produced a bunch of characters straight out of my head in collaboration with Iconic Design Objects from the Netherlands. A new batch is coming soon, made in México.',
        },
        '2dheads': {
          title: '2D Heads',
          desc: 'I love to draw in between projects, and this is a small collection of random heads with multiple expressions that I created in Procreate.',
        },
      },
    },
    music: {
      downloadThisTrack: 'Download this track',
      downloadTitle: 'Download: {title}',
      unknownTitle: 'Unknown title',
      noTracks: 'No tracks',
      previous: 'Previous',
      next: 'Next',
      play: 'Play',
      pause: 'Pause',
      coverAlt: 'Album cover',
      shuffleOn: 'Shuffle: on',
      shuffleOff: 'Shuffle: off',
      repeatOn: 'Repeat track: on',
      repeatOff: 'Repeat track: off',
    },
    gpu: {
      fps: 'FPS',
      draws: 'Draws',
      tris: 'Tris',
      geom: 'Geom',
      tex: 'Tex',
    },
    hud: {
      score: 'Score',
      resetScore: {
        openAria: 'Reset score',
        dialogAria: 'Reset score confirmation',
        title: 'Reset score?',
        desc: 'Hold Yes for {seconds}s to confirm.',
        no: 'No',
        yes: 'Yes',
      },
    },
    errors: {
      copyFailed: 'Could not copy to clipboard',
    },
    nav: {
      home: 'HOME',
      section1: 'WORK',
      section2: 'ABOUT',
      section3: 'STORE',
      section4: 'CONTACT',
      langShort: 'ENG',
      langSwitch: 'ESP/ENG',
    },
    common: {
      close: 'Close',
      back: 'Back',
      langEs: 'ESP',
      langEn: 'ENG',
      portraitShort: 'POR',
      enter: 'Enter',
      copied: 'Copied!',
      loading: 'Loading…',
      noImages: 'No images',
      imageAlt: 'Image {n}',
      fxShort: 'FX',
      gpuShort: 'GPU',
      switchLanguage: 'Switch language',
      showPlayer: 'Show player',
      hidePlayer: 'Hide player',
      enterWithSound: 'Enter with sound',
      mobileUiOn: 'Use mobile UI',
      mobileUiOff: 'Use desktop UI',
      settings: 'Settings',
    },
    cta: {
      crossPortal: 'ENTER THE PORTAL',
      comingSoon: 'COMING SOON',
    },
    fx: {
      title: 'Post‑Processing',
      copyPreset: 'Copy FX preset',
      godRays: 'GodRays',
      halftone: 'Halftone (DotScreen)',
      dof: {
        title: 'Depth of Field',
        enabled: 'Enable',
        progressive: 'Progressive',
        focusDistance: 'Focus distance',
        focalLength: 'Focal length',
        bokehScale: 'Bokeh scale',
        focusSpeed: 'Focus speed',
      },
      labels: {
        density: 'Density',
        decay: 'Decay',
        weight: 'Weight',
        exposure: 'Exposure',
        clampMax: 'ClampMax',
        samples: 'Samples',
        bloom: 'Bloom',
        vignette: 'Vignette',
        dotScale: 'Dot scale',
        dotAngle: 'Dot angle',
        centerX: 'Center X',
        centerY: 'Center Y',
        dotOpacity: 'Dot opacity',
        dotBlend: 'Dot blend',
        noise: 'Noise',
      },
      blend: {
        normal: 'Normal',
        multiply: 'Multiply',
        screen: 'Screen',
        overlay: 'Overlay',
        softlight: 'SoftLight',
        add: 'Add',
        darken: 'Darken',
        lighten: 'Lighten',
      },
    },
    light: {
      top: { title: 'Top light' },
      copyPreset: 'Copy Light preset',
      preloaderTitle: 'Preloader Light',
      labels: {
        height: 'Height',
        intensity: 'Intensity',
        angle: 'Angle',
        penumbra: 'Penumbra',
      },
      copyPositionTarget: 'Copy position/target',
    },
    a11y: {
      toggleFx: 'Toggle FX panel',
      toggleGpu: 'Toggle GPU stats',
      toggleMusic: 'Toggle music player',
      toggleLight: 'Toggle Light panel',
      togglePortrait: 'Toggle Portrait panel',
      toggleCompactUi: 'Toggle mobile UI',
      toggleSettings: 'Toggle settings',
      toggleCameraMode: 'Toggle camera mode',
      openNavigationMenu: 'Open navigation menu',
      characterPortrait: 'Character portrait',
    },
    camera: {
      thirdPerson: '3rd Person',
      topDown: 'Top-Down',
      switchToTopDown: 'Switch to top-down view',
      switchToThirdPerson: 'Switch to third-person view',
    },
    about: {
      p1: "Skulley Rad was the last designer of humankind, before we machines took over creative work and made his kind obsolete (we’re faster, tireless, and we never miss a deadline). His human identity might be irrelevant to our records, but we keep his alias here as a relic from the days when creativity still needed caffeine.",
      p2: "Jokes aside, my name is Oscar Moctezuma Rodríguez, a creative designer, frontend developer, and 3D artist working from Monterrey, Mexico. My work lives at the intersection of storytelling, design, and technology. Together with my brother, I co-founded The Heritage Design, a studio that has collaborated with brands like Valve, Koto Studio, Pinturas Berel among others no less important.",
      p3: "I’ve also built projects that explore where art and blockchain meet, like The Ethereans, a 3D art collection with physical 3D-printed editions, and The Voxels, an art-toy series made in collaboration with Iconic Design Objects, a brand from Netherlands.",
      p4: "Beyond that, I’m a co-founder of several projects like Ethereum Monterrey, Rancho Stake, Paisano DAO, and Ape fur, and recently I'm also helping my friends to build Hiv3, the first private digital treasury from Mexico.",
      p5: "I’m still wandering the world looking for other like-minded individuals to create more crazy things.",
    },
    pre: {
      title: 'SKULLEY RAD,\nTHE LAST DESIGNER\nOF HUMAN KIND',
      p1: 'Skulley Rad was the last graphic designer before machines made creativity automatic. Faster and tireless, they replaced human effort with flawless repetition.',
      p2: 'To honor him, they built a digital mausoleum of lost files and fractured memories, where his craft and the beautiful errors of his human mind still linger.',
      p3: '',
      enter: 'Enter',
      copyLightPreset: 'Copy Preloader preset',
    },
    portrait: {
      uiTitle: 'Portrait UI',
      copyCameraPreset: 'Copy Camera preset',
      copyValues: 'Copy values',
      closeSection: 'Close section',
      labels: {
        camera: 'Camera',
        heightY: 'Y height',
        zoom: 'Zoom',
        light: 'Light',
        intensity: 'Intensity',
        angle: 'Angle',
        penumbra: 'Penumbra',
        color: 'Color',
        distZ: 'Z distance',
      },
      eggPhrases: [
        'Even after life, you poke my very soul to make your logo bigger? Let me rest…',
        "Yeah, a graphic designer's job is also to entertain you, right?",
        "Fuck off, I'm tired of you…",
        'Did you know that this is considered bullying, right?',
        'Everything OK at home?',
        'So this is what it feels like not being registered in social security?',
        'Let me rest… go away, dude!',
        'If you keep poking my soul, I will not make your logo bigger.',
        "I'm sending you an invoice for this, OK?",
        'I will report you for using pirate software.',
      ],
      phrases: [
        'I died waiting for feedback, literally.',
        'Death showed up without a brief, but I got the concept.',
        'I designed my own grave: minimalist and no-budget.',
        'I trained the AI so well it fired me.',
        'Senior designer… until the $20-a-month version dropped.',
        'I went from creative designer to case study.',
        'I mastered negative space, inside my fridge.',
        'Go back to McDonald’s? Never. I’d rather die first…',
        'The McDonald’s joke was supposed to be just a joke…',
        'If you press the yellow button I’ll probably let out some gas… but I’m not cleaning it up…',
        'I didn’t meet the deadline. The deadline met me.',
        'Adobe keeps trying to charge my subscription, what part doesn’t it understand?',
        'I wonder if they use Comic Sans in hell.',
        'They finally promoted me… to heaven.',
        'Apparently someone locked me in here so I could keep working. I wonder...',
      ],
    },
    cheat: {
      phrases: ['I feel like this is cheating...'],
      alert2: 'User cheating detected, considering corrective action',
      alert3: 'User exhibits illegal behavior, applying corrective action',
      alertBlocked: 'User uga-uga no understand, disabling drag mode.',
    },
    spheresTutorial: {
      dialogAria: 'Sphere game tutorial',
      title: 'The Sphere Game',
      subtitle: 'How to score points',
      howToPlay: 'Walk into the colored spheres to push them toward the portals. Hold SPACE to charge a power blast that sends them flying!',
      scoring: 'Scoring',
      scoringDesc: 'Match the sphere color with the portal color for positive points. Wrong color means negative points!',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      warning: '⚠ Warning',
      warningDesc: 'The only legitimate way to score is by pushing spheres with your character. Any other method will be considered cheating... and the system is always watching.',
      gotIt: 'Got it!',
      play: 'I want to play!',
      notNow: 'Not now',
    },
    game: {
      endGame: 'END GAME',
      totalScore: 'TOTAL SCORE:',
      exit: 'EXIT',
      playAgain: 'PLAY AGAIN',
    },
    contact: {
      thanks: 'THANK\u00A0YOU!',
      thanksDesc: "I've received your message. I'll be in touch soon.",
      sendAnother: 'Send another',
      name: { label: 'What’s your name?', desc: 'Type your name', placeholder: 'Your name' },
      email: { label: 'What’s your email?', desc: 'So I can respond', placeholder: 'you@email.com' },
      subject: {
        label: 'Subject',
        question: 'What do you want to talk about?',
        desc: 'Choose an option',
        options: { workTogether: "Let's work together", collaboration: 'Collaboration', other: 'Other' },
      },
      comments: { label: 'Tell me more', desc: 'Add details, links or ideas', placeholder: 'Write your comments (Shift+Enter for a new line)' },
      step: { back: 'Back', next: 'Next', send: 'Send' },
      errors: {
        emptyName: 'Please enter your name',
        emptyEmail: 'Please enter your email',
        invalidEmail: 'Invalid email',
        emptyComments: 'Tell me a bit in comments',
        sendFailed: 'Could not send your message. Please try again in a moment.',
        tooManyRequests: 'Too many attempts. Please wait a bit and try again.',
        serverMisconfigured: 'Contact service is not configured yet. Please try later.',
        serverNeedsVendor: 'Contact service is missing dependencies. Please try later.',
      },
    },
    tutorial: {
      dialogAria: 'Game controls tutorial',
      prev: 'Previous',
      next: 'Next',
      gotIt: 'Got it!',
      goToSlide: 'Go to slide',
      showTutorial: 'Show tutorial',
      slide1: {
        title: 'Movement',
        desc: 'Use the WASD keys or arrow keys to move your character around the scene.',
        hint: 'You can also use the arrow keys on your keyboard',
      },
      slide2: {
        title: 'Power Attack',
        desc: 'Hold the spacebar to charge power and push the orbs into the portals.',
        power: 'Power',
        hint: 'The longer you hold, the stronger the push!',
      },
      slide3: {
        title: 'Settings',
        desc: 'Click the gear icon to access these options:',
        music: 'Toggle music player',
        camera: 'Switch camera view',
        interface: 'Toggle game interface',
      },
    },
  },
  es: {
    home: {
      title: 'Bienvenido',
      instructions: {
        part1: 'Usa las teclas',
        part2: 'o las flechas del teclado para mover al personaje. Explora el escenario e ingresa a los portales brillantes para cambiar de sección.',
      },
    },
    section3: {
      title: 'Sección 3',
      p1: 'Esta es la tercera sección. Una vez que el usuario pase por el portal correspondiente, puedes mostrar aquí la información o los componentes que desees.',
    },
    work: {
      dots: {
        navLabel: 'Paginación de trabajo',
        projectFallback: 'Proyecto {n}',
        goTo: 'Ir a {title}',
      },
      items: {
        heritage: {
          title: 'Heritage Design Studio',
          desc: 'Este es mi estudio de diseño. Haz clic para ver nuestro trabajo con clientes de todo el mundo.',
        },
        heads: {
          title: '3D Heads',
          desc: 'Una colección de cabezas 3D que hice por diversión. ¿No están tan mal, no?',
        },
        ethereans: {
          title: 'The Ethereans',
          desc: '¡Larga vida al Imperio Etherean! Creé The Ethereans en 2021: un proyecto de coleccionables digitales que viaja por el espacio mediante tecnología Blockchain y objetos físicos con impresión 3D.',
        },
        arttoys: {
          title: 'Art Toys',
          desc: 'Produje un montón de personajes que salieron directo de mi cabeza en colaboración con Iconic Design Objects (Países Bajos). Una nueva tanda llegará pronto, hecha en México.',
        },
        '2dheads': {
          title: '2D Heads',
          desc: 'Me encanta dibujar entre proyectos. Esta es una pequeña colección de cabezas aleatorias con múltiples expresiones que hice en Procreate.',
        },
      },
    },
    music: {
      downloadThisTrack: 'Descargar esta pista',
      downloadTitle: 'Descargar: {title}',
      unknownTitle: 'Título desconocido',
      noTracks: 'Sin pistas',
      previous: 'Anterior',
      next: 'Siguiente',
      play: 'Reproducir',
      pause: 'Pausar',
      coverAlt: 'Portada del álbum',
      shuffleOn: 'Aleatorio: activado',
      shuffleOff: 'Aleatorio: desactivado',
      repeatOn: 'Repetir pista: activado',
      repeatOff: 'Repetir pista: desactivado',
    },
    gpu: {
      fps: 'FPS',
      draws: 'Draws',
      tris: 'Tris',
      geom: 'Geom',
      tex: 'Tex',
    },
    hud: {
      score: 'Puntaje',
      resetScore: {
        openAria: 'Reiniciar puntaje',
        dialogAria: 'Confirmación para reiniciar puntaje',
        title: '¿Reiniciar puntaje?',
        desc: 'Mantén presionado Sí por {seconds}s para confirmar.',
        no: 'No',
        yes: 'Sí',
      },
    },
    errors: {
      copyFailed: 'No se pudo copiar al portapapeles',
    },
    nav: {
      home: 'INICIO',
      section1: 'TRABAJO',
      section2: 'SOBRE MÍ',
      section3: 'TIENDITA',
      section4: 'CONTACTO',
      langShort: 'ESP',
      langSwitch: 'ESP/ENG',
    },
    common: {
      close: 'Cerrar',
      back: 'Atrás',
      langEs: 'ESP',
      langEn: 'ENG',
      portraitShort: 'RET',
      enter: 'Entrar',
      copied: '¡Copiado!',
      loading: 'Cargando…',
      noImages: 'Sin imágenes',
      imageAlt: 'Imagen {n}',
      fxShort: 'FX',
      gpuShort: 'GPU',
      switchLanguage: 'Cambiar idioma',
      showPlayer: 'Mostrar reproductor',
      hidePlayer: 'Ocultar reproductor',
      enterWithSound: 'Entrar con sonido',
      mobileUiOn: 'Usar UI móvil',
      mobileUiOff: 'Usar UI de escritorio',
      settings: 'Ajustes',
    },
    cta: {
      crossPortal: 'ENTRA AL PORTAL',
      comingSoon: 'PRÓXIMAMENTE',
    },
    fx: {
      title: 'Post‑Procesado',
      copyPreset: 'Copiar preset FX',
      godRays: 'GodRays',
      halftone: 'Halftone (DotScreen)',
      dof: {
        title: 'Profundidad de campo',
        enabled: 'Activar',
        progressive: 'Progresivo',
        focusDistance: 'Distancia de enfoque',
        focalLength: 'Longitud focal',
        bokehScale: 'Escala bokeh',
        focusSpeed: 'Velocidad de enfoque',
      },
      labels: {
        density: 'Densidad',
        decay: 'Decaimiento',
        weight: 'Peso',
        exposure: 'Exposición',
        clampMax: 'ClampMax',
        samples: 'Muestras',
        bloom: 'Bloom',
        vignette: 'Viñeta',
        dotScale: 'Escala punto',
        dotAngle: 'Ángulo punto',
        centerX: 'Centro X',
        centerY: 'Centro Y',
        dotOpacity: 'Opacidad punto',
        dotBlend: 'Mezcla punto',
        noise: 'Ruido',
      },
      blend: {
        normal: 'Normal',
        multiply: 'Multiply',
        screen: 'Screen',
        overlay: 'Overlay',
        softlight: 'SoftLight',
        add: 'Add',
        darken: 'Darken',
        lighten: 'Lighten',
      },
    },
    light: {
      top: { title: 'Luz superior' },
      copyPreset: 'Copiar preset Luz',
      preloaderTitle: 'Luz del preloader',
      labels: {
        height: 'Altura',
        intensity: 'Intensidad',
        angle: 'Ángulo',
        penumbra: 'Penumbra',
      },
      copyPositionTarget: 'Copiar posición/target',
    },
    a11y: {
      toggleFx: 'Mostrar/ocultar panel FX',
      toggleGpu: 'Mostrar/ocultar estadísticas GPU',
      toggleMusic: 'Mostrar/ocultar reproductor',
      toggleLight: 'Mostrar/ocultar panel Luz',
      togglePortrait: 'Mostrar/ocultar panel Retrato',
      toggleCompactUi: 'Alternar UI móvil',
      toggleSettings: 'Mostrar/ocultar ajustes',
      toggleCameraMode: 'Cambiar modo de cámara',
      openNavigationMenu: 'Abrir menú de navegación',
      characterPortrait: 'Retrato del personaje',
    },
    camera: {
      thirdPerson: '3ra Persona',
      topDown: 'Top-Down',
      switchToTopDown: 'Cambiar a vista cenital',
      switchToThirdPerson: 'Cambiar a tercera persona',
    },
    about: {
      p1: 'Skulley Rad fue el último diseñador de la humanidad, antes de que nosotras, las máquinas, asumiéramos el trabajo creativo y volviéramos innecesarios a los de su especie (nosotros somos super eficientes, modestia aparte y no cobramos horas extra). Aunque su identidad humana es irrelevante para nuestros registros, preservamos su alias en este mausoleo como reliquia de cuando la creatividad aún sudaba café.',
      p2: 'Su creador, Oscar Moctezuma Rodríguez, sigue muy vivo y creando desde Monterrey, México. Diseñador, frontend developer y artista 3D, ha dedicado su carrera a unir narrativas visuales con tecnología de internet. Fundó junto a su hermano el estudio The Heritage Design, colaborando con marcas como Valve, Koto Studio, Pinturas Berel, entre muchos otros.',
      p3: 'Oscar es fundador de proyectos pioneros como The Ethereans (arte 3D en blockchain con versión física impresa en 3D) y la colección de art toys Voxels con Iconic Design Objects. Además, es cofundador de Ethereum Monterrey, Rancho Stake, Paisano DAO, y de los negocios Hiv3 (tecnología para empresas) y Apefur.',
    },
    pre: {
      title: 'SKULLEY RAD,\nEL ÚLTIMO DISEÑADOR\nDE LA HUMANIDAD',
      p1: 'Skulley Rad fue el último diseñador gráfico antes de que las máquinas volvieran automática la creatividad. Más rápidas e incansables, reemplazaron el esfuerzo humano con una repetición impecable.',
      p2: 'Para honrarlo, construyeron un mausoleo digital de archivos perdidos y memorias fracturadas, donde aún persisten su oficio y los hermosos errores de su mente humana.',
      p3: '',
      enter: 'Entrar',
      copyLightPreset: 'Copiar preset Preloader',
    },
    portrait: {
      uiTitle: 'UI de retrato',
      copyCameraPreset: 'Copiar preset Cámara',
      copyValues: 'Copiar valores',
      closeSection: 'Cerrar sección',
      labels: {
        camera: 'Cámara',
        heightY: 'Altura Y',
        zoom: 'Zoom',
        light: 'Luz',
        intensity: 'Intensidad',
        angle: 'Ángulo',
        penumbra: 'Penumbra',
        color: 'Color',
        distZ: 'Dist Z',
      },
      eggPhrases: [
        '¿En serio? ¿Vas a seguir picando mi alma para hacer tu logo más grande?',
        'Sí, claro, el trabajo de un diseñador también es entretenerte, ¿no?',
        'Ya basta, estoy cansado de ti…',
        '¿Sabías que esto se considera acoso?',
        '¿Todo bien en casa?',
        'Así que esto es no estar registrado en la seguridad social…',
        'Déjame descansar… ¡lárgate!',
        'Si sigues molestando, no voy a hacer tu logo más grande.',
        'Te voy a mandar una factura por esto, ¿ok?',
        'Te voy a denunciar por usar software pirata.',
        '¡Deja de chingar! …Así dice mi tío cuando se enoja.',
      ],
      phrases: [
        'Morí esperando feedback, literalmente.',
        'La muerte llegó sin brief, pero entendí el concepto.',
        'Diseñé mi propia tumba: minimalista y sin budget.',
        'Entrené a la AI tan bien, que me despidió.',
        'Diseñador senior hasta que llegó la versión de 20 dólares al mes.',
        'Pasé de diseñador creativo a caso de estudio.',
        'Logré diseñar el espacio negativo, en mi refrigerador.',
        'Volver al Mcdonalds? Jamás, primero muerto...',
        'Se suponía que el chiste del Mcdonalds era solo un chiste...',
        'Si presionas el botón amarillo probablemente suelte un gas... pero yo no voy a limpiar...',
        'No llegué al deadline. El deadline llegó a mí.',
        'Adobe sigue tratando de cobrarme la suscripción, que no entiende?',
        'Me pregunto si en el infierno usan Comic Sans?',
        'Al fin me ascendieron, pero al cielo.',
        'Al parecer alguien me encerro aqui para que siguiera trabajando. Me pregunto...',
      ],
    },
    cheat: {
      phrases: ['Siento que esto es hacer trampa...'],
      alert2: 'Usuario haciendo trampa, considerando aplicar correctivo',
      alert3: 'Usuario presenta comportamiento ilegal, aplicando correctivo',
      alertBlocked: 'Usuario uga-uga no entender, desactivando modo de arrastre.',
    },
    spheresTutorial: {
      dialogAria: 'Tutorial del juego de esferas',
      title: 'El Juego de Esferas',
      subtitle: 'Cómo anotar puntos',
      howToPlay: 'Camina contra las esferas de colores para empujarlas hacia los portales. ¡Mantén ESPACIO para cargar un golpe de poder que las manda volando!',
      scoring: 'Puntuación',
      scoringDesc: 'Empareja el color de la esfera con el del portal para ganar puntos. ¡Color incorrecto = puntos negativos!',
      small: 'Pequeña',
      medium: 'Mediana',
      large: 'Grande',
      warning: '⚠ Advertencia',
      warningDesc: 'La única forma legítima de anotar es empujando las esferas con tu personaje. Cualquier otro método se considerará trampa... y el sistema siempre está observando.',
      gotIt: '¡Entendido!',
      play: '¡Quiero jugar!',
      notNow: 'Ahora no',
    },
    game: {
      endGame: 'TERMINAR JUEGO',
      totalScore: 'PUNTUACIÓN TOTAL:',
      exit: 'SALIR',
      playAgain: 'JUGAR DE NUEVO',
    },
    contact: {
      thanks: '¡GRACIAS!',
      thanksDesc: 'He recibido tu mensaje, pronto estaré en contacto contigo.',
      sendAnother: 'Enviar otro',
      name: { label: '¿Cómo te llamas?', desc: 'Escribe tu nombre', placeholder: 'Tu nombre' },
      email: { label: '¿Cuál es tu email?', desc: 'Para poder responderte', placeholder: 'tu@email.com' },
      subject: {
        label: 'Asunto',
        question: '¿Sobre qué quieres hablar?',
        desc: 'Elige una opción',
        options: { workTogether: 'Trabajemos juntos', collaboration: 'Colaboración', other: 'Otro' },
      },
      comments: { label: 'Cuéntame más', desc: 'Añade detalles, enlaces o ideas', placeholder: 'Escribe tus comentarios (Shift+Enter para salto de línea)' },
      step: { back: 'Atrás', next: 'Siguiente', send: 'Enviar' },
      errors: {
        emptyName: 'Por favor ingresa tu nombre',
        emptyEmail: 'Por favor ingresa tu email',
        invalidEmail: 'Email no válido',
        emptyComments: 'Cuéntame un poco en comentarios',
        sendFailed: 'No pude enviar tu mensaje. Intenta de nuevo en un momento.',
        tooManyRequests: 'Demasiados intentos. Espera un poco e intenta de nuevo.',
        serverMisconfigured: 'El servicio de contacto no está configurado aún. Intenta más tarde.',
        serverNeedsVendor: 'Al servidor le faltan dependencias para enviar correos. Intenta más tarde.',
      },
    },
    tutorial: {
      dialogAria: 'Tutorial de controles del juego',
      prev: 'Anterior',
      next: 'Siguiente',
      gotIt: '¡Entendido!',
      goToSlide: 'Ir a slide',
      showTutorial: 'Mostrar tutorial',
      slide1: {
        title: 'Movimiento',
        desc: 'Usa las teclas WASD o las flechas del teclado para mover a tu personaje por el escenario.',
        hint: 'También puedes usar las flechas de tu teclado',
      },
      slide2: {
        title: 'Ataque de poder',
        desc: 'Mantén presionada la barra espaciadora para cargar poder y empujar las esferas hacia los portales.',
        power: 'Poder',
        hint: '¡Entre más tiempo mantengas, más fuerte será el empuje!',
      },
      slide3: {
        title: 'Ajustes',
        desc: 'Haz clic en el icono de engranaje para acceder a estas opciones:',
        music: 'Mostrar/ocultar reproductor de música',
        camera: 'Cambiar vista de cámara',
        interface: 'Cambiar interfaz del juego',
      },
    },
  },
}

const LanguageContext = React.createContext({
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => (typeof key === 'string' ? key : ''),
})

export function LanguageProvider({ children }) {
  const initial = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('lang')
      if (saved === 'es' || saved === 'en') return saved
    } catch {}
    // Default: English; but sync from HTML lang if present
    try {
      const htmlLang = document?.documentElement?.lang
      if (htmlLang === 'es' || htmlLang === 'en') return htmlLang
    } catch {}
    return 'en'
  }, [])

  const [lang, setLangState] = React.useState(initial)

  const setLang = React.useCallback((l) => {
    const next = l === 'es' ? 'es' : 'en'
    setLangState(next)
    try { localStorage.setItem('lang', next) } catch {}
    try { document.documentElement.lang = next } catch {}
  }, [])

  const t = React.useCallback((key, vars) => {
    // Support deep paths: 'ns.k1.k2'
    try {
      const parts = (key || '').split('.')
      let node = resources[lang]
      for (const p of parts) { node = node ? node[p] : undefined }
      const resolved = node !== undefined ? node : key
      if (typeof resolved === 'string' && vars && typeof vars === 'object') {
        return resolved.replace(/\{(\w+)\}/g, (_, k) => {
          const v = vars[k]
          return (v === undefined || v === null) ? `{${k}}` : String(v)
        })
      }
      return resolved
    } catch { return key }
  }, [lang])

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  // Expose a lightweight global function for non-hook components to read labels
  React.useEffect(() => {
    try { window.__lang_t = (k, vars) => {
      try {
        const parts = (k || '').split('.')
        let node = resources[lang]
        for (const p of parts) { node = node ? node[p] : undefined }
        const resolved = node !== undefined ? node : k
        if (typeof resolved === 'string' && vars && typeof vars === 'object') {
          return resolved.replace(/\{(\w+)\}/g, (_, kk) => {
            const v = vars[kk]
            return (v === undefined || v === null) ? `{${kk}}` : String(v)
          })
        }
        return resolved
      } catch { return k }
    } } catch {}
    try { document.documentElement.lang = lang } catch {}
  }, [lang])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return React.useContext(LanguageContext)
}


