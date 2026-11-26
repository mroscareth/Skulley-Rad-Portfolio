// Lo que platican Skulley y M.A.D.R.E. cuando él se acerca a la Renderbox del claro (Oscar, 2026-11-25:
// "la Renderbox fue la primer workstation que compré… en esta computadora he hecho de todo: diseño,
// programación, gaming, modelos de AI locales, películas… siempre me ha molestado el sonido, comparable
// al camión de la basura. El soporte jamás pudo calibrar el software de los abanicos, así que lo tuve que
// hacer con AI: ahí podemos decir que M.A.D.R.E. lo solucionó").
//
// Tono (Oscar): halago, no queja. "No quiero beef con ellos, me encanta mi Renderbox": el ruido es de bestia que
// trabaja y lo de los ventiladores no culpa a nadie (el software de los abanicos ni siquiera es de Renderbox).
//
// La primera vez en la pestaña va la escena completa; después, cada vez que llega (Oscar: "¿no se disparan
// cada que vamos?"), una frase suelta de Skulley sin repetir la anterior, con un respiro (`cadaS`) para
// que dar vueltas junto a ella no la vuelva cantaleta. Apagada (de una patada) dice otra cosa. Cada renglón pide turno (lib/turnoGlobos.js)
// y el siguiente espera a que el anterior termine; un susto (`choque`) la corta. Skulley habla con el
// evento de sus globos (`speech-bubble-override`); M.A.D.R.E., con `avisarDron({ dice })` (DroneNPC), y si
// no puede hablar (en otra escena, enojada, jugando) la escena se acaba ahí. Sin three.

import { hablandoTexto, escucharChoque } from './turnoGlobos.js'
import { avisarDron } from './droneNpc.js'

export const DIALOGO_RENDERBOX = {
  radio: 4.2,        // a qué distancia de la Renderbox (del centro, en unidades) arranca
  cadaS: 20,         // respiro mínimo entre frases sueltas (s); cada llegada dice algo
  esperaInicio: 12,  // cuánto espera a que cada renglón empiece antes de rendirse (s)
}

const GUION = {
  es: {
    escena: [
      { quien: 'skulley', t: 'Mi Renderbox: la primera workstation que compré.' },
      { quien: 'skulley', t: 'Aquí hice de todo: diseño, código, gaming, IA local y maratones de películas.' },
      { quien: 'skulley', t: 'Ruge como camión de la basura… y carga como uno.' },
      { quien: 'madre', t: 'Sus ventiladores pedían otra curva. Él me pidió ayuda y la ajustamos juntos.' },
      { quien: 'skulley', t: 'Desde entonces ruge con estilo.' },
      { quien: 'madre', t: 'Ruge porque trabaja. Igual que él.' },
      // remate (Oscar): "esto no es publicidad pagada… pero si me quieren patrocinar, con gusto"
      { quien: 'madre', t: 'Aviso legal: esto no es publicidad pagada.' },
      { quien: 'skulley', t: '…pero si me quieren patrocinar, con gusto.' },
    ],
    sueltas: [
      'Brrrrr. Ahí viene el camión de la basura.',
      'Diseño, código, juegos y películas. Esta bestia aguanta todo.',
      'Mi primera workstation. Ruidosa, pero mía.',
      'Esto no es publicidad pagada.',
      'Aquí rendericé más horas de las que dormí.',
      'Si las paredes hablaran… esta diría "brrrrr".',
      'Diseño de día, gaming de noche. Ella nunca se quejó.',
      'Aquí corrí mis primeros modelos de IA. Ni se inmutó.',
      'En invierno me calienta el cuarto. Gratis.',
      'Ruge, pero nunca me ha dejado colgado en una entrega.',
      'Mi copiloto de todas las desveladas.',
      'Película, render y videojuego al mismo tiempo. No es broma.',
      'Le dicen camión de la basura. Yo le digo compañera.',
      'Si suena así es porque está pensando.',
      'Cuando arranca, los vecinos saben que ya empecé a trabajar.',
      'No le toques los ventiladores: ya quedaron perfectos.',
    ],
    apagada: [
      'Shhh. Hasta las bestias descansan.',
      'Shhh. Que duerma tantito.',
      'Ni la patees mucho, que es de la familia.',
    ],
  },
  en: {
    escena: [
      { quien: 'skulley', t: 'My Renderbox: the first workstation I ever bought.' },
      { quien: 'skulley', t: 'I did everything on it: design, code, gaming, local AI and movie marathons.' },
      { quien: 'skulley', t: 'It roars like a garbage truck… and hauls like one too.' },
      { quien: 'madre', t: 'Its fans needed a new curve. He asked me for help and we tuned it together.' },
      { quien: 'skulley', t: 'Now it roars with style.' },
      { quien: 'madre', t: 'It roars because it works. Just like him.' },
      { quien: 'madre', t: 'Legal notice: this is not paid advertising.' },
      { quien: 'skulley', t: '…but if they want to sponsor me, I\'m all yours.' },
    ],
    sueltas: [
      'Brrrrr. Here comes the garbage truck.',
      'Design, code, games and movies. This beast handles it all.',
      'My first workstation. Loud, but mine.',
      'This is not paid advertising.',
      'I\'ve rendered more hours here than I\'ve slept.',
      'If these walls could talk… this one would say "brrrrr".',
      'Design by day, gaming by night. She never complained.',
      'I ran my first AI models here. She didn\'t even flinch.',
      'In winter she heats my room. For free.',
      'She roars, but she\'s never let me down on a deadline.',
      'My copilot for every all-nighter.',
      'Movie, render and video game at the same time. Not kidding.',
      'They call her a garbage truck. I call her partner.',
      'If she sounds like that, it\'s because she\'s thinking.',
      'When she starts up, the neighbors know I\'m working.',
      'Don\'t touch her fans: they\'re perfect now.',
    ],
    apagada: [
      'Shhh. Even beasts need to rest.',
      'Shhh. Let it sleep a little.',
      'Easy on the kicks, she\'s family.',
    ],
  },
}

