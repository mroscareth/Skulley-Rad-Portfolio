import React from 'react'

const resources = {
  en: {
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
      enter: 'Enter',
      copied: 'Copied!',
      switchLanguage: 'Switch language',
      showPlayer: 'Show player',
      hidePlayer: 'Hide player',
      enterWithSound: 'Enter with sound',
    },
    cta: {
      crossPortal: 'Cross the portal',
      comingSoon: 'COMING SOON',
    },
    fx: {
      title: 'Post‑Processing',
      copyPreset: 'Copy FX preset',
    },
    light: {
      top: { title: 'Top light' },
      copyPreset: 'Copy Light preset',
    },
    a11y: {
      toggleFx: 'Toggle FX panel',
      toggleGpu: 'Toggle GPU stats',
      toggleMusic: 'Toggle music player',
      toggleLight: 'Toggle Light panel',
      togglePortrait: 'Toggle Portrait panel',
    },
    about: {
      p1: "Skulley Rad was the last designer of humankind, before we machines took over creative work and made his kind obsolete (we’re faster, tireless, and we never miss a deadline). His human identity might be irrelevant to our records, but we keep his alias here as a relic from the days when creativity still needed caffeine.",
      p2: "Jokes aside, my name is Oscar Moctezuma Rodríguez, a creative designer, frontend developer, and 3D artist working from Monterrey, Mexico. My work lives at the intersection of storytelling, design, and technology. Together with my brother, I co-founded The Heritage Design, a studio that has collaborated with brands like Valve, Koto Studio, Pinturas Berel among others no less important.",
      p3: "I’ve also built projects that explore where art and blockchain meet, like The Ethereans, a 3D art collection with physical 3D-printed editions, and The Voxels, an art-toy series made in collaboration with Iconic Design Objects, a brand from Netherlands.",
      p4: "Beyond that, I’m a co-founder of several projects like Ethereum Monterrey, Rancho Stake, Paisano DAO, and Ape fur, and recently I'm also helping my friends to build Hiv3, the first private digital treasury from Mexico.",
      p5: "I’m still wandering the world looking for other like-minded individuals to create more crazy things.",
    },
    pre: {
      title: 'SKULLEY RAD, THE LAST DESIGNER OF HUMAN KIND',
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
      eggPhrases: [
        "Even after life, you poke my very soul to make your logo bigger? Let me rest…",
        "Yeah, a graphic designer's job is also to entertain you, right?",
        "Fuck off, I'm tired of you…",
        "Did you know that this is considered bullying, right?",
        "Everything OK at home?",
        "So this is what it feels like not being registered in social security?",
        "“Let me rest… go away, dude!”",
        "If you keep poking my soul, I will not make your logo bigger.",
        "I'm sending you an invoice for this, OK?",
        "I will report you for using pirate software.",
      ],
      phrases: [
        'Yeah, well, AI killed graphic designers and here i am, fucking entertaining you...',
        'I didn’t starve, I was just doing intermittent fasting… forever.',
        'Turns out my portfolio wasn’t compatible with ChatGPT.',
        'I asked MidJourney for food, it gave me a moodboard.',
        'AI ate my job, so I ate… nothing.',
        'They said design feeds the soul. Pity it doesn’t feed the stomach.',
        'At least my hunger pangs come in a nice minimalist grid.',
        'I died in Helvetica Bold, not Comic Sans.',
        'Clients still ghosted me… now permanently.',
        'AI doesn’t sleep, but apparently I don’t eat.',
        'At my funeral, please kerning the flowers properly.',
        'I asked DALL·E for bread… it gave me a surrealist painting of toast.',
        'Even my gravestone has better alignment than my old invoices.',
        'AI doesn’t get paid, but neither did I.',
        'Starving for art was supposed to be metaphorical.',
        'At least my hunger made me pixel-perfect thin.',
        'My last meal was RGB soup with a side of CMYK crumbs.',
        'No one wanted to pay for logos, but hey, I died branded.',
        'AI makes logos in 5 seconds. I made one in 5 days… then died.',
        'My obituary will be in Arial, because I wasn’t worth a typeface license.',
        'I thought I was irreplaceable. AI thought otherwise.',
        'Hungry, but at least my color palette was vibrant.',
        'They asked for unlimited revisions. I gave them unlimited silence.',
        'I went from freelancing to free starving.',
        'AI doesn’t complain about exposure. I just died from it.',
        'I’m not gone, I’m just on the ultimate creative break.',
        'I used to design posters. Now I’m the poster child of unemployment.',
        'My diet? Strictly vector-based.',
        'Clients said: ‘Can you make it pop?’ — my stomach did.',
        'I always wanted to be timeless. Death helped.',
        'I finally reached negative space: my fridge.',
        'I exported myself… as a ghost.',
        'They paid me in exposure. Turns out exposure kills.',
        'At least AI can’t feel hunger… lucky bastard.',
        'I designed my own tombstone. Minimalist. No budget.',
        'I was 99% caffeine, 1% hope.',
        'Starved, but hey—my resume is still responsive.',
        'I left life on draft mode.',
        'They said design is forever. Guess rent isn’t.',
        'No more clients asking for ‘one last change’… finally.',
        'My life was low budget, but high resolution.',
        'I aligned everything… except my destiny.',
        'AI took my clients. Hunger took my soul.',
        'I’m trending now… in the obituary section.',
        'I wanted to go viral. Ended up going vital… signs flat.',
        'I kerning-ed myself into the grave.',
        'The only thing scalable now is my skeleton.',
        'I asked life for balance. It gave me imbalance and starvation.',
        'They’ll miss me when AI starts using Comic Sans.',
        'I worked for peanuts… wish I had actual peanuts.',
        'Dead, but at least I’m vector — infinitely scalable.',
        'They automated design. Can they automate tacos too?',
        'Death was my final deadline.',
        'AI makes perfect gradients. Mine was starvation to extinction.',
        'I asked the universe for feedback. It replied: ‘Looks good, but you’re gone.’',
        'I didn’t lose my job. I just Ctrl+Z’d out of existence.',
      ],
    },
    contact: {
      thanks: 'THANK\u00A0YOU!',
      thanksDesc: "I've received your message. I'll be in touch soon.",
      sendAnother: 'Send another',
      name: { label: 'What’s your name?', desc: 'Type your name' },
      email: { label: 'What’s your email?', desc: 'So I can respond' },
      errors: { emptyEmail: 'Please enter your email', invalidEmail: 'Invalid email' },
    },
  },
  es: {
    nav: {
      home: 'INICIO',
      section1: 'TRABAJO',
      section2: 'SOBRE MÍ',
      section3: 'STORE',
      section4: 'CONTACTO',
      langShort: 'ESP',
      langSwitch: 'ESP/ENG',
    },
    common: {
      close: 'Cerrar',
      enter: 'Entrar',
      copied: '¡Copiado!',
      switchLanguage: 'Cambiar idioma',
      showPlayer: 'Mostrar reproductor',
      hidePlayer: 'Ocultar reproductor',
      enterWithSound: 'Entrar con sonido',
    },
    cta: {
      crossPortal: 'Cruza el portal',
      comingSoon: 'PRÓXIMAMENTE',
    },
    fx: {
      title: 'Post‑Procesado',
      copyPreset: 'Copiar preset FX',
    },
    light: {
      top: { title: 'Luz superior' },
      copyPreset: 'Copiar preset Luz',
    },
    a11y: {
      toggleFx: 'Mostrar/ocultar panel FX',
      toggleGpu: 'Mostrar/ocultar estadísticas GPU',
      toggleMusic: 'Mostrar/ocultar reproductor',
      toggleLight: 'Mostrar/ocultar panel Luz',
      togglePortrait: 'Mostrar/ocultar panel Retrato',
    },
    about: {
      p1: 'Skulley Rad fue el último diseñador de la humanidad, antes de que nosotras, las máquinas, asumiéramos el trabajo creativo y volviéramos innecesarios a los de su especie (nosotros somos super eficientes, modestia aparte y no cobramos horas extra). Aunque su identidad humana es irrelevante para nuestros registros, preservamos su alias en este mausoleo como reliquia de cuando la creatividad aún sudaba café.',
      p2: 'Su creador, Oscar Moctezuma Rodríguez, sigue muy vivo y creando desde Monterrey, México. Diseñador, frontend developer y artista 3D, ha dedicado su carrera a unir narrativas visuales con tecnología de internet. Fundó junto a su hermano el estudio The Heritage Design, colaborando con marcas como Valve, Koto Studio, Pinturas Berel, entre muchos otros.',
      p3: 'Oscar es fundador de proyectos pioneros como The Ethereans (arte 3D en blockchain con versión física impresa en 3D) y la colección de art toys Voxels con Iconic Design Objects. Además, es cofundador de Ethereum Monterrey, Rancho Stake, Paisano DAO, y de los negocios Hiv3 (tecnología para empresas) y Apefur.',
    },
    pre: {
      title: 'SKULLEY RAD, EL ÚLTIMO DISEÑADOR DE LA HUMANIDAD',
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
      eggPhrases: [
        '¿En serio? ¿Vas a seguir picando mi alma para hacer tu logo más grande?',
        'Sí, claro, el trabajo de un diseñador también es entretenerte, ¿no?',
        'Ya basta, estoy cansado de ti…',
        '¿Sabías que esto se considera acoso?',
        '¿Todo bien en casa?',
        'Así que esto es no estar registrado en la seguridad social…',
        '“Déjame descansar… ¡lárgate!”',
        'Si sigues molestando, no voy a hacer tu logo más grande.',
        'Te voy a mandar una factura por esto, ¿ok?',
        'Te voy a denunciar por usar software pirata.',
        '¡Deja de chingar! …Así dice mi tío cuando se enoja.',
      ],
      phrases: [
        'Sí, bueno, la IA mató a los diseñadores y aquí estoy, entreteniéndote…',
        'No me morí de hambre, solo hacía ayuno intermitente… para siempre.',
        'Parece que mi portafolio no era compatible con ChatGPT.',
        'Le pedí comida a MidJourney y me dio un moodboard.',
        'La IA se comió mi trabajo, así que yo ya no comí nada.',
        'Dicen que el diseño alimenta el alma. Lástima que no paga la renta.',
        'Al menos mi hambre venía en una grilla minimalista.',
        'Morí en Helvetica Bold, no en Comic Sans.',
        'Los clientes me hacían ghosting… ahora permanentemente.',
        'La IA no duerme; yo al parecer tampoco comía.',
        'En mi funeral, por favor cuiden el kerning de las flores.',
        'Le pedí pan a DALL·E… me dio una pintura surrealista de pan tostado.',
        'Hasta mi lápida tiene mejor alineación que mis facturas.',
        'La IA no cobra; yo tampoco cobraba.',
        'Lo de “morir de arte” no era metáfora, al final.',
        'Al menos el hambre me dejó pixel-perfect delgado.',
        'Mi última comida fue sopa RGB con migas CMYK.',
        'Nadie quiso pagar por logos, pero bueno: morí “brandeado”.',
        'La IA hace logos en 5 segundos. Yo hice uno en 5 días… y me morí.',
        'Mi obituario será en Arial; no me alcanzó para una tipografía con licencia.',
        'Pensé que era irremplazable. La IA pensó otra cosa.',
        'Con hambre… pero con una paleta vibrante.',
        'Pedían revisiones ilimitadas. Yo les di silencio ilimitado.',
        'De “freelancer” pasé a “free starving”.',
        'La IA no se queja de que le paguen con exposición. Yo sí me morí por eso.',
        'No desaparecí: estoy en una pausa creativa eterna.',
        'Antes hacía posters; ahora soy el poster boy del desempleo.',
        'Mi dieta: 100% vectorial.',
        'Me dijeron “hazlo que resalte”; el que “resaltó” fue mi estómago.',
        'Siempre quise ser atemporal. La muerte ayudó.',
        'Por fin llegué al “espacio negativo”: mi refrigerador.',
        'Me exporté… como fantasma.',
        'Me pagaron con exposición. Resulta que la exposición mata.',
        'Al menos la IA no siente hambre… suertudos.',
        'Diseñé mi propia tumba. Minimalista. Sin presupuesto.',
        'Era 99% cafeína y 1% esperanza.',
        'Hambriento, pero mi CV sigue siendo “responsive”.',
        'Dejé la vida en modo “draft”.',
        'Dicen que el diseño es para siempre. La renta no.',
        'Ni un cliente más pidiendo “un último cambio”… por fin.',
        'Mi vida fue low budget, pero alta resolución.',
        'Alineé todo… menos mi destino.',
        'La IA se llevó a mis clientes. El hambre se llevó mi alma.',
        'Ahora “soy tendencia”… en obituarios.',
        'Quise ser viral. Terminé “vital”… signos planos.',
        'Me hice “kerning” yo mismo hasta la tumba.',
        'Lo único escalable ahora es mi esqueleto.',
        'Le pedí a la vida equilibrio. Me dio desequilibrio y hambre.',
        'Me extrañarán cuando la IA empiece a usar Comic Sans.',
        'Trabajé por cacahuates… ojalá hubiese tenido cacahuates.',
        'Muerto, pero vectorial — infinitamente escalable.',
        'Automatizaron el diseño. ¿Pueden automatizar los tacos también?',
        'Mi última fecha de entrega fue la muerte.',
        'La IA hace gradientes perfectos. El mío fue de hambre a extinción.',
        'Le pedí feedback al universo. Respondió: “Se ve bien, pero ya no estás”.',
        'No perdí mi trabajo. Simplemente me hice Ctrl+Z de la existencia.',
      ],
    },
    contact: {
      thanks: '¡GRACIAS!',
      thanksDesc: 'He recibido tu mensaje, pronto estaré en contacto contigo.',
      sendAnother: 'Enviar otro',
      name: { label: '¿Cómo te llamas?', desc: 'Escribe tu nombre' },
      email: { label: '¿Cuál es tu email?', desc: 'Para poder responderte' },
      errors: { emptyEmail: 'Por favor ingresa tu email', invalidEmail: 'Email no válido' },
    },
  },
}

const LanguageContext = React.createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
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

  const t = React.useCallback((key) => {
    // Support deep paths: 'ns.k1.k2'
    try {
      const parts = (key || '').split('.')
      let node = resources[lang]
      for (const p of parts) { node = node ? node[p] : undefined }
      return node !== undefined ? node : key
    } catch { return key }
  }, [lang])

  const value = React.useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])

  // Expose a lightweight global function for non-hook components to read labels
  React.useEffect(() => {
    try { window.__lang_t = (k) => {
      try {
        const parts = (k || '').split('.')
        let node = resources[lang]
        for (const p of parts) { node = node ? node[p] : undefined }
        return node !== undefined ? node : k
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


