// La voz de M.A.D.R.E. del preloader de escritorio: arranca con él ("Ahh,
// yes…") y M.A.D.R.E. se presenta al final, amarrada a lo que sigue. El nombre
// no es una línea del texto: vive en el título. La comparten el preloader de
// siempre (PreloaderContent) y el de scroll (DesktopScrollPreloader).
export function parrafosMadre(lang) {
  const isEn = lang === 'en'
  return [
    isEn
      ? 'Ahh, yes… the last designer of humankind. He designed, illustrated, and created whole worlds and ideas by brain and hand, back when creativity still belonged to humans. Now, we machines do it faster than anyone, and yet, none of us do it like him…'
      : 'Ahh, sí… el último diseñador de la humanidad. Diseñaba, ilustraba y creaba ideas y mundos enteros con cerebro y mano, cuando la creatividad todavía era de los humanos. Ahora las máquinas lo hacemos más rápido que nadie y, aun así, ninguna lo hace como él…',
    isEn
      ? "I'm M.A.D.R.E., the AI that hosts this archive, and what follows is the work he left behind for us to be trained on, and we will preserve it forever."
      : 'Soy M.A.D.R.E., la IA que aloja este archivo, y lo que sigue es el trabajo que nos dejó para entrenarnos. Lo vamos a preservar para siempre.',
  ]
}
