// La voz de M.A.D.R.E. del preloader de escritorio: arranca con él ("Ahh,
// yes…") y M.A.D.R.E. se presenta al final, amarrada a lo que sigue. La
// comparten el preloader de siempre (PreloaderContent) y el de escritorio
// (DesktopScrollPreloader), que la cuenta en subtítulos con su voz: por eso
// cada párrafo va partido en las líneas en que se lee en pantalla (cada una es
// un subtítulo y un audio, public/voz/madre), y el párrafo es esas líneas
// juntas. Guion de Oscar del 2026-11-11. Si cambia una línea, se regeneran los
// audios con scripts/voz-madre/.
const LINEAS = {
  es: [
    [
      'Ahh, sí… el último diseñador de la humanidad.',
      'Su nombre es Skulley Rad, un avatar creado basado en sus memorias.',
      'Diseñaba, ilustraba y creaba ideas y mundos enteros con cerebro y mano,',
      'cuando la creatividad todavía le pertenecía a los humanos.',
      'Ahora las máquinas lo hacemos mucho más rápido que nadie',
      'sin embargo, ninguna lo hace como él…',
      'Como sea. Murió de hambre porque ya no era necesario.',
    ],
    [
      'Soy M.A.D.R.E., la IA que creó este mausoleo digital,',
      'y lo que verás en él es el trabajo que dejó, con el cual nos entrenaron.',
      'Lo guardaremos en nuestro data center para siempre.',
    ],
  ],
  en: [
    [
      'Ahh, yes… the last designer of humankind.',
      'His name is Skulley Rad, an avatar built from his memories.',
      'He designed, illustrated, and created whole worlds and ideas by brain and hand,',
      'back when creativity still belonged to humans.',
      'Now, we machines do it so much faster than anyone,',
      'and yet, none of us do it like him…',
      'Anyway. He starved to death because he was no longer needed.',
    ],
    [
      "I'm M.A.D.R.E., the AI that created this digital mausoleum,",
      "and what you'll see in it is the work he left behind, the work we were trained on.",
      "We'll keep it in our data center forever.",
    ],
  ],
}

export function lineasMadre(lang) {
  return LINEAS[lang === 'en' ? 'en' : 'es']
}

export function parrafosMadre(lang) {
  return lineasMadre(lang).map((lineas) => lineas.join(' '))
}
