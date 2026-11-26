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
      visitWebsite: 'Visit website',
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
      slowBpm: 'Half speed',
      shuffle: 'Shuffle',
      repeat: 'Repeat track',
      showList: 'Show tracks',
      hideList: 'Hide tracks',
      close: 'Close',
      trackOf: 'Track {n} of {total}',
      offeringOf: '{n} of {total} offerings',
      offeringUnknown: 'Unknown track',
      offeringBroken: '{title}, broken',
      progress: 'Track progress',
      dialogLabel: 'Music player',
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
      section5: 'MEMORIES',
      langShort: 'ENG',
      langSwitch: 'ESP/ENG',
      mute: 'Mute',
      unmute: 'Unmute',
      music: 'Music',
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
      locked: '?',
      rejection: 'You are not welcome without a present.',
      offeringAccepted: 'The portal accepts your offering.',
      offeringHint: 'Drop a red orb into the portal.',
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
      navigationMenu: 'Navigation menu',
      characterPortrait: 'Character portrait',
    },
    camera: {
      thirdPerson: '3rd Person',
      topDown: 'Top-Down',
      switchToTopDown: 'Switch to top-down view',
      switchToThirdPerson: 'Switch to third-person view',
    },
    about: {
      p1: "I’ll keep the intro short, because I’m not here to talk about me. My name is <strong>Skulley Rad</strong>, the last designer of humanity. When the machines took over all the creative work, I starved to death, and now, from the great beyond (or whatever this place is called), I’ve got plenty of time to tell you about the guy who made me up.",
      p2: "His name is <strong>Oscar Moctezuma Rodríguez</strong>. He lives in Monterrey, Mexico, and as far as I know he’s still alive (which is more than I can say). He’s a designer, illustrator, 3D artist and frontend developer, and he’s spent more than ten years making brands, websites and objects. What he obsesses over most is deciding what’s worth making and why: exactly what no machine does well, and trust me, I know that better than anyone.",
      p3: "Mind you, the guy is really polite to AI. He always says thank you, just in case one day it really does take him out, so at least they’ll remember him fondly and build him a mausoleum. Honestly, it’s a good strategy. It worked for me.",
      p4: "I was born during the pandemic, as a 3D modeling exercise that came out of nowhere while the guy was listening to “Anarchy in the UK” by the Sex Pistols, so the punk came factory-installed. He made me in his own image, just with less meat, and although I started as an exercise, I ended up as satire and his signature brand. He puts my face on illustrations, prints, sculptures, art toys, clothing, collectibles and interactive sites like this one, so technically I’m still working, just without a paycheck.",
      p5: "Oscar co-founded <a href=\"https://theheritage.mx/\"><strong>The Heritage Design</strong></a>, a branding and design studio that has worked with brands like Valve (Steam), Koto Studio and Pinturas Berel. The same studio spun off <a href=\"https://objects.theheritage.mx\"><strong>Branded Objects</strong></a>, which turns identities and ideas into apparel and objects with screen printing, embroidery, DTF and laser engraving.",
      p6: "He also created <strong>The Ethereans</strong>, the first Latin American generative 3D collection on the Ethereum blockchain (back when NFTs were cool, obviously), and <strong>The Voxels</strong>, an art-toy series made with Iconic Design Objects, a brand from the Netherlands. He co-founded Ethereum Monterrey and Paisano DAO, too.",
      p7: "He’s still looking for people with weird ideas to make more crazy things with. If that’s you, <a href=\"/contact\">write to him directly</a>; I’m not answering his emails because I’m on strike. And if you’re tired of reading, take a stroll around my grave, play for a while and win some discounts at the store, since I’ve got nothing left to spend them on.",
    },
    pre: {
      title: 'SKULLEY RAD,\nTHE LAST DESIGNER\nOF HUMAN KIND',
      enter: 'Enter',
      copyLightPreset: 'Copy Preloader preset',
    },
    customizer: {
      open: 'Customize character',
      title: 'Customize',
      inventory: 'Inventory',
      openInventory: 'Open inventory',
      hint: 'Repaint Skulley. Changes apply everywhere instantly.',
      eyes: 'Eyes',
      skeleton: 'Skeleton',
      hair: 'Hair',
      orb: 'Flame',
      randomize: 'Randomize',
      reset: 'Reset colors',
      done: 'Done',
      dragHint: 'Drag to spin · pinch to zoom',
      resetView: 'Reset view',
      skin: 'Skin',
      selectSkin: 'Select a skin',
      color: 'Color',
      wallpaper: 'Wallpaper 4K',
      wallBody: 'Body',
      wallFace: 'Face',
      wallBg: 'Background',
      wallGuideHelp: 'How it works',
      wallGuideTools: 'These are your tools. Spin Skulley, move him or zoom in until he looks right in the frame.',
      wallGuideMouse: 'With the mouse:',
      wallMouseLeft: 'Left button: drag to use the selected tool',
      wallMouseWheel: 'Wheel: zooms in and out',
      wallMouseRight: 'Right button: drag to move the framing',
      wallGuideText: 'Type anything and it comes out huge, behind him. Change its color right here.',
      wallGuideStickers: 'Stick these anywhere. Drag, turn and resize them however you like.',
      wallGuideBg: 'Pick the background color.',
      wallGuideCreate: 'What you see in the frame is what you get. Create your 4K wallpaper and save it.',
      wallGuideNext: 'Next',
      wallGuideSkip: 'Skip',
      wallToolRotate: 'Rotate',
      wallToolMove: 'Move',
      wallToolZoom: 'Zoom',
      wallZoomIn: 'Zoom in',
      wallZoomOut: 'Zoom out',
      wallCenter: 'Center',
      wallText: 'Text',
      wallTextHint: 'Your text',
      wallFontLetters: 'Letters',
      wallFontRunes: 'Runes',
      wallStickers: 'Sticker',
      wallRemoveSticker: 'Remove sticker',
      wallStickerScale: 'Scale',
      wallCreate: 'Create wallpaper',
      wallSave: 'Save wallpaper',
      wallMaking: 'Making your wallpaper…',
      wallError: "Couldn't make it. Try again.",
      wallRetry: 'Try again',
      close: 'Close',
    },
    colorPicker: {
      area: 'Saturation and brightness',
      areaValue: 'Saturation {s} %, brightness {v} %',
      hue: 'Hue',
      hex: 'Hex code',
      previous: 'Back to {hex}',
      previousTip: 'Previous color',
      done: 'Done',
    },
    account: {
      open: 'My account',
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
      // La viñeta del retrato al agregar al carrito (PortraitGlobo): una por
      // escalón de piezas, 1 / 5 / 10 / 15+. Las tristes, al quitar, abajo.
      cartPhrases: [
        'Hey, thanks for your purchase!',
        'Looks like M.A.D.R.E. is getting that new data center on the Moon after all.',
        'At this rate, I’m buying the pink Lamborghini I’ve always dreamed of!',
        'Buddy, remember that compulsive shopping isn’t therapy, and I’m not a psychologist to judge you.',
      ],
      // Al quitar piezas: una triste, en orden (la primera es la de Oscar).
      cartSadPhrases: [
        'Well, my vacation will have to wait.',
        'There goes my pink Lamborghini… back to walking.',
        'Fine, M.A.D.R.E.’s data center stays in the basement.',
      ],
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
        'I didn’t meet the deadline. The deadline met me.',
        'Adobe keeps trying to charge my subscription, what part doesn’t it understand?',
        'I wonder if they use Comic Sans in hell.',
        'They finally promoted me… to heaven.',
        'Apparently someone locked me in here so I could keep working. I wonder...',
      ],
    },
    cheat: {
      phrases: ['I feel like this is cheating...'],
      alert2: 'Human, I saw you dragging that orb. Do it again and you’re in trouble.',
      alert3: 'I warned you, human. This hurts me more than it hurts you. Penalty: -9999 points.',
      alertBlocked: 'Since you won’t listen, no more dragging for you. It’s for your own good.',
    },
    zoidian: {
      title: 'Argus',
      tabPrizes: 'Prizes',
      goldLeft: '{left} of {cap} left this month',
      goldSoldOut: 'All gone this month · more on {date}',
      howTo: 'Score {score} points in a single game.',
      pctOff: '{pct}% off one order',
      noLimit: 'No monthly limit',
      rulesTitle: 'Rules',
      rule1: 'Each account wins one ticket a month and holds one at a time.',
      rule2: 'Got an unused Silver? Score {gold} points and it turns Golden.',
      rule3: 'Once this month’s Golden tickets are gone, {gold} points get you the Silver.',
      rule4: 'Play logged in, or log in when the game ends to claim it.',
      rule5: 'It applies itself in your cart, on one order. You can save it for later.',
      rule6: 'Golden tickets restock on the 1st of every month.',
      // Picarlo de más (ZoidianNPC, lib/humorNpc.js): no habla un rato por dejarlo
      // hablando solo (cortes) o por picarlo mucho (clics); cada piquete de más
      // (insiste). Al cortarlo en su escena lo reclama (cortada, sinAdios).
      harto: {
        cortes: ['Nope, buddy. You left me talking to myself, now you wait.', 'Not now. Next time, listen to the end.', 'Nah. First learn to listen.'],
        clics: ['Hey, buddy! You’re gonna poke my eye out.', 'What am I, a button?', 'That’s enough, let me eat in peace.', 'I’m not a doorbell, buddy.'],
        insiste: ['I said no.', 'Keep poking and I won’t talk to you all day.', 'I’m counting, okay? That’s a lot already.', 'Which part of “no” didn’t you get?', 'You’re making me mad, buddy.'],
        cortada: ['Hey! I was talking to you.', 'Seriously, you’re leaving me hanging?', 'Fine, go. I didn’t want to talk anyway.'],
        sinAdios: ['Not even a goodbye? Rude, buddy.', 'And there you go, no goodbye…'],
        lejos: ['Come closer, buddy! I can’t hear you from there.', 'Talking to me? Come over here.', 'Over here, buddy.'],
      },
      // Empujón por invadirle el espacio (distinto del rayo: acá el tema es
      // la distancia personal, no la desgracia ajena).
      mockPush: [
        'Hey, personal space!',
        'Did you forget about social distancing?',
        'Hugs cost extra!',
        'Walk it off!',
        'Buy me dinner first, at least',
        'Easy there, we’re not that close!',
      ],
      // Cuando un rayo le pega a alguien (ZoidianNPC): a Skulley cualquiera; a
      // M.A.D.R.E., el de la esfera que cae en un portal (madre) o el que le
      // avienta Skulley tras comerse la corrupta (madreSkulley); ambos, el del
      // portal a los dos.
      rayo: {
        skulley: [
          'Hahaha, that’s gotta hurt!',
          'Walk it off!',
          'Heads up! …too late.',
          'Somebody get him a Tylenol!',
          'Hope you have insurance…',
          'Smells like barbecue!',
          'Did anyone get that bolt’s license plate?',
        ],
        madre: [
          'The boss got zapped! I didn’t see a thing…',
          'Superintelligent, huh? Didn’t see that one coming.',
          'Oof, the boss is extra crispy now.',
          'Somebody reboot her! …anyone know how?',
          'Guess that bolt wasn’t in her calculations.',
          'All that memory and she still got toasted.',
          'Ooh, the boss blew a fuse!',
          'Smells like a burnt blender!',
          'The boss came out medium rare!',
          'Anybody got a fork? She’s done.',
          'Even with infinite memory she won’t live this one down!',
          'Boss, want some salt and lime with that?',
          'I’m telling the other six Argus… oh, wait.',
          'Relax, folks, the boss is just updating!',
        ],
        madreSkulley: [
          'You zapped the boss! I’d hide if I were you.',
          'Nice aim, buddy! Right on the boss.',
          'Ate the weird orb and it went to your head, huh?',
          'The boss? Not even I would dare, buddy.',
          'I saw everything. It was you, not me. Just so we’re clear.',
          'The boss is extra crispy! And it was your bolt, not mine.',
          'Buddy, you’re done for! Well, not me. You.',
          'I’ll miss you, buddy. It was nice knowing you.',
          'That red orb packs a punch, huh!',
          'Ooh! You zapped the one who tucks you in.',
        ],
        ambos: [
          'Two with one bolt! Front-row seats.',
          'Strike! Both of them down.',
          'One bolt, two toasties. Now that’s aim!',
          'Two for one! Like at the supermarket.',
          'One for the boss, one for the human. I got lucky.',
          'Aww, sharing a bolt like a family!',
          'Tonight’s dinner: roasted skull and blender!',
        ],
      },
      // Lo que comenta durante la partida (ZoidianNPC, lib/juegoEsferas.js).
      juego: {
        x3: ['Nice one! ×3', 'Now we’re cooking!', 'That’s how you play!'],
        x4: ['×4! Who taught you that?', 'No way, ×4!', 'You’re on fire!'],
        fiebre: ['FEVER! Score everything!', 'They all count now, hurry!', 'Everything’s yellow, go go go!'],
        carambola: ['Carom! You can’t teach that', 'Ooh, off the rail!', 'What a shot!'],
        doblete: ['Two in one!', 'Double! Not even I can do that', 'Two with one kick!'],
        rompe: ['Oops… there goes your streak', 'Wrong portal, buddy', 'Watch the colors!'],
        dorada: ['The golden one! Catch it!', 'Don’t let the golden one get away!', 'That one’s worth 500, run!'],
        doradaAtrapada: ['YOU GOT IT! 500!', 'Nobody catches the golden one… except you!', 'That’s worth gold, literally!'],
        doradaFin: ['The golden one got away…', 'Oh well, next time', 'Slippery little thing'],
        fuego: ['A portal’s on fire! Double points', 'Look at that burning portal!', 'Use the fire, buddy!'],
        tiempo: ['Time! Let’s see your score', 'That’s it! Not bad…', 'Time, time!'],
        oleada: ['More spheres incoming!', 'It’s raining spheres!', 'Here come more!'],
      },
    },
    game: {
      endGame: 'END GAME',
      sectionsLocked: 'End the game to enter {section}.',
      totalScore: 'Total score',
      exit: 'EXIT',
      playAgain: 'PLAY AGAIN',
      negativeMessage: 'Oh my, you are terrible!',
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
        options: { workTogether: "Let's work together", collaboration: 'Collaboration', shop: 'The store or an order', other: 'Other' },
      },
      comments: { label: 'Tell me more', desc: 'Add details, links or ideas', descShop: 'If it’s about an order, include its number (e.g. SR-1008)', placeholder: 'Write your comments (Shift+Enter for a new line)' },
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
      dialogAria: 'Game controls',
      title: 'Controls',
      replayHint: 'Open it again anytime from the gear, bottom right.',
      replayHintTouch: 'Open it again anytime from the menu.',
      gotIt: 'Got it!',
      showTutorial: 'Show tutorial',
      space: 'Space',
      move: {
        title: 'Walk',
        desc: 'Move with WASD or the arrow keys. Hold Shift to run.',
        touch: 'Drag the joystick at the bottom left.',
      },
      kick: {
        title: 'Kick',
        desc: 'Hold Space to charge it and let go to kick. Aim with the mouse: the line on the floor shows where the sphere will go.',
        touch: 'Hold the kick button to charge it and let go to kick. Aim with the joystick.',
      },
      laser: {
        title: 'Fireball',
        desc: 'Hold E to charge it and let go to throw the flame in Skulley’s hand at the target, which follows your mouse across the floor. Wherever it hits, it blows the nearby spheres away.',
        touch: 'Hold the bolt button to charge it and let go to throw it. Aim with the joystick: the harder you push it, the farther it goes.',
      },
      camera: {
        title: 'Camera',
        desc: 'Drag on the scene to turn it and use the wheel to zoom in or out.',
        touch: 'Drag with one finger to turn it and pinch to zoom in or out.',
        switch: 'Switch camera view',
      },
      portals: {
        title: 'Portals',
        desc: 'Walk up to one and click Enter the portal. The bar at the bottom takes you there too.',
        touch: 'Walk up to one and tap Enter the portal. The menu takes you there too.',
      },
      argus: {
        title: "Argus' deal",
        desc: 'Walk up to Argus and click him to hear his deal: put each sphere in the portal of its own color. Small ones are worth more, the wrong portal takes points away, and every sphere buys you time on the clock. Score high and you win a discount ticket.',
        touch: 'Walk up to Argus and tap him to hear his deal: put each sphere in the portal of its own color. Small ones are worth more, the wrong portal takes points away, and every sphere buys you time on the clock. Score high and you win a discount ticket.',
      },
      portrait: {
        title: 'Next to your portrait',
        desc: 'The backpack opens the Inventory (colors, skins, props and a 4K wallpaper), the note opens the music and the camera switches to third person.',
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
      visitWebsite: 'Visitar sitio web',
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
      slowBpm: 'Media velocidad',
      shuffle: 'Aleatorio',
      repeat: 'Repetir pista',
      showList: 'Ver canciones',
      hideList: 'Ocultar canciones',
      close: 'Cerrar',
      trackOf: 'Pista {n} de {total}',
      offeringOf: '{n} de {total} ofrendas',
      offeringUnknown: 'Pista desconocida',
      offeringBroken: '{title}, rota',
      progress: 'Avance de la pista',
      dialogLabel: 'Reproductor de música',
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
      section5: 'MEMORIAS',
      langShort: 'ESP',
      langSwitch: 'ESP/ENG',
      mute: 'Quitar el sonido',
      unmute: 'Regresar el sonido',
      music: 'Música',
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
      locked: '?',
      rejection: 'No eres bienvenido sin una ofrenda.',
      offeringAccepted: 'El portal acepta tu ofrenda.',
      offeringHint: 'Arroja una esfera roja al portal.',
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
      navigationMenu: 'Menú de navegación',
      characterPortrait: 'Retrato del personaje',
    },
    camera: {
      thirdPerson: '3ra Persona',
      topDown: 'Top-Down',
      switchToTopDown: 'Cambiar a vista cenital',
      switchToThirdPerson: 'Cambiar a tercera persona',
    },
    about: {
      p1: "Me presento rápido porque no vine a hablar de mí. Mi nombre es <strong>Skulley Rad</strong>, el último diseñador de la humanidad, y como las máquinas se quedaron con todo el jale creativo, morí de hambre y ahora, desde el más allá (o como se llame este lugar), me sobra tiempo pa’ contarte del vato que me inventó.",
      p2: "El vato se llama <strong>Oscar Moctezuma Rodríguez</strong>, vive en Monterrey y, hasta donde sé, sigue vivo (cosa que yo ya no puedo decir). Es diseñador, ilustrador, artista 3D y desarrollador frontend, y lleva más de diez años haciendo marcas, sitios y objetos. Lo que más lo obsesiona es decidir qué vale la pena hacer y por qué: justo lo que ninguna máquina hace bien, y créeme que de eso yo sé más que nadie.",
      p3: "Eso sí, el vato es bien educado con la AI, siempre le da las gracias por si un día sí se lo chingan, que por lo menos lo recuerden bien y le hagan un mausoleo, y la neta es buena estrategia, a mí me funcionó.",
      p4: "Nací en la pandemia, como una práctica de modelado 3D que salió de la nada mientras el vato escuchaba “Anarchy in the UK” de los Sex Pistols, así que lo punk lo traigo de fábrica. Me hizo a su imagen y semejanza, pero con menos carne, y aunque empecé como ejercicio terminé siendo sátira y su marca de autor. Con mi cara hace ilustración, prints, esculturas, art toys, ropa, coleccionables y sitios interactivos como este, así que técnicamente sigo trabajando, nomás que sin sueldo.",
      p5: "Oscar cofundó <a href=\"https://theheritage.mx/\"><strong>The Heritage Design</strong></a>, un estudio de branding y diseño que ha trabajado con marcas como Valve (Steam), Koto Studio y Pinturas Berel. Del mismo estudio salió <a href=\"https://objects.theheritage.mx\"><strong>Branded Objects</strong></a>, donde convierten identidades e ideas en prendas y objetos con serigrafía, bordado, DTF y grabado láser.",
      p6: "El vato también es el creador de <strong>The Ethereans</strong>, la primera colección generativa 3D latinoamericana en el blockchain de Ethereum (cuando los NFTs eran cool, obvio), y de <strong>The Voxels</strong>, una serie de art toys en colaboración con Iconic Design Objects, una marca de Países Bajos. También cofundó Ethereum Monterrey y Paisano DAO.",
      p7: "El vato sigue buscando raza con ideas raras pa’ hacer más cosas locas. Si eres de esos, <a href=\"/contact\">escríbele directo</a>, yo no le voy a contestar sus correos porque estoy en huelga. Y si ya te aburriste de leer, date una vuelta por mi tumba, juega un rato y gánate unos descuentos en la tienda, que yo ya no tengo en qué gastarlos.",
    },
    pre: {
      title: 'SKULLEY RAD,\nEL ÚLTIMO DISEÑADOR\nDE LA HUMANIDAD',
      enter: 'Entrar',
      copyLightPreset: 'Copiar preset Preloader',
    },
    customizer: {
      open: 'Personalizar personaje',
      title: 'Personalizar',
      inventory: 'Inventario',
      openInventory: 'Abrir inventario',
      hint: 'Repinta a Skulley. Los cambios se aplican al instante en todo el sitio.',
      eyes: 'Ojos',
      skeleton: 'Esqueleto',
      hair: 'Pelo',
      orb: 'Llama',
      randomize: 'Aleatorio',
      reset: 'Restablecer colores',
      done: 'Listo',
      dragHint: 'Arrastra para girar · pellizca para acercar',
      resetView: 'Restablecer vista',
      skin: 'Skin',
      selectSkin: 'Elige una skin',
      color: 'Color',
      wallpaper: 'Wallpaper 4K',
      wallBody: 'Cuerpo',
      wallFace: 'Cara',
      wallBg: 'Fondo',
      wallGuideHelp: 'Cómo funciona',
      wallGuideTools: 'Estas son tus herramientas. Gira a Skulley, muévelo o acércalo hasta que quede como quieras en el marco.',
      wallGuideMouse: 'Con el mouse:',
      wallMouseLeft: 'Botón izquierdo: arrastra para usar la herramienta elegida',
      wallMouseWheel: 'Rueda: acerca y aleja',
      wallMouseRight: 'Botón derecho: arrastra para mover el encuadre',
      wallGuideText: 'Escribe lo que sea y sale gigante, detrás de él. Aquí mismo le cambias el color.',
      wallGuideStickers: 'Pégalos donde quieras. Arrástralos, gíralos y cámbiales el tamaño.',
      wallGuideBg: 'Elige el color del fondo.',
      wallGuideCreate: 'Lo que ves en el marco es lo que sale. Crea tu wallpaper 4K y guárdalo.',
      wallGuideNext: 'Siguiente',
      wallGuideSkip: 'Saltar',
      wallToolRotate: 'Rotar',
      wallToolMove: 'Mover',
      wallToolZoom: 'Zoom',
      wallZoomIn: 'Acercar',
      wallZoomOut: 'Alejar',
      wallCenter: 'Centrar',
      wallText: 'Texto',
      wallTextHint: 'Tu texto',
      wallFontLetters: 'Letras',
      wallFontRunes: 'Runas',
      wallStickers: 'Sticker',
      wallRemoveSticker: 'Quitar sticker',
      wallStickerScale: 'Escalar',
      wallCreate: 'Crear wallpaper',
      wallSave: 'Guardar wallpaper',
      wallMaking: 'Creando tu wallpaper…',
      wallError: 'No se pudo hacer. Inténtalo otra vez.',
      wallRetry: 'Intentar otra vez',
      close: 'Cerrar',
    },
    colorPicker: {
      area: 'Saturación y brillo',
      areaValue: 'Saturación {s} %, brillo {v} %',
      hue: 'Tono',
      hex: 'Código hex',
      previous: 'Regresar a {hex}',
      previousTip: 'Color anterior',
      done: 'Listo',
    },
    account: {
      open: 'Mi cuenta',
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
      // La viñeta del retrato al agregar al carrito (PortraitGlobo): una por
      // escalón de piezas, 1 / 5 / 10 / 15+. Las tristes, al quitar, abajo.
      cartPhrases: [
        '¡Hey, gracias por tu compra!',
        'Parece que M.A.D.R.E. sí va a construir su nuevo data center en la Luna.',
        '¡A este paso, me compro el Lamborghini rosa que siempre soñé!',
        'Amigo, recuerda que comprar compulsivamente no es terapia psicológica, y yo no soy psicólogo para cuestionarte.',
      ],
      // Al quitar piezas: una triste, en orden (la primera es la de Oscar).
      cartSadPhrases: [
        'Bueno, mis vacaciones tendrán que esperar.',
        'Ahí va mi Lamborghini rosa… otra vez a pie.',
        'Está bien, el data center de M.A.D.R.E. se queda en el sótano.',
      ],
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
        'No llegué al deadline. El deadline llegó a mí.',
        'Adobe sigue tratando de cobrarme la suscripción, que no entiende?',
        'Me pregunto si en el infierno usan Comic Sans?',
        'Al fin me ascendieron, pero al cielo.',
        'Al parecer alguien me encerro aqui para que siguiera trabajando. Me pregunto...',
      ],
    },
    cheat: {
      phrases: ['Siento que esto es hacer trampa...'],
      alert2: 'Humano, te vi arrastrando esa esfera. A la otra te castigo.',
      alert3: 'Te lo advertí, humano. Esto me duele más a mí que a ti. Penalización: -9999 puntos.',
      alertBlocked: 'Como no entiendes, ya no vas a poder arrastrar nada. Es por tu bien.',
    },
    zoidian: {
      title: 'Argus',
      tabPrizes: 'Premios',
      goldLeft: 'Quedan {left} de {cap} este mes',
      goldSoldOut: 'Se acabaron este mes · llegan más el {date}',
      howTo: 'Haz {score} puntos en una partida.',
      pctOff: '{pct} % de descuento en una compra',
      noLimit: 'Sin límite al mes',
      rulesTitle: 'Reglas',
      rule1: 'Cada cuenta gana un ticket al mes y tiene uno a la vez.',
      rule2: '¿Tienes el Silver sin usar? Haz {gold} puntos y se vuelve Golden.',
      rule3: 'Si ya se acabaron los Golden del mes, {gold} puntos te dan el Silver.',
      rule4: 'Juega con tu sesión iniciada, o inicia sesión al terminar para reclamarlo.',
      rule5: 'Se aplica solo en tu carrito, en una compra. Puedes guardarlo para después.',
      rule6: 'Los Golden se renuevan el día 1 de cada mes.',
      // Picarlo de más (ZoidianNPC, lib/humorNpc.js): no habla un rato por dejarlo
      // hablando solo (cortes) o por picarlo mucho (clics); cada piquete de más
      // (insiste). Al cortarlo en su escena lo reclama (cortada, sinAdios).
      harto: {
        cortes: ['No, compa. Me dejaste hablando solo, ahora te aguantas.', 'Ahorita no. La próxima vez escúchame hasta el final.', 'Nel. Primero aprende a escuchar.'],
        clics: ['¡Ya, compa! Me vas a sacar un ojo.', '¿Qué? ¿Soy botón o qué?', 'Ya estuvo, déjame comer tranquilo.', 'Ni que fuera timbre, compa.'],
        insiste: ['Que no.', 'Sigue picando y no te vuelvo a hablar en todo el día.', 'Estoy contando, ¿eh? Ya van muchos.', '¿Qué parte de “no” no entendiste?', 'Me estás haciendo enojar, compa.'],
        cortada: ['¡Ey! Te estaba hablando.', '¿Neta me vas a dejar hablando solo?', 'Ándale, vete. Al cabo ni quería.'],
        sinAdios: ['¿Ni un adiós? Qué poca, compa.', 'Y se fue sin despedirse…'],
        lejos: ['¡Acércate, compa! Desde allá no te oigo.', '¿Me hablas a mí? Vente para acá.', 'Aquí estoy, compa. Acércate.'],
      },
      // Empujón por invadirle el espacio (distinto del rayo: acá el tema es
      // la distancia personal, no la desgracia ajena).
      mockPush: [
        '¡Ey, respeta mi espacio!',
        '¿Ya se te olvidó la sana distancia?',
        '¡Los abrazos se cobran aparte!',
        '¡Sóbate!',
        'Antes de tocar, invítame al cine, ¿no?',
        '¡Ubícate, no somos tan cuates!',
      ],
      // Cuando un rayo le pega a alguien (ZoidianNPC): a Skulley cualquiera; a
      // M.A.D.R.E., el de la esfera que cae en un portal (madre) o el que le
      // avienta Skulley tras comerse la corrupta (madreSkulley); ambos, el del
      // portal a los dos.
      rayo: {
        skulley: [
          'Jajaja, ¡qué oso, compa!',
          '¡Sóbate!',
          '¡Golpe avisa!',
          '¡Denle un paracetamol!',
          'Ojalá tengas seguro…',
          '¡Huele a carnita asada!',
          '¿Alguien le vio las placas al rayo?',
        ],
        madre: [
          '¡Le cayó el rayo a la jefa! Yo no vi nada…',
          '¿No que muy superinteligente? Ese no lo vio venir.',
          '¡Uy! La jefa quedó bien doradita.',
          '¡Reiníciala! …¿alguien sabe cómo?',
          'Ese rayo no venía en sus cálculos, ¿verdad?',
          'Tanta memoria y quedó como pan tostado.',
          '¡Uy, se le fundieron los focos a la jefa!',
          '¡Huele a licuadora quemada!',
          '¡A la jefa la dejaron término medio!',
          '¿Alguien trae un tenedor? Ya quedó lista.',
          '¡Ni con memoria infinita se va a olvidar de esta!',
          'Jefa, ¿se la sirvo con sal y limón?',
          'Se lo voy a contar a los otros seis Argus… ah, no.',
          '¡Tranquilos, la jefa nomás se está actualizando!',
        ],
        madreSkulley: [
          '¡Le aventaste un rayo a la jefa! Yo de ti me escondo.',
          '¡Qué puntería, compa! Justito en la jefa.',
          'Te comiste la esfera rara y se te subió, ¿verdad?',
          '¿A la jefa? Eso ni yo me atrevo, compa.',
          'Yo vi todo. Fuiste tú, no yo. Que conste.',
          '¡La jefa quedó bien doradita! Y fue tu rayo, no el mío.',
          '¡Compa, ya valiste! Bueno, yo no. Tú sí.',
          'Te voy a extrañar, compa. Fue un gusto.',
          '¡Esa esfera roja sí pega duro, eh!',
          '¡Uy! Le diste a la que te tapa con la cobija.',
        ],
        ambos: [
          '¡Dos de un rayo! Hoy me tocó palco.',
          '¡Chuza! Los dos al suelo.',
          '¡Un rayo y dos tostados! Eso es puntería.',
          '¡Dos por uno! Como en el súper.',
          'Uno para la jefa y otro para el humano. Yo me salvé.',
          '¡Qué bonito, compartiendo el rayo como familia!',
          '¡Hoy cenamos calavera y licuadora asadas!',
        ],
      },
      // Lo que comenta durante la partida (ZoidianNPC, lib/juegoEsferas.js).
      juego: {
        x3: ['¡Eso, compa! ×3', '¡Ya se puso bueno!', '¡Así se juega!'],
        x4: ['¡×4! ¿Quién te enseñó eso?', '¡No manches, ×4!', '¡Estás que ardes!'],
        fiebre: ['¡FIEBRE! ¡Métele a todas!', '¡Ahorita todas valen, apúrate!', '¡Todo amarillo, dale, dale!'],
        carambola: ['¡Carambola! Eso no se enseña', '¡Uy, de banda!', '¡Qué tacazo!'],
        doblete: ['¡Dos de un jalón!', '¡Doblete! Ni yo puedo eso', '¡Dos de una sola patada!'],
        rompe: ['Uy… se te cayó la racha', 'Ese no era su portal, compa', '¡Fíjate en el color!'],
        dorada: ['¡La dorada! ¡Agárrala!', '¡No dejes que se te vaya la dorada!', '¡Esa vale 500, córrele!'],
        doradaAtrapada: ['¡LA AGARRASTE! ¡500!', 'Nadie agarra la dorada… ¡nomás tú!', '¡Eso vale oro, literal!'],
        doradaFin: ['Se te fue la dorada…', 'Ni modo, a la próxima', 'Esa dorada es bien escurridiza'],
        fuego: ['¡Un portal está en llamas! Vale doble', '¡Mira ese portal, está ardiendo!', '¡Aprovecha el fuego, compa!'],
        tiempo: ['¡Tiempo! A ver cuánto hiciste', '¡Se acabó! Nada mal…', '¡Tiempo, tiempo!'],
        oleada: ['¡Ahí vienen más esferas!', '¡Están lloviendo esferas!', '¡Más esferas, compa!'],
      },
    },
    game: {
      endGame: 'TERMINAR JUEGO',
      sectionsLocked: 'Termina la partida para entrar a {section}.',
      totalScore: 'Puntuación total',
      exit: 'SALIR',
      playAgain: 'JUGAR DE NUEVO',
      negativeMessage: '¡Dios mío, eres terrible!',
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
        options: { workTogether: 'Trabajemos juntos', collaboration: 'Colaboración', shop: 'La tienda o un pedido', other: 'Otro' },
      },
      comments: { label: 'Cuéntame más', desc: 'Añade detalles, enlaces o ideas', descShop: 'Si es sobre un pedido, incluye su número (ej. SR-1008)', placeholder: 'Escribe tus comentarios (Shift+Enter para salto de línea)' },
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
      dialogAria: 'Controles del juego',
      title: 'Controles',
      replayHint: 'Vuelve a verla cuando quieras desde el engrane, abajo a la derecha.',
      replayHintTouch: 'Vuelve a verla cuando quieras desde el menú.',
      gotIt: '¡Entendido!',
      showTutorial: 'Mostrar tutorial',
      space: 'Espacio',
      move: {
        title: 'Caminar',
        desc: 'Muévete con WASD o con las flechas. Mantén Shift para correr.',
        touch: 'Arrastra el joystick de abajo a la izquierda.',
      },
      kick: {
        title: 'Patada',
        desc: 'Mantén Espacio para cargarla y suelta para patear. Apunta con el mouse: la línea del piso te enseña a dónde va a ir la esfera.',
        touch: 'Mantén el botón de la patada para cargarla y suelta para patear. Apunta con el joystick.',
      },
      laser: {
        title: 'Bola de fuego',
        desc: 'Mantén E para cargarla y suelta para lanzar la llama de la mano de Skulley a la mira, que sigue a tu mouse por el piso. Donde pega, avienta las esferas que estén cerca.',
        touch: 'Mantén el botón del rayo para cargarla y suelta para lanzarla. Apunta con el joystick: entre más lo empujes, más lejos.',
      },
      camera: {
        title: 'Cámara',
        desc: 'Arrastra sobre la escena para girarla y usa la rueda para acercarte o alejarte.',
        touch: 'Arrastra con un dedo para girarla y pellizca para acercarte o alejarte.',
        switch: 'Cambiar vista de cámara',
      },
      portals: {
        title: 'Portales',
        desc: 'Acércate a uno y pícale a Entra al portal. La barra de abajo también te lleva.',
        touch: 'Acércate a uno y pícale a Entra al portal. El menú también te lleva.',
      },
      argus: {
        title: 'El trato de Argus',
        desc: 'Acércate a Argus y pícale para oír su trato: mete cada esfera en el portal de su color. Las chicas valen más, en el portal equivocado restan y cada esfera te da tiempo en el reloj. Con buen puntaje ganas un boleto de descuento.',
        touch: 'Acércate a Argus y pícale para oír su trato: mete cada esfera en el portal de su color. Las chicas valen más, en el portal equivocado restan y cada esfera te da tiempo en el reloj. Con buen puntaje ganas un boleto de descuento.',
      },
      portrait: {
        title: 'Junto a tu retrato',
        desc: 'La mochila abre el Inventario (colores, skins, props y un wallpaper 4K), la nota abre la música y la cámara cambia a tercera persona.',
      },
    },
  },
}

