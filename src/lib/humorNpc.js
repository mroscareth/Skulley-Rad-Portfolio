// El humor de los NPC de la home (Oscar, 2026-11-23: "que a veces se moleste si
// le haces mucho click o hablas con ella y la cortas seguido"; luego, que Argus
// también). Lo usan M.A.D.R.E. (lib/droneNpc.js) y Argus (lib/argusNpc.js), cada
// uno con su propio `crearHumor()`. Sin three: App y los diálogos van en el chunk
// de entrada.
//
// Dos cuentas que se van solas con el tiempo (vida media `vidaS`): `cortes` sube si
// lo dejas hablando solo (Esc a media frase) o te vas del menú sin despedirte;
// `molestia` sube con eso y además cada vez que le hablas, más si le vuelves a
// hablar recién despedido. Al saludar: con `cortes` pasado `regano` te regaña; con
// `molestia` pasado `enojo` no te habla `enojadoS` segundos y picarlo lo alarga.
// Después, la primera charla es de perdón. Vive en memoria: una recarga lo contenta.
// Picarlo de lejos (Argus, que solo habla con Skulley cerca) suma `lejos`.
// Medido en Node: tres cortadas seguidas, unas 6 aperturas seguidas o unos 7
// piquetes de lejos lo enojan; una cortada ya da regaño.
export const HUMOR = {
  abrir: 0.35, seguido: 0.45, cortada: 0.6, sinAdios: 0.4, adios: -0.1, lejos: 0.5,
  vidaS: 75, regano: 0.5, enojo: 3.2,
  enojadoS: 12, insisteS: 3, enojadoMaxS: 25,
  seguidoS: 25,
}

const ahoraS = () => performance.now() / 1000

export function crearHumor() {
  const a = {
    molestia: 0,
    cortes: 0,
    t: 0,
    enojadoHasta: 0,
    insiste: 0,
    perdon: false,
    cerro: 0,          // cuándo terminó la última charla
    fueraDesde: 0,     // Skulley salió de la home a una sección
    volvio: 0,         // regresó de una sección
    fueraS: 0,         // cuánto estuvo fuera
    saludo: null,      // lo que toca decir al abrir: { tipo, seg, ...extra }
    recomendo: null,   // M.A.D.R.E.: el proyecto que acaba de recomendar { slug, titulo, hasta }
  }
  const decae = (ahora) => {
    if (a.t) {
      const k = 0.5 ** ((ahora - a.t) / HUMOR.vidaS)
      a.molestia *= k
      a.cortes *= k
    }
    a.t = ahora
  }
  return {
    estado: a,
    enojado: () => ahoraS() < a.enojadoHasta,
    // Al picarlo. { tipo: 'charla' } abre su escena (y deja en `saludo` qué saludo
    // toca); 'rechazo' (con `por`: 'cortes' o 'clics') e 'insiste' (con `n`) no la
    // abren: lo dice en su viñeta.
    picar() {
      const ahora = ahoraS()
      decae(ahora)
      if (ahora < a.enojadoHasta) {
        a.insiste += 1
        a.enojadoHasta = Math.min(a.enojadoHasta + HUMOR.insisteS, ahora + HUMOR.enojadoMaxS)
        return { tipo: 'insiste', n: a.insiste }
      }
      const desdeCerro = a.cerro ? ahora - a.cerro : 0
      const seguido = a.cerro && desdeCerro < HUMOR.seguidoS
      a.molestia += HUMOR.abrir + (seguido ? HUMOR.seguido : 0)
      if (a.molestia >= HUMOR.enojo) {
        const por = a.cortes >= HUMOR.regano ? 'cortes' : 'clics'
        a.enojadoHasta = ahora + HUMOR.enojadoS
        a.insiste = 0
        a.perdon = true
        a.molestia = HUMOR.enojo * 0.4
        a.cortes = 0
        a.recomendo = null
        return { tipo: 'rechazo', por }
      }
      let saludo = { tipo: 'normal', seg: desdeCerro }
      if (a.perdon) { saludo.tipo = 'perdon'; a.perdon = false }
      else if (a.recomendo && ahora < a.recomendo.hasta) saludo = { tipo: 'proyecto', seg: desdeCerro, proyecto: a.recomendo }
      else if (a.cortes >= HUMOR.regano) saludo.tipo = 'regano'
      else if (a.volvio > a.cerro && a.fueraS > 0) saludo = { tipo: 'vuelta', seg: a.fueraS }
      else if (seguido) saludo.tipo = 'seguido'
      a.recomendo = null
      a.saludo = saludo
      return { tipo: 'charla' }
    },
    // Lo picaron de lejos, donde no puede hablar: { tipo: 'lejos' }, o 'rechazo' /
    // 'insiste' si ya se hartó.
    picarLejos() {
      const ahora = ahoraS()
      decae(ahora)
      if (ahora < a.enojadoHasta) {
        a.insiste += 1
        a.enojadoHasta = Math.min(a.enojadoHasta + HUMOR.insisteS, ahora + HUMOR.enojadoMaxS)
        return { tipo: 'insiste', n: a.insiste }
      }
      a.molestia += HUMOR.lejos
      if (a.molestia >= HUMOR.enojo) {
        a.enojadoHasta = ahora + HUMOR.enojadoS
        a.insiste = 0
        a.perdon = true
        a.molestia = HUMOR.enojo * 0.4
        a.cortes = 0
        return { tipo: 'rechazo', por: 'clics' }
      }
      return { tipo: 'lejos' }
    },
    // La escena lo toma al empezar (una vez).
    tomarSaludo() {
      const s = a.saludo || { tipo: 'normal', seg: a.cerro ? ahoraS() - a.cerro : 0 }
      a.saludo = null
      return s
    },
    // Al cerrar la escena: 'cortada' | 'sinAdios' | 'adios' (null: no cuenta).
    cerrar(como) {
      const ahora = ahoraS()
      decae(ahora)
      if (como && HUMOR[como] !== undefined) a.molestia = Math.max(0, a.molestia + HUMOR[como])
      if (como === 'cortada' || como === 'sinAdios') a.cortes += HUMOR[como]
      a.cerro = ahora
    },
    // Skulley sale de la home y regresa (con `activo` del NPC).
    salio() { a.fueraDesde = ahoraS() },
    volvio() {
      if (!a.fueraDesde) return 0
      a.volvio = ahoraS()
      a.fueraS = a.volvio - a.fueraDesde
      a.fueraDesde = 0
      return a.fueraS
    },
  }
}
