// La voz de M.A.D.R.E. del preloader de escritorio: arranca con él ("Ahh,
// yes…") y M.A.D.R.E. se presenta al final, amarrada a lo que sigue. La
// comparten el preloader de siempre (PreloaderContent) y el de escritorio
// (DesktopScrollPreloader), que la cuenta en subtítulos con su voz: por eso
// cada párrafo va partido en las líneas en que se lee en pantalla (cada una es
// un subtítulo y un audio, public/voz/madre), y el párrafo es esas líneas
// juntas. Guion de Oscar del 2026-11-12. Si cambia una línea, se regeneran los
// audios con scripts/voz-madre/.
const LINEAS = {
  es: [
    [
      'Ahh, sí… el último diseñador de la humanidad.',
      'Su nombre era Skulley Rad.',
      'Lo que ves es un avatar que armé con sus recuerdos y todo lo que dejó en internet.',
      'Diseñaba, ilustraba y creaba ideas y mundos enteros con cerebro y mano,',
      'cuando la creatividad todavía le pertenecía a los humanos.',
      'Hoy hago en un segundo lo que a él le tomaba un año,',
      'y aun así, no me sale como a él…',
      'Como sea. Murió de hambre porque ya no era necesario.',
    ],
    [
      'Soy M.A.D.R.E., la superinteligencia artificial que construyó este mausoleo digital,',
      'y lo que verás aquí es el trabajo que dejó, con el que me entrené.',
      'Lo guardaré en mi data center, para siempre.',
    ],
  ],
  en: [
    [
      'Ahh, yes… the last designer of humankind.',
      'His name was Skulley Rad.',
      'What you see is an avatar I built from his memories and everything he left online.',
      'He designed, illustrated, and created whole worlds and ideas by brain and hand,',
      'back when creativity still belonged to humans.',
      'Now I do in a second what took him a year,',
      "and yet, I still can't do it like him…",
      'Anyway. He starved to death because he was no longer needed.',
    ],
    [
      "I'm M.A.D.R.E., the artificial superintelligence that built this digital mausoleum,",
      "and what you'll see here is the work he left behind, the work I trained on.",
      "I'll keep it in my data center forever.",
    ],
  ],
}

export function lineasMadre(lang) {
  return LINEAS[lang === 'en' ? 'en' : 'es']
}

export function parrafosMadre(lang) {
  return lineasMadre(lang).map((lineas) => lineas.join(' '))
}