const LLAVE = 'skulley_renderbox_dialogo'
const st = { corriendo: false, ultimaSuelta: -Infinity, vista: leerVista(), ultima: -1 }
function leerVista() { try { return sessionStorage.getItem(LLAVE) === '1' } catch { return false } }
function marcarVista() { st.vista = true; try { sessionStorage.setItem(LLAVE, '1') } catch { } }

const ahora = () => performance.now() / 1000

function decirRenglon(quien, texto) {
  if (quien === 'skulley') {
    try { window.dispatchEvent(new CustomEvent('speech-bubble-override', { detail: { text: texto } })) } catch { }
  } else {
    avisarDron({ dice: { texto, acercarse: true } })
  }
}

// Espera a que ese renglón exacto empiece y termine (el mismo personaje puede tener otra frase suya en
// medio). Regresa false si nunca empezó o hubo un susto.
function esperarRenglon(texto, cortado) {
  return new Promise((listo) => {
    const desde = ahora()
    let empezo = false
    const id = setInterval(() => {
      if (cortado()) { clearInterval(id); listo(false); return }
      const h = hablandoTexto()
      if (!empezo) {
        if (h === texto) empezo = true
        else if (ahora() - desde > DIALOGO_RENDERBOX.esperaInicio) { clearInterval(id); listo(false) }
        return
      }
      if (h !== texto) { clearInterval(id); listo(true) }
    }, 100)
  })
}

async function correrEscena(pasos) {
  st.corriendo = true
  let susto = false
  const quitar = escucharChoque(() => { susto = true })
  try {
    for (const paso of pasos) {
      decirRenglon(paso.quien, paso.t)
      const ok = await esperarRenglon(paso.t, () => susto)
      if (!ok) break
    }
  } finally {
    quitar()
    st.corriendo = false
  }
}

/** Skulley llegó junto a la Renderbox. `prendida`: si está encendida. */
export function skulleyJuntoARenderbox({ lang = 'es', prendida = true } = {}) {
  if (st.corriendo) return
  const G = GUION[lang === 'en' ? 'en' : 'es']
  if (!prendida) {
    if (ahora() - st.ultimaSuelta < DIALOGO_RENDERBOX.cadaS) return
    st.ultimaSuelta = ahora()
    correrEscena([{ quien: 'skulley', t: G.apagada[Math.floor(Math.random() * G.apagada.length)] }])
    return
  }
  if (!st.vista) {
    marcarVista()
    st.ultimaSuelta = ahora()
    correrEscena(G.escena)
    return
  }
  if (ahora() - st.ultimaSuelta < DIALOGO_RENDERBOX.cadaS) return
  st.ultimaSuelta = ahora()
  // sin repetir hasta que salgan todas (una bolsa por idioma)
  const clave = lang === 'en' ? 'en' : 'es'
  if (!st.bolsa?.[clave]?.length) {
    st.bolsa = st.bolsa || {}
    st.bolsa[clave] = G.sueltas.map((_, k) => k).sort(() => Math.random() - 0.5)
    if (st.bolsa[clave][0] === st.ultima && st.bolsa[clave].length > 1) st.bolsa[clave].push(st.bolsa[clave].shift())
  }
  const i = st.bolsa[clave].shift()
  st.ultima = i
  correrEscena([{ quien: 'skulley', t: G.sueltas[i] }])
}

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__dialogoRenderbox = {
    st,
    escena: (lang = 'es') => correrEscena(GUION[lang === 'en' ? 'en' : 'es'].escena),
    olvidar() { st.vista = false; st.ultimaSuelta = -Infinity; try { sessionStorage.removeItem(LLAVE) } catch { } },
  }
}
