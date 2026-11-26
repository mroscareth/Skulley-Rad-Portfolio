// Lo que dice Argus en su escena del trato (components/ZoidianDialog.jsx).
// Es el que cuida la plaza y el dueño del juego de esferas: buscavidas, de
// "compa", se come las esferas con sal y limón y se le sale que las manda a su
// casa. Habla como cualquier cuate de aquí (Oscar, 2026-11-23: "más humanos,
// español mexicano, sin wording AI o extraño"). Lo que promete es lo que el juego
// hace hoy (lib/juegoEsferas.js, game-tickets.php): si cambia un número del juego,
// cambia aquí.
//
// Cada renglón: { t, accion?, cara?, mirar?, muestra?, quien? }. `quien: 'madre'`
// lo dice M.A.D.R.E. (su nombre en el globo, su bip y la cara del drone).
// accion, cara y mirar se le piden a Argus al empezar el renglón
// (lib/argusNpc.js); mirar 'portal' es el portal más cercano a él (lo resuelve el
// diálogo). muestra: lo que sale en pantalla junto al globo (el boleto, las
// teclas…), en ZoidianDialog.
//
// El saludo de las siguientes veces sale de lo que recuerda (`memoria`, en
// lib/argusNpc.js): si le dijiste "Ahora no" o cuánto hiciste en tu última
// partida. `semilla` (fija mientras dura la escena) escoge entre las variantes:
// el guion se vuelve a armar cuando llega el conteo de dorados y no debe cambiar
// el renglón a media lectura.

import { dialogoMadre } from './dialogoMadre.js'

const num = (n, lang) => Number(n || 0).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')

function fecha(iso, lang) {
  if (!iso) return ''
  const [y, m] = String(iso).split('-').map(Number)
  if (!y || !m) return ''
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { day: 'numeric', month: 'long' })
}

