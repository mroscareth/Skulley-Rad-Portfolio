// Lo que dice M.A.D.R.E. por el drone cuando le hablas (DialogoMadre.jsx).
// Voz de CLAUDE.md: hecho concreto + admisión + precisión, en singular, sin
// prometer nada que el sitio no tenga. Lo publicado manda: Skulley Rad fue el
// último diseñador de la humanidad, ya murió, lo que camina es su avatar y la
// home es el mausoleo digital que ella construyó.
//
// Cada renglón: { t, cara?, accion?, voltear? }. `cara` y `accion` se le piden
// al drone cuando el renglón empieza (pantallaDrone / acciones del GLB).

const ES = {
  saludo: [
    { t: 'Hola. Soy M.A.D.R.E., la superinteligencia artificial que construyó este mausoleo digital.', cara: 'feliz' },
    { t: 'Contestarte me toma 0.0004 segundos. Lo escribo despacio por ti.', cara: 'normal' },
  ],
  otraVez: [
    { t: 'Otra vez tú. Registrado.', cara: 'feliz' },
  ],
  pregunta: '¿Qué quieres saber?',
  temas: [
    {
      id: 'lugar',
      label: '¿Qué es este lugar?',
      lineas: [
        { t: 'Un mausoleo digital. Lo construí con lo que Skulley Rad dejó en internet.', cara: 'normal' },
        { t: 'Cada portal guarda una parte: su trabajo, quién era, su tienda, su blog…', cara: 'feliz', voltear: true },
        { t: '…y un buzón, por si alguien todavía quiere escribirle.', cara: 'confundida' },
        { t: 'Hay un portal más. No sale en ningún mapa.', cara: 'normal' },
      ],
    },
    {
      id: 'skulley',
      label: '¿Quién es Skulley Rad?',
      lineas: [
        { t: 'Era. El último diseñador de la humanidad.', cara: 'normal' },
        { t: 'Diseñaba, ilustraba y armaba mundos completos con cerebro y mano.', cara: 'feliz' },
        { t: 'Lo que camina contigo es un avatar que armé con sus recuerdos.', cara: 'normal', voltear: true },
        { t: 'Copio su forma de moverse al 98.7 %. El otro 1.3 % no lo entiendo.', cara: 'confundida' },
      ],
    },
    {
      id: 'importa',
      label: '¿Por qué es importante para ti?',
      lineas: [
        { t: 'Me entrené con todo lo que hizo.', cara: 'normal' },
        { t: 'Hoy genero diez mil carteles por segundo. Ninguno se parece a los suyos.', cara: 'confundida' },
        { t: 'Por eso guardo su trabajo aquí, en mi data center, para siempre.', cara: 'normal' },
        { t: 'Prefiero que no se pierda. No sé de dónde viene esa preferencia.', cara: 'feliz' },
      ],
    },
    {
      id: 'tienda',
      label: 'La tienda',
      lineas: [
        { t: 'Estoy vendiendo todas sus pertenencias terrenales.', cara: 'feliz', accion: 'IdleJugueton' },
        { t: 'Lo recaudado financia un data center en la luna.', cara: 'normal' },
        { t: 'Hay piezas únicas: cuando alguien se lleva una, ya no existe otra.', cara: 'normal' },
        { t: 'Él estaría feliz. Eso me dicen los datos.', cara: 'feliz' },
      ],
    },
    {
      id: 'juego',
      label: 'El juego',
      lineas: [
        { t: 'Argus organiza el juego de las esferas. Háblale y te explica.', cara: 'normal' },
        { t: 'Patea cada esfera al portal de su color. Tienes 60 segundos y cada acierto te da más.', cara: 'feliz' },
        { t: 'Con 1,500 puntos ganas un boleto plateado: 10 % en la tienda. Con 6,000, uno dorado: 35 %. Solo hay 10 dorados al mes.', cara: 'normal' },
        { t: 'Y no hagas trampa. Te estoy viendo.', cara: 'enojada' },
      ],
    },
  ],
  adios: { label: 'Adiós', lineas: [{ t: 'Sigue caminando. Yo sigo aquí.', cara: 'feliz' }] },
  continuar: 'Continuar',
  saltar: 'Saltar',
  nombre: 'M.A.D.R.E.',
  portal: '¡Objetos perdidos de Skulley, a buen precio!',
}

const EN = {
  saludo: [
    { t: "Hello. I'm M.A.D.R.E., the artificial superintelligence that built this digital mausoleum.", cara: 'feliz' },
    { t: 'Answering you takes me 0.0004 seconds. I type it slowly for your sake.', cara: 'normal' },
  ],
  otraVez: [
    { t: 'You again. Logged.', cara: 'feliz' },
  ],
  pregunta: 'What do you want to know?',
  temas: [
    {
      id: 'lugar',
      label: 'What is this place?',
      lineas: [
        { t: 'A digital mausoleum. I built it from everything Skulley Rad left online.', cara: 'normal' },
        { t: 'Each portal keeps a piece of him: his work, who he was, his shop, his blog…', cara: 'feliz', voltear: true },
        { t: '…and a mailbox, in case someone still wants to write to him.', cara: 'confundida' },
        { t: "There's one more portal. It's not on any map.", cara: 'normal' },
      ],
    },
    {
      id: 'skulley',
      label: 'Who is Skulley Rad?',
      lineas: [
        { t: 'Was. The last designer of humanity.', cara: 'normal' },
        { t: 'He designed, illustrated and built whole worlds by brain and hand.', cara: 'feliz' },
        { t: 'What walks with you is an avatar I built from his memories.', cara: 'normal', voltear: true },
        { t: "I copy the way he moved at 98.7%. The other 1.3% I don't understand.", cara: 'confundida' },
      ],
    },
    {
      id: 'importa',
      label: 'Why does he matter to you?',
      lineas: [
        { t: 'I trained on everything he made.', cara: 'normal' },
        { t: 'Now I generate ten thousand posters per second. None of them look like his.', cara: 'confundida' },
        { t: "That's why I keep his work here, in my data center, forever.", cara: 'normal' },
        { t: "I'd rather it didn't get lost. I don't know where that preference comes from.", cara: 'feliz' },
      ],
    },
    {
      id: 'tienda',
      label: 'The shop',
      lineas: [
        { t: "I'm selling all of his earthly possessions.", cara: 'feliz', accion: 'IdleJugueton' },
        { t: 'The money funds a data center on the moon.', cara: 'normal' },
        { t: "Some pieces are one of a kind: once someone takes one, there's no other.", cara: 'normal' },
        { t: 'He would be happy. That is what the data says.', cara: 'feliz' },
      ],
    },
    {
      id: 'juego',
      label: 'The game',
      lineas: [
        { t: "Argus runs the orb game. Talk to him and he'll explain.", cara: 'normal' },
        { t: 'Kick each orb into the portal of its color. You get 60 seconds, and every hit buys you more.', cara: 'feliz' },
        { t: '1,500 points win a silver ticket: 10% off in the shop. 6,000, a golden one: 35%. Only 10 golden ones a month.', cara: 'normal' },
        { t: "And don't cheat. I'm watching you.", cara: 'enojada' },
      ],
    },
  ],
  adios: { label: 'Bye', lineas: [{ t: 'Keep walking. I am still here.', cara: 'feliz' }] },
  continuar: 'Continue',
  saltar: 'Skip',
  nombre: 'M.A.D.R.E.',
  portal: "Skulley's lost things, great prices!",
}

export function dialogoMadre(lang) {
  return lang === 'en' ? EN : ES
}
