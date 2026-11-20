// Lo que dice Argus en su escena del trato (components/ZoidianDialog.jsx).
// Es el guardián de la plaza y el dueño del juego de esferas: buscavidas, de
// "compa", se come las esferas con sal y se le sale que las manda a su casa. Lo
// que promete es lo que el juego hace hoy (lib/juegoEsferas.js, game-tickets.php):
// si cambia un número del juego, cambia aquí.
//
// Cada renglón: { t, accion?, cara?, mirar?, muestra?, quien? }. `quien: 'madre'`
// lo dice M.A.D.R.E. (su nombre en el globo, su bip y la cara del drone).
// accion, cara y mirar se
// le piden a Argus al empezar el renglón (lib/argusNpc.js); mirar 'portal' es el
// portal más cercano a él (lo resuelve el diálogo). muestra: lo que sale en
// pantalla junto al globo (el boleto, las teclas…), en ZoidianDialog.

import { dialogoMadre } from './dialogoMadre.js'

const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')

function fecha(iso, lang) {
  if (!iso) return ''
  const [y, m] = String(iso).split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long' })
}

// `datos`: { gold, silver, resetsAt, tactil }. gold y silver traen score y pct;
// gold además left_this_month y monthly_cap (sin conteo, undefined).
export function dialogoArgus(lang, datos) {
  const { gold = {}, silver = {}, resetsAt = null, tactil = false } = datos || {}
  const es = lang === 'es'
  const g = num(gold.score, lang)
  const s = num(silver.score, lang)
  const cap = gold.monthly_cap || 10
  const quedan = gold.left_this_month
  const sinConteo = quedan === undefined || quedan === null
  const agotados = !sinConteo && quedan <= 0

  if (es) {
    const stock = sinConteo
      ? { t: `Solo hay ${cap} dorados al mes en todo el sitio, así que no te duermas.`, cara: 'sospecha', muestra: 'dorado' }
      : agotados
        ? { t: `Este mes ya se acabaron los dorados; el ${fecha(resetsAt, lang) || '1'} llegan más. Mientras, con ${g} te llevas el plateado.`, cara: 'encoge', muestra: 'dorado' }
        : { t: `Quedan ${quedan} de ${cap} este mes. No te duermas.`, cara: 'sospecha', muestra: 'stock' }
    return {
      nombre: 'Argus',
      trato: [
        { t: '¡Hey, compa! Soy Argus, el guardián de este lugar.', accion: 'Saludo', cara: 'feliz' },
        { t: 'No sé de dónde salen estas esferas tan raras… pero con tantita sal saben deliciosas.', cara: 'sospecha' },
        { t: 'Te propongo un trato: mete todas las que puedas en los portales para teletransportarlas a mi cas— em… al vacío.', accion: 'Trato', cara: 'sospecha' },
        { t: 'Cada una al portal de su color. Tienes 60 segundos y cada acierto te da más tiempo.', accion: 'Senalar', mirar: 'portal', muestra: 'reloj' },
        { t: `A cambio, le pido a M.A.D.R.E. un descuento para ti: con ${g} puntos te ganas el boleto dorado, ${gold.pct || 35} % en la tienda.`, accion: 'Presumir', cara: 'feliz', muestra: 'dorado' },
        stock,
      ],
      otraVez: [
        { t: '¿Otra vez por aquí? Las esferas no se van a meter solas.', accion: 'Saludo', cara: 'feliz' },
      ],
      pregunta: '¿Trato?',
      preguntaOtra: '¿Entonces? ¿Trato?',
      opciones: {
        jugar: '¡Trato! A jugar',
        como: '¿Cómo se juega?',
        premios: '¿Qué me gano?',
        adios: 'Ahora no',
      },
      como: tactil ? [
        { t: 'Fácil. Acércate a una esfera y deja apretado el botón de la patada para cargarla.', muestra: 'botonPatada' },
        { t: 'Apunta con el joystick: la línea del piso te dice a dónde va a caer y cuánto va a rodar.', muestra: 'joystick' },
        { t: 'Suelta y ¡pum! Si choca con otra, le pasa el golpe, como en el billar.', accion: 'Impresionado', cara: 'sorpresa' },
        { t: 'Con el botón del rayo lanzas una bola de fuego que avienta las esferas que estén cerca de donde cae. Y también las puedes empujar caminando.', muestra: 'botonRayo' },
        { t: 'Al portal de su color suma; al equivocado, resta. Entre más chica la esfera, más vale.', accion: 'Senalar', mirar: 'portal' },
        { t: 'Mete varias seguidas y multiplicas: ×2, ×3, hasta ×4. Si fallas, se rompe la racha.', cara: 'feliz', muestra: 'racha' },
        { t: 'A veces sale una esfera dorada que brinca y se escapa. Esa vale 500.', cara: 'sorpresa', muestra: 'dorada' },
        { t: 'Lo demás, la fiebre, los portales en llamas y las carambolas, te lo grito mientras juegas.', accion: 'Risa', cara: 'carcajada' },
        { t: 'Y nada de arrastrarlas con el dedo: M.A.D.R.E. lo ve todo, y a la tercera te parte un rayo.', cara: 'furia' },
      ] : [
        { t: 'Fácil. Acércate a una esfera y deja apretado Espacio para cargar la patada.', muestra: 'espacio' },
        { t: 'Apunta con el mouse: la línea del piso te dice a dónde va a caer y cuánto va a rodar.', muestra: 'raton' },
        { t: 'Suelta y ¡pum! Si choca con otra, le pasa el golpe, como en el billar.', accion: 'Impresionado', cara: 'sorpresa' },
        { t: 'Con E lanzas una bola de fuego que avienta las esferas que estén cerca de donde cae. Y también las puedes empujar caminando.', muestra: 'teclaE' },
        { t: 'Al portal de su color suma; al equivocado, resta. Entre más chica la esfera, más vale.', accion: 'Senalar', mirar: 'portal' },
        { t: 'Mete varias seguidas y multiplicas: ×2, ×3, hasta ×4. Si fallas, se rompe la racha.', cara: 'feliz', muestra: 'racha' },
        { t: 'A veces sale una esfera dorada que brinca y se escapa. Esa vale 500.', cara: 'sorpresa', muestra: 'dorada' },
        { t: 'Lo demás, la fiebre, los portales en llamas y las carambolas, te lo grito mientras juegas.', accion: 'Risa', cara: 'carcajada' },
        { t: 'Y nada de arrastrarlas con el mouse: M.A.D.R.E. lo ve todo, y a la tercera te parte un rayo.', cara: 'furia' },
      ],
      premios: [
        { t: 'Dos boletos de descuento para la tienda.', accion: 'Presumir', cara: 'feliz', muestra: 'boletos' },
        { t: `Con ${s} puntos en una partida, el plateado: ${silver.pct || 10} % en una compra. Ese no se acaba.`, muestra: 'plateado' },
        { t: `Con ${g}, el dorado: ${gold.pct || 35} %. De esos M.A.D.R.E. solo me deja repartir ${cap} al mes.`, cara: 'sospecha', muestra: 'dorado' },
        ...(sinConteo ? [] : [agotados
          ? { t: `Este mes ya se acabaron; el ${fecha(resetsAt, lang) || '1'} llegan más. Mientras, ${g} te dan el plateado.`, cara: 'encoge', muestra: 'stock' }
          : { t: `Quedan ${quedan}.`, cara: 'sospecha', muestra: 'stock' }]),
        { t: 'Es uno por cuenta al mes. Juega con tu sesión iniciada, o inicia sesión al terminar para reclamarlo.' },
        { t: `¿Ya tienes el plateado sin usar? Haz ${g} y te lo cambio por el dorado.`, cara: 'feliz', muestra: 'dorado' },
        { t: 'Se aplica solito en tu carrito, en una compra.', accion: 'Trato', cara: 'feliz' },
      ],
      // al aceptar, M.A.D.R.E. llega junto a Argus (DroneNPC, modo juego) y apaga los portales
      jugar: [
        { t: '¡Eso! Que empiece el show.', accion: 'Celebrar', cara: 'carcajada' },
        { quien: 'madre', t: dialogoMadre(lang).juego.empieza, cara: 'feliz' },
      ],
      adios: [{ t: 'Tú te lo pierdes. Aquí voy a estar… botaneando.', accion: 'Encogerse', cara: 'encoge' }],
      continuar: 'Continuar',
      saltar: 'Saltar',
      boleto: { dorado: 'Boleto dorado', plateado: 'Boleto plateado', quedan: `Quedan ${quedan ?? ''} de ${cap}`, agotados: 'Agotados este mes' },
      espacio: 'Espacio',
      segundos: 's',
    }
  }

  const stock = sinConteo
    ? { t: `There are only ${cap} golden ones a month on the whole site, so don't sleep on it.`, cara: 'sospecha', muestra: 'dorado' }
    : agotados
      ? { t: `This month's golden ones are gone; more arrive on ${fecha(resetsAt, lang) || 'the 1st'}. Until then, ${g} gets you the silver one.`, cara: 'encoge', muestra: 'dorado' }
      : { t: `${quedan} of ${cap} left this month. Don't sleep on it.`, cara: 'sospecha', muestra: 'stock' }
  return {
    nombre: 'Argus',
    trato: [
      { t: "Hey, buddy! I'm Argus, the keeper of this place.", accion: 'Saludo', cara: 'feliz' },
      { t: 'No clue where these weird spheres come from… but sprinkle a little salt on them and they taste delicious.', cara: 'sospecha' },
      { t: "Here's the deal: shove as many as you can into the portals to teleport them to my hou— um… into the void.", accion: 'Trato', cara: 'sospecha' },
      { t: 'Each one into the portal of its own color. You get 60 seconds, and every hit buys you more time.', accion: 'Senalar', mirar: 'portal', muestra: 'reloj' },
      { t: `In exchange, I'll ask M.A.D.R.E. for a discount: score ${g} points and the golden ticket is yours, ${gold.pct || 35}% off at the store.`, accion: 'Presumir', cara: 'feliz', muestra: 'dorado' },
      stock,
    ],
    otraVez: [
      { t: "Back again? These spheres won't score themselves.", accion: 'Saludo', cara: 'feliz' },
    ],
    pregunta: 'Deal?',
    preguntaOtra: 'So? Deal?',
    opciones: {
      jugar: "Deal! Let's play",
      como: 'How do I play?',
      premios: 'What do I win?',
      adios: 'Not now',
    },
    como: tactil ? [
      { t: 'Easy. Walk up to a sphere and hold the kick button to charge it.', muestra: 'botonPatada' },
      { t: "Aim with the joystick: the line on the floor shows where it'll land and how far it'll roll.", muestra: 'joystick' },
      { t: 'Let go and boom! If it hits another one, it passes the hit along, like pool.', accion: 'Impresionado', cara: 'sorpresa' },
      { t: 'The bolt button throws a fireball that knocks around the spheres near where it lands. You can also push them by walking.', muestra: 'botonRayo' },
      { t: 'The right color scores; the wrong one takes points away. The smaller the sphere, the more it’s worth.', accion: 'Senalar', mirar: 'portal' },
      { t: 'Score a few in a row and it multiplies: ×2, ×3, up to ×4. Miss and the streak breaks.', cara: 'feliz', muestra: 'racha' },
      { t: "Now and then a golden sphere shows up, hopping and running away. That one's worth 500.", cara: 'sorpresa', muestra: 'dorada' },
      { t: "The rest, fever, burning portals and caroms, I'll yell at you while you play.", accion: 'Risa', cara: 'carcajada' },
      { t: 'And no dragging them with your finger: M.A.D.R.E. sees everything, and on the third strike she drops a bolt on you.', cara: 'furia' },
    ] : [
      { t: 'Easy. Walk up to a sphere and hold Space to charge the kick.', muestra: 'espacio' },
      { t: "Aim with your mouse: the line on the floor shows where it'll land and how far it'll roll.", muestra: 'raton' },
      { t: 'Let go and boom! If it hits another one, it passes the hit along, like pool.', accion: 'Impresionado', cara: 'sorpresa' },
      { t: 'E throws a fireball that knocks around the spheres near where it lands. You can also push them by walking.', muestra: 'teclaE' },
      { t: 'The right color scores; the wrong one takes points away. The smaller the sphere, the more it’s worth.', accion: 'Senalar', mirar: 'portal' },
      { t: 'Score a few in a row and it multiplies: ×2, ×3, up to ×4. Miss and the streak breaks.', cara: 'feliz', muestra: 'racha' },
      { t: "Now and then a golden sphere shows up, hopping and running away. That one's worth 500.", cara: 'sorpresa', muestra: 'dorada' },
      { t: "The rest, fever, burning portals and caroms, I'll yell at you while you play.", accion: 'Risa', cara: 'carcajada' },
      { t: 'And no dragging them with the mouse: M.A.D.R.E. sees everything, and on the third strike she drops a bolt on you.', cara: 'furia' },
    ],
    premios: [
      { t: 'Two discount tickets for the store.', accion: 'Presumir', cara: 'feliz', muestra: 'boletos' },
      { t: `Score ${s} in one game for the silver one: ${silver.pct || 10}% off one order. That one never runs out.`, muestra: 'plateado' },
      { t: `Score ${g} for the golden one: ${gold.pct || 35}%. M.A.D.R.E. only lets me hand out ${cap} of those a month.`, cara: 'sospecha', muestra: 'dorado' },
      ...(sinConteo ? [] : [agotados
        ? { t: `They're gone this month; more arrive on ${fecha(resetsAt, lang) || 'the 1st'}. Until then, ${g} gets you the silver one.`, cara: 'encoge', muestra: 'stock' }
        : { t: `${quedan} left.`, cara: 'sospecha', muestra: 'stock' }]),
      { t: "It's one per account a month. Play logged in, or log in when the game ends to claim it.", },
      { t: `Got an unused silver one? Score ${g} and I'll swap it for the golden one.`, cara: 'feliz', muestra: 'dorado' },
      { t: 'It applies itself in your cart, on one order.', accion: 'Trato', cara: 'feliz' },
    ],
    jugar: [
      { t: "That's it! Let the show begin.", accion: 'Celebrar', cara: 'carcajada' },
      { quien: 'madre', t: dialogoMadre(lang).juego.empieza, cara: 'feliz' },
    ],
    adios: [{ t: "Your loss. I'll be right here… snacking.", accion: 'Encogerse', cara: 'encoge' }],
    continuar: 'Continue',
    saltar: 'Skip',
    boleto: { dorado: 'Golden ticket', plateado: 'Silver ticket', quedan: `${quedan ?? ''} of ${cap} left`, agotados: 'Gone this month' },
    espacio: 'Space',
    segundos: 's',
  }
}
