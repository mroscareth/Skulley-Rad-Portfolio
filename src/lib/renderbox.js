// La Renderbox Nano del Estudio (Oscar, 2026-11-24): prendida zumba como camión de la basura,
// tiembla y giran sus ventiladores; una patada de Skulley la apaga y otra la vuelve a prender
// ("se me ocurre que el usuario la pueda apagar de una patada"). Sin three: la home, el visor y Node
// leen el mismo estado.
//
//   const rb = crearRenderbox()   rb.patear()   rb.paso(dt)   rb.rpm (0–1), rb.boton (0–1)
//
// `rpm` lleva todo lo que gira y zumba (ventiladores, temblor, tono y volumen del motor); `boton` es
// el aro de luz y el brillo azul, que se apagan de golpe con la patada y prenden antes de arrancar.

export const RENDERBOX = {
  frena: 2.6,      // s que tardan los ventiladores en pararse
  arranca: 1.4,    // s que tardan en llegar a todo
  esperaArranque: 0.35, // al prender: primero la luz, luego el motor
  vueltasPorSeg: 9, // a todo, para la vista (de verdad giran más, pero se volvería borroso)
  temblor: 0.006,  // amplitud a la escala del juego, a todo y pegado a la caja
  // el golpe de la patada (Oscar: "que no la mueva de lugar, simplemente un hit toon"): se aplasta
  // contra el piso, rebota como gelatina y se ladea tantito, con resortes subamortiguados
  golpe: { aplasta: 0.2, ensancha: 0.12, ladeo: 0.09, hz: 6.5, freno: 5.5, hzLadeo: 4.2, frenoLadeo: 4 },
}

export function crearRenderbox(prendida = true) {
  const rb = {
    prendida,
    rpm: prendida ? 1 : 0,
    boton: prendida ? 1 : 0,
    giro: 0,
    espera: 0,
    // resortes del golpe: g (aplastado) y l (ladeo), con su velocidad
    g: 0, gv: 0, l: 0, lv: 0,
    golpes: 0, // cuántas patadas lleva: quien pinta las chispas ve que cambió
    patear(lado = 1) {
      rb.golpes++
      rb.gv = -14
      rb.lv = 9 * (lado < 0 ? -1 : 1)
      rb.prendida = !rb.prendida
      rb.espera = rb.prendida ? RENDERBOX.esperaArranque : 0
      if (!rb.prendida) rb.boton = 0
      return rb.prendida
    },
    paso(dt) {
      const d = Math.max(0, Math.min(0.1, dt))
      if (rb.prendida) {
        rb.boton = Math.min(1, rb.boton + d / 0.12)
        if (rb.espera > 0) rb.espera -= d
        else rb.rpm = Math.min(1, rb.rpm + d / RENDERBOX.arranca)
      } else {
        // se frena como un ventilador de verdad: rápido al principio y se arrastra al final
        rb.rpm = Math.max(0, rb.rpm - d * (0.25 + rb.rpm) / RENDERBOX.frena * 1.6)
        if (rb.rpm < 0.003) rb.rpm = 0
      }
      rb.giro = (rb.giro + d * rb.rpm * RENDERBOX.vueltasPorSeg * Math.PI * 2) % (Math.PI * 2000)
      // resortes en pasos chicos (estables a cualquier cuadro)
      const G = RENDERBOX.golpe
      const w = 2 * Math.PI * G.hz, wl = 2 * Math.PI * G.hzLadeo
      const n = Math.max(1, Math.ceil(d / 0.004))
      for (let i = 0; i < n; i++) {
        const h = d / n
        rb.gv += (-w * w * rb.g - 2 * G.freno * rb.gv) * h
        rb.g += rb.gv * h
        rb.lv += (-wl * wl * rb.l - 2 * G.frenoLadeo * rb.lv) * h
        rb.l += rb.lv * h
      }
      return rb
    },
    // escala [x, y, z] y ladeo (rad) del golpe, alrededor del centro de la base de la caja
    deformacion() {
      const G = RENDERBOX.golpe
      const g = Math.max(-1, Math.min(1, rb.g / 0.35))
      return { sx: 1 - G.ensancha * g, sy: 1 + G.aplasta * g, sz: 1 - G.ensancha * g, ladeo: G.ladeo * Math.max(-1, Math.min(1, rb.l / 0.35)) }
    },
  }
  return rb
}