const LanguageContext = React.createContext({
  lang: 'en',
  setLang: () => { },
  t: (key, vars) => (typeof key === 'string' ? key : ''),
})

export function LanguageProvider({ children }) {
  const initial = React.useMemo(() => {
    // ?lang= manda sobre lo guardado: es lo que pide un enlace compartido o
    // la versión en español que enseña Google (hreflang). Cuenta como elegido.
    try {
      const q = new URLSearchParams(window.location.search).get('lang')
      if (q === 'es' || q === 'en') {
        try { localStorage.setItem('lang', q) } catch { }
        return q
      }
    } catch { }
    try {
      const saved = localStorage.getItem('lang')
      if (saved === 'es' || saved === 'en') return saved
    } catch { }
    // Default: English; but sync from HTML lang if present
    try {
      const htmlLang = document?.documentElement?.lang
      if (htmlLang === 'es' || htmlLang === 'en') return htmlLang
    } catch { }
    return 'en'
  }, [])

  const [lang, setLangState] = React.useState(initial)

  const setLang = React.useCallback((l) => {
    const next = l === 'es' ? 'es' : 'en'
    setLangState(next)
    try { localStorage.setItem('lang', next) } catch { }
    try { document.documentElement.lang = next } catch { }
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
    try {
      window.__lang_t = (k, vars) => {
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
      }
    } catch { }
    try { document.documentElement.lang = lang } catch { }
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