// `humor` (lib/humorNpc.js, lo toma ZoidianDialog al abrir): 'regano' si lo
// dejaste hablando solo hace poco y 'perdon' la primera vez después de no hablarte;
// mandan sobre el saludo de la memoria.
//
// `datos`: { gold, silver, resetsAt, tactil, memoria, semilla, humor }. gold y silver
// traen score y pct; gold además left_this_month y monthly_cap (sin conteo, undefined).
export function dialogoArgus(lang, datos) {
  const { gold = {}, silver = {}, resetsAt = null, tactil = false, memoria = null, semilla = 0, humor = null } = datos || {}
  const es = lang === 'es'
  const g = num(gold.score, lang)
  const s = num(silver.score, lang)
  const cap = gold.monthly_cap || 10
  const quedan = gold.left_this_month
  const sinConteo = quedan === undefined || quedan === null
  const agotados = !sinConteo && quedan <= 0
  const gPct = gold.pct || 35
  const sPct = silver.pct || 10
  // de una lista, la que toque con la semilla (`k` separa listas distintas)
  const una = (lista, k = 0) => lista[Math.floor(((semilla + k * 0.618) % 1) * lista.length)] || lista[0]
  // cómo le fue la última vez: 'oro' | 'plata' | 'negativo' | 'poco' | null
  const p = memoria?.ultimo === 'jugo' && Number.isFinite(memoria.puntos) ? memoria.puntos : null
  const pTxt = num(p, lang)
  const nivel = p === null ? null
    : p >= (gold.score || 6000) ? 'oro'
      : p >= (silver.score || 1500) ? 'plata'
        : p < 0 ? 'negativo' : 'poco'
  const saludo = (linea) => [{ accion: 'Saludo', cara: 'feliz', ...linea }]

  if (es) {
    const stock = sinConteo
      ? { t: `Nomás hay ${cap} dorados al mes para todo el sitio, así que no te duermas.`, cara: 'sospecha', muestra: 'dorado' }
      : agotados
        ? { t: `Este mes ya se acabaron los dorados; el ${fecha(resetsAt, lang) || '1'} llegan más. Mientras, con ${g} te llevas el plateado.`, cara: 'encoge', muestra: 'dorado' }
        : { t: `Quedan ${quedan} de ${cap} este mes. Aguas, que vuelan.`, cara: 'sospecha', muestra: 'stock' }
    const otraVez = humor === 'regano' ? saludo(una([
      { t: '¿Ahora sí me vas a escuchar, compa? La otra vez me dejaste hablando solo.', cara: 'sospecha' },
      { t: 'Ey, la otra vez me cortaste a media frase. Aquí se escucha completo, ¿eh?', cara: 'furia' },
      { t: 'Mira, yo te explico con gusto, pero no me dejes hablando solo.', cara: 'aburrido' },
    ], 2))
      : humor === 'perdon' ? saludo(una([
        { t: 'Ya se me pasó, compa. ¿Qué onda, le entramos?' },
        { t: 'Bueno, ya. Borrón y cuenta nueva. ¿Trato?' },
      ], 2))
      : nivel === 'oro' ? saludo({ t: `¡El campeón! La otra vez hiciste ${pTxt} puntos. ¿Vienes por más?`, cara: 'carcajada' })
      : nivel === 'plata' ? saludo({ t: `¡Quiúbole! ${pTxt} puntos la otra vez, nada mal. ¿Le subimos?` })
        : nivel === 'negativo' ? saludo({ t: 'La otra vez terminaste en negativo, compa. Eso no lo había visto nunca. ¿La revancha?', cara: 'sorpresa' })
          : nivel === 'poco' ? saludo(una([
            { t: `¿La revancha? La otra vez hiciste ${pTxt} puntos. Yo sé que das para más.` },
            { t: `${pTxt} puntos la otra vez… Échale ganas, compa, tú puedes.`, cara: 'sospecha' },
          ]))
            : memoria?.ultimo === 'adios' ? saludo(una([
              { t: '¿Qué pasó? ¿Ya lo pensaste?', cara: 'sospecha' },
              { t: '¡Volviste! ¿Ahora sí le entras?' },
              { t: '¿Ya te animaste o nomás vienes a saludar?', cara: 'sospecha' },
            ]))
              : saludo(una([
                { t: '¿Otra vez por aquí? Las esferas no se van a meter solas.' },
                { t: '¡Quiúbole, compa! Ya me andaba dando hambre.', cara: 'sospecha' },
                { t: '¡Mi compa! ¿Ahora sí le entramos?' },
              ]))
    return {
      nombre: 'Argus',
      trato: [
        { t: '¡Quiúbole, compa! Soy Argus, el que cuida este lugar.', accion: 'Saludo', cara: 'feliz' },
        { t: 'No sé de dónde salen estas esferas tan raras… pero con sal y limón saben bien buenas.', cara: 'sospecha' },
        { t: 'Te propongo un trato: tú las metes en los portales y se van derechito a mi cas… digo, al vacío.', accion: 'Trato', cara: 'sospecha' },
        { t: 'Cada una va al portal de su color. Tienes 60 segundos, y cada vez que le atinas te ganas más tiempo.', accion: 'Senalar', mirar: 'portal', muestra: 'reloj' },
        { t: `Y yo te consigo un descuento con M.A.D.R.E.: si haces ${g} puntos, te llevas el boleto dorado. ${gPct} % en la tienda.`, accion: 'Presumir', cara: 'feliz', muestra: 'dorado' },
        stock,
      ],
      otraVez,
      pregunta: '¿Trato?',
      preguntaOtra: '¿Entonces qué? ¿Le entras?',
      opciones: {
        jugar: '¡Trato! A jugar',
        como: '¿Cómo se juega?',
        premios: '¿Qué me gano?',
        cosas: '¿Tienes algo de Skulley?',
        adios: 'Ahora no',
      },
      // Las cosas de Skulley que tiene él (lib/misionesOfrenda.js; textos de Oscar del 2026-11-26): se las
      // robó a M.A.D.R.E. antes de que las vendiera en la tienda, porque le gustaron, pero no les halla el uso
      // (él también es creación de ella). Cree que ella no se dio cuenta; ella sí sabe (dialogoMadre.js,
      // cosas). De una en una, con la condición clara. La entrega usa `zoidian.ofrenda.<id>`
      // (LanguageContext), igual que en su globo.
      cosas: {
        intro: [
          { t: '¿Cosas de Skulley? Shhh, compa, no tan fuerte.', accion: 'Encogerse', cara: 'sospecha' },
          { t: 'Te cuento, pero no le digas a M.A.D.R.E.: dos cositas se las volé antes de que las pusiera a la venta en la tienda.', cara: 'sospecha' },
          { t: 'Me gustaron un chorro, nomás que no les hallo el uso. Será cosa de humanos.', accion: 'Encogerse', cara: 'encoge' },
          { t: 'Ella dice que quiere traer a Skulley del más allá con una ofrenda. Yo no creo en eso, pero si a ti te sirven, te las paso.', cara: 'neutral' },
          { t: 'Eso sí, aquí todo es trato. Y ni una palabra a la jefa, ¿eh?', accion: 'Trato', cara: 'sospecha' },
        ],
        pistas: {
          cerillos: [
            { t: 'Primero, sus cerillos. Se los regaló su novia y nomás prendió uno. ¿Para qué guardas cerillos si no los prendes? Ni idea.', accion: 'Presumir', cara: 'feliz' },
            { t: 'Te los paso cuando me enseñes que no le tienes miedo a la lumbre.', cara: 'sospecha' },
            { t: 'Quémame unos 30 de esos pétalos naranjas que hay por el camino, con tu bola de fuego. Tranquilo, vuelven a salir solos.', accion: 'Senalar', cara: 'sospecha' },
          ],
          almohada: [
            { t: 'Lo último que tengo es su almohada. Decía que ahí se le ocurrían sus mejores ideas. Yo la probé y nomás me dio sueño.', cara: 'feliz' },
            { t: 'Esa sí te la cobro caro: mil puntos en una sola partida de las esferas. Ni uno menos.', accion: 'Trato', cara: 'sospecha' },
            { t: 'Y no me veas así, que yo no hago las reglas. Bueno, sí. Pero esta me gusta.', accion: 'Risa', cara: 'carcajada' },
          ],
        },
        recuerda: 'Aquí sigo escondiendo {cosa}, compa. Te repito el trato.',
        cosa: { cerillos: 'los cerillos', almohada: 'la almohada' },
        fin: [{ t: 'Ya te di lo que le volé… digo, lo que rescaté. Lo demás lo tiene M.A.D.R.E.: pregúntale qué dejó Skulley.', cara: 'feliz', accion: 'Presumir' }],
        // las palabras de Oscar (2026-11-26)
        finTodo: [
          { t: 'Ya te di todos los objetos, compa, y ya me regañaron por robar…', cara: 'encoge', accion: 'Encogerse' },
          { t: 'Pero vuelve de vez en cuando para ganar premios en mi juego y comprar cosas en la tiendita.', cara: 'feliz', accion: 'Presumir' },
        ],
      },
      como: [
        tactil
          ? { t: 'Fácil. Acércate a una esfera y deja apretado el botón de la patada para cargarla.', muestra: 'botonPatada' }
          : { t: 'Fácil. Acércate a una esfera y deja apretado Espacio para cargar la patada.', muestra: 'espacio' },
        tactil
          ? { t: 'Apunta con el joystick. La línea en el piso te dice dónde va a caer y cuánto va a rodar.', muestra: 'joystick' }
          : { t: 'Apunta con el mouse. La línea en el piso te dice dónde va a caer y cuánto va a rodar.', muestra: 'raton' },
        { t: 'Suelta y ¡pum! Si le pega a otra, le pasa el golpe, como en el billar.', accion: 'Impresionado', cara: 'sorpresa' },
        tactil
          ? { t: 'Con el botón del rayo avientas una bola de fuego que manda a volar las esferas que estén cerca. También las puedes empujar caminando.', muestra: 'botonRayo' }
          : { t: 'Con la E avientas una bola de fuego que manda a volar las esferas que estén cerca. También las puedes empujar caminando.', muestra: 'teclaE' },
        { t: 'Si la metes en el portal de su color, sumas. Si te equivocas de portal, te resta. Entre más chiquita la esfera, más vale.', accion: 'Senalar', mirar: 'portal' },
        { t: 'Si metes varias seguidas, se multiplica: ×2, ×3, hasta ×4. Pero si fallas, se te cae la racha.', cara: 'feliz', muestra: 'racha' },
        { t: 'Y de repente sale una dorada que brinca y se te escapa. Esa vale 500.', cara: 'sorpresa', muestra: 'dorada' },
        { t: 'Lo demás, la fiebre, los portales en llamas y las carambolas, te lo voy gritando mientras juegas.', accion: 'Risa', cara: 'carcajada' },
        { t: `Y nada de arrastrarlas con ${tactil ? 'el dedo' : 'el mouse'}, ¿eh? M.A.D.R.E. lo ve todo, y a la tercera te cae un rayo.`, cara: 'furia' },
      ],
      premios: [
        { t: 'Hay dos boletos de descuento para la tienda.', accion: 'Presumir', cara: 'feliz', muestra: 'boletos' },
        { t: `Si haces ${s} puntos en una partida, te llevas el plateado: ${sPct} % en una compra. Ese nunca se acaba.`, muestra: 'plateado' },
        { t: `Con ${g}, el dorado: ${gPct} %. Pero de esos M.A.D.R.E. nomás me deja repartir ${cap} al mes.`, cara: 'sospecha', muestra: 'dorado' },
        ...(sinConteo ? [] : [agotados
          ? { t: `Este mes ya se acabaron; el ${fecha(resetsAt, lang) || '1'} llegan más. Mientras, con ${g} te llevas el plateado.`, cara: 'encoge', muestra: 'stock' }
          : { t: `Ahorita quedan ${quedan}.`, cara: 'sospecha', muestra: 'stock' }]),
        { t: 'Es uno por cuenta cada mes. Juega con tu sesión iniciada o, si no, inicia sesión al terminar y lo reclamas.' },
        { t: `¿Ya tienes el plateado y no lo has usado? Haz ${g} y te lo cambio por el dorado.`, cara: 'feliz', muestra: 'dorado' },
        { t: 'Y se aplica solito en tu carrito. Sirve para una compra.', accion: 'Trato', cara: 'feliz' },
      ],
      // al aceptar, M.A.D.R.E. llega junto a Argus (DroneNPC, modo juego) y apaga los portales
      jugar: [
        { t: '¡Eso! Que empiece el show.', accion: 'Celebrar', cara: 'carcajada' },
        { quien: 'madre', t: dialogoMadre(lang).juego.empieza, cara: 'feliz' },
      ],
      adios: [una([
        { t: 'Tú te lo pierdes. Aquí voy a estar… botaneando.', accion: 'Encogerse', cara: 'encoge' },
        { t: 'Va, al rato. Te guardo unas esferas… si no me las como antes.', accion: 'Encogerse', cara: 'sospecha' },
        { t: 'Sale, aquí te espero. Total, yo de aquí no me muevo.', accion: 'Encogerse', cara: 'encoge' },
      ], 1)],
      continuar: 'Continuar',
      saltar: 'Saltar',
      boleto: { dorado: 'Boleto dorado', plateado: 'Boleto plateado', quedan: `Quedan ${quedan ?? ''} de ${cap}`, agotados: 'Agotados este mes' },
      espacio: 'Espacio',
      segundos: 's',
    }
  }

  const stock = sinConteo
    ? { t: `There are only ${cap} golden ones a month for the whole site, so don't sleep on it.`, cara: 'sospecha', muestra: 'dorado' }
    : agotados
      ? { t: `The golden ones are gone this month; more arrive on ${fecha(resetsAt, lang) || 'the 1st'}. Until then, ${g} gets you the silver one.`, cara: 'encoge', muestra: 'dorado' }
      : { t: `${quedan} of ${cap} left this month. They go fast.`, cara: 'sospecha', muestra: 'stock' }
  const otraVez = humor === 'regano' ? saludo(una([
    { t: "So now you'll listen, buddy? Last time you left me talking to myself.", cara: 'sospecha' },
    { t: 'Hey, last time you cut me off mid-sentence. Around here we listen to the end, okay?', cara: 'furia' },
    { t: "Look, I'm happy to explain, but don't leave me hanging.", cara: 'aburrido' },
  ], 2))
    : humor === 'perdon' ? saludo(una([
      { t: "I'm over it, buddy. So, are we doing this?" },
      { t: 'Okay, clean slate. Deal?' },
    ], 2))
    : nivel === 'oro' ? saludo({ t: `The champ! You scored ${pTxt} last time. Back for more?`, cara: 'carcajada' })
    : nivel === 'plata' ? saludo({ t: `Hey! ${pTxt} points last time, not bad. Shall we go higher?` })
      : nivel === 'negativo' ? saludo({ t: 'Last time you ended up in the negatives, buddy. Never seen that before. Rematch?', cara: 'sorpresa' })
        : nivel === 'poco' ? saludo(una([
          { t: `Rematch? You scored ${pTxt} last time. I know you've got more in you.` },
          { t: `${pTxt} points last time… Come on, buddy, you can do better.`, cara: 'sospecha' },
        ]))
          : memoria?.ultimo === 'adios' ? saludo(una([
            { t: 'So? Did you think it over?', cara: 'sospecha' },
            { t: "You're back! Are you in this time?" },
            { t: 'Ready to play, or just here to say hi?', cara: 'sospecha' },
          ]))
            : saludo(una([
              { t: "Back again? These spheres won't score themselves." },
              { t: 'Hey, buddy! I was getting hungry.', cara: 'sospecha' },
              { t: 'My buddy! Are we doing this?' },
            ]))
  return {
    nombre: 'Argus',
    trato: [
      { t: "Hey there, buddy! I'm Argus. I look after this place.", accion: 'Saludo', cara: 'feliz' },
      { t: 'No clue where these weird spheres come from… but with a little salt and lime they taste amazing.', cara: 'sospecha' },
      { t: "Here's the deal: you kick them into the portals and they go straight to my hou— I mean, into the void.", accion: 'Trato', cara: 'sospecha' },
      { t: 'Each one goes into the portal of its color. You get 60 seconds, and every time you score you get more time.', accion: 'Senalar', mirar: 'portal', muestra: 'reloj' },
      { t: `And I'll get you a discount from M.A.D.R.E.: score ${g} points and the golden ticket is yours. ${gPct}% off at the store.`, accion: 'Presumir', cara: 'feliz', muestra: 'dorado' },
      stock,
    ],
    otraVez,
    pregunta: 'Deal?',
    preguntaOtra: 'So? Are you in?',
    opciones: {
      jugar: "Deal! Let's play",
      como: 'How do I play?',
      premios: 'What do I win?',
      cosas: 'Got anything of Skulley’s?',
      adios: 'Not now',
    },
    cosas: {
      intro: [
        { t: 'Skulley’s stuff? Shhh, buddy, not so loud.', accion: 'Encogerse', cara: 'sospecha' },
        { t: 'I’ll tell you, but don’t tell M.A.D.R.E.: I swiped two little things before she put them up for sale in the store.', cara: 'sospecha' },
        { t: 'I liked them a whole lot, I just can’t figure out what they’re for. Must be a human thing.', accion: 'Encogerse', cara: 'encoge' },
        { t: 'She says she wants to bring Skulley back from the beyond with an ofrenda. I don’t believe in that stuff, but if they’re any use to you, they’re yours.', cara: 'neutral' },
        { t: 'But around here, everything’s a deal. And not a word to the boss lady, okay?', accion: 'Trato', cara: 'sospecha' },
      ],
      pistas: {
        cerillos: [
          { t: 'First, his matches. His girlfriend gave them to him and he only ever lit one. Why keep matches if you don’t light them? No clue.', accion: 'Presumir', cara: 'feliz' },
          { t: 'I’ll hand them over once you show me you’re not scared of fire.', cara: 'sospecha' },
          { t: 'Torch about 30 of those orange petals along the path with your fireball. Relax, they grow back on their own.', accion: 'Senalar', cara: 'sospecha' },
        ],
        almohada: [
          { t: 'The last thing I’ve got is his pillow. He used to say his best ideas came to him on it. I tried it and it just made me sleepy.', cara: 'feliz' },
          { t: 'That one’ll cost you: a thousand points in a single game of spheres. Not one less.', accion: 'Trato', cara: 'sospecha' },
          { t: 'Don’t look at me like that, I don’t make the rules. Well, I do. But I like this one.', accion: 'Risa', cara: 'carcajada' },
        ],
      },
      recuerda: 'Still hiding {cosa} over here, buddy. Here’s the deal again.',
      cosa: { cerillos: 'the matches', almohada: 'the pillow' },
      fin: [{ t: 'I’ve given you what I swiped… I mean, what I rescued. M.A.D.R.E. has the rest: ask her what Skulley left behind.', cara: 'feliz', accion: 'Presumir' }],
      finTodo: [
        { t: 'I already gave you all the objects, buddy, and I already got scolded for stealing…', cara: 'encoge', accion: 'Encogerse' },
        { t: 'But come back every now and then to win prizes in my game and buy stuff at the shop.', cara: 'feliz', accion: 'Presumir' },
      ],
    },
    como: [
      tactil
        ? { t: 'Easy. Walk up to a sphere and hold the kick button to charge it.', muestra: 'botonPatada' }
        : { t: 'Easy. Walk up to a sphere and hold Space to charge your kick.', muestra: 'espacio' },
      tactil
        ? { t: "Aim with the joystick. The line on the floor shows where it'll land and how far it'll roll.", muestra: 'joystick' }
        : { t: "Aim with your mouse. The line on the floor shows where it'll land and how far it'll roll.", muestra: 'raton' },
      { t: 'Let go and boom! If it hits another one, it passes the hit along, like pool.', accion: 'Impresionado', cara: 'sorpresa' },
      tactil
        ? { t: 'The bolt button throws a fireball that sends nearby spheres flying. You can also push them by walking.', muestra: 'botonRayo' }
        : { t: 'E throws a fireball that sends nearby spheres flying. You can also push them by walking.', muestra: 'teclaE' },
      { t: 'Get it in the portal of its color and you score. Wrong portal and you lose points. The smaller the sphere, the more it’s worth.', accion: 'Senalar', mirar: 'portal' },
      { t: 'Score a few in a row and it multiplies: ×2, ×3, up to ×4. Miss and there goes your streak.', cara: 'feliz', muestra: 'racha' },
      { t: "And every now and then a golden one shows up, hopping away from you. That one's worth 500.", cara: 'sorpresa', muestra: 'dorada' },
      { t: "The rest, fever, burning portals and caroms, I'll yell at you while you play.", accion: 'Risa', cara: 'carcajada' },
      { t: `And no dragging them with ${tactil ? 'your finger' : 'the mouse'}, okay? M.A.D.R.E. sees everything, and on the third time a bolt comes down on you.`, cara: 'furia' },
    ],
    premios: [
      { t: 'There are two discount tickets for the store.', accion: 'Presumir', cara: 'feliz', muestra: 'boletos' },
      { t: `Score ${s} in one game and the silver one is yours: ${sPct}% off one order. That one never runs out.`, muestra: 'plateado' },
      { t: `Score ${g} for the golden one: ${gPct}%. But M.A.D.R.E. only lets me hand out ${cap} of those a month.`, cara: 'sospecha', muestra: 'dorado' },
      ...(sinConteo ? [] : [agotados
        ? { t: `They're gone this month; more arrive on ${fecha(resetsAt, lang) || 'the 1st'}. Until then, ${g} gets you the silver one.`, cara: 'encoge', muestra: 'stock' }
        : { t: `${quedan} left right now.`, cara: 'sospecha', muestra: 'stock' }]),
      { t: "It's one per account each month. Play logged in, or log in when the game ends to claim it." },
      { t: `Got a silver one you haven't used? Score ${g} and I'll swap it for the golden one.`, cara: 'feliz', muestra: 'dorado' },
      { t: 'And it applies itself in your cart. It works on one order.', accion: 'Trato', cara: 'feliz' },
    ],
    jugar: [
      { t: "That's it! Let the show begin.", accion: 'Celebrar', cara: 'carcajada' },
      { quien: 'madre', t: dialogoMadre(lang).juego.empieza, cara: 'feliz' },
    ],
    adios: [una([
      { t: "Your loss. I'll be right here… snacking.", accion: 'Encogerse', cara: 'encoge' },
      { t: "Okay, later. I'll save you some spheres… if I don't eat them first.", accion: 'Encogerse', cara: 'sospecha' },
      { t: "Sure, I'll wait. I'm not going anywhere anyway.", accion: 'Encogerse', cara: 'encoge' },
    ], 1)],
    continuar: 'Continue',
    saltar: 'Skip',
    boleto: { dorado: 'Golden ticket', plateado: 'Silver ticket', quedan: `${quedan ?? ''} of ${cap} left`, agotados: 'Gone this month' },
    espacio: 'Space',
    segundos: 's',
  }
}
