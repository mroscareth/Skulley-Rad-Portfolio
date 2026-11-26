// La plaza de la ofrenda (Oscar, 2026-11-24): alrededor del portal de
// SKULLEYGLYPH van los lugares donde se ponen las ofrendas (lib/ofrendas.js),
// antorchas clavadas en el piso, muchos pétalos de cempasúchil y, atrás del
// portal junto a las barricadas, el lugar de la almohada, donde Skulley se va a
// dormir. Aquí solo está el plano; lo leen BosquePintado (las estelas con el
// nombre de cada ofrenda en runas y lo sólido), PetalosCamino (los pétalos) y
// PlazaOfrenda (las antorchas). Sin three. `mesa` es el lugar donde va el objeto
// (dentro de su corona de pétalos); qué lo sostiene está por decidirse: se
// probaron pedestales de cantera, del color de la escena y tocones, y no.
//
// Los cinco lugares van en un pentágono con una punta al norte, igual que los
// cinco portales del claro: la abertura del sur deja libre la entrada del
// camino. Cada uno es una corona de pétalos (donde va el objeto) con una
// estela detrás que dice su nombre en SKULLEYGLYPH y se prende cuando la ofrenda
// está puesta. Al norte el álbum de su gente, al centro como en las ofrendas de
// verdad, donde van las fotos.

// El portal del glifo (App.jsx, section6) y el centro de su plaza de lozas
// (PLAZA_GLIFO en pisoPintado.js, que trae three: aquí va escrito).
export const CENTRO = [0, -120]

// Ángulo en grados desde el norte (−z) hacia el este (+x).
export function enPlaza(grados, r) {
  const a = (grados * Math.PI) / 180
  return [CENTRO[0] + Math.sin(a) * r, CENTRO[1] - Math.cos(a) * r]
}
// El giro (en y) para que algo en (x, z) mire hacia el portal: su +z al centro.
export const miraAlCentro = (x, z) => Math.atan2(CENTRO[0] - x, CENTRO[1] - z)

export const PLAZA = {
  mesaR: 7,
  estelaR: 8.5,
  // Las estelas son menhires chicos del bosque.
  estelaEscala: 0.5,
  anillo: 3.3,        // los pétalos alrededor del portal
  corona: 1.5,        // y alrededor de cada mesa
}

export const LUGARES = [
  { id: 'album', grados: 0, es: 'Album', en: 'Album' },
  { id: 'ipad', grados: 72, es: 'iPad', en: 'iPad' },
  { id: 'leica', grados: -72, es: 'Cámara', en: 'Camera' },
  { id: 'teclado', grados: 144, es: 'Teclado', en: 'Keyboard' },
  { id: 'cerillos', grados: -144, es: 'Cerillos', en: 'Matches' },
].map((l, i) => {
  const mesa = enPlaza(l.grados, PLAZA.mesaR)
  const estela = enPlaza(l.grados, PLAZA.estelaR)
  return {
    ...l,
    mesa: { x: mesa[0], z: mesa[1], rot: miraAlCentro(mesa[0], mesa[1]) },
    estela: { x: estela[0], z: estela[1], rot: miraAlCentro(estela[0], estela[1]), v: i % 3 },
  }
})

// Atrás del portal, junto a las barricadas (BordeDelMundo, a 17.3 del portal):
// donde va la almohada y se duerme Skulley. A lo ancho de la vista, así la
// cámara lo ve acostado de lado. Marcado con pétalos y dos antorchas.
export const CAMA = (() => {
  const [x, z] = enPlaza(0, 13.4)
  return { id: 'almohada', x, z, ancho: 2.3, fondo: 1.25, rot: 0 }
})()

// Antorchas: dos en la entrada del camino, dos a los lados (entre las mesas) y
// dos junto a la cama.
export const ANTORCHAS = [
  [CENTRO[0] - 2.7, CENTRO[1] + 14.4],
  [CENTRO[0] + 2.7, CENTRO[1] + 14.4],
  enPlaza(-108, 12.4),
  enPlaza(108, 12.4),
  [CAMA.x - CAMA.ancho / 2 - 0.9, CAMA.z - 0.2],
  [CAMA.x + CAMA.ancho / 2 + 0.9, CAMA.z - 0.2],
].map(([x, z], i) => ({ x, z, inclina: [0.05, -0.06, 0.04, -0.05, -0.04, 0.06][i], hacia: i * 2.1 }))

// Pétalos por unidad² en (x, z) para la plaza: un camino que entra del sur
// hasta el portal, un anillo alrededor del portal, rayos del anillo a cada mesa,
// una corona alrededor de cada mesa y el contorno de la cama; más pétalos
// sueltos por toda la plaza. Las figuras se tocan (el fuego de la bola corre por
// ellas como mecha, PetalosCamino) y lo suelto casi no.
const TUPIDO = 13
const SUELTOS = 0.28
const banda = (d, ancho) => Math.exp(-((d / ancho) ** 2))

function aSegmento(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)))
  return Math.hypot(px - ax - vx * t, pz - az - vz * t)
}

export function densidadPetalosPlaza(x, z) {
  const dx = x - CENTRO[0], dz = z - CENTRO[1]
  const r = Math.hypot(dx, dz)
  if (r > 16.2 || r < 2.7) return 0
  // Nada encima de lo sólido ni dentro de la cama.
  for (const l of LUGARES) {
    if (Math.hypot(x - l.mesa.x, z - l.mesa.z) < 1.05) return 0
    if (Math.hypot(x - l.estela.x, z - l.estela.z) < 0.75) return 0
  }
  for (const a of ANTORCHAS) if (Math.hypot(x - a.x, z - a.z) < 0.3) return 0
  const cx = x - CAMA.x, cz = z - CAMA.z
  const dentroCama = Math.abs(cx) < CAMA.ancho / 2 && Math.abs(cz) < CAMA.fondo / 2
  if (dentroCama) return 0
  let f = 0
  // El camino de la entrada: del borde de la plaza al anillo.
  if (dz > 0) f = Math.max(f, banda(dx, 0.85) * (1 - Math.max(0, (r - 15.5) / 0.7)))
  f = Math.max(f, banda(r - PLAZA.anillo, 0.42))
  for (const l of LUGARES) {
    const [ax, az] = enPlaza(l.grados, PLAZA.anillo)
    const [bx, bz] = enPlaza(l.grados, PLAZA.mesaR - PLAZA.corona)
    f = Math.max(f, banda(aSegmento(x, z, ax, az, bx, bz), 0.32))
    f = Math.max(f, banda(Math.hypot(x - l.mesa.x, z - l.mesa.z) - PLAZA.corona, 0.3))
  }
  // El contorno de la cama, un poco por fuera.
  const fuera = Math.hypot(Math.max(Math.abs(cx) - CAMA.ancho / 2, 0), Math.max(Math.abs(cz) - CAMA.fondo / 2, 0))
  f = Math.max(f, banda(fuera - 0.12, 0.24))
  // Los sueltos se acaban hacia la orilla de la plaza.
  const suelto = SUELTOS * (1 - Math.max(0, (r - 13.5) / 2.7))
  return Math.max(f * TUPIDO, suelto)
}
export const PETALOS_PLAZA_TOPE = TUPIDO

// Lo sólido de la plaza que no es del bosque: las antorchas (Skulley las rodea;
// las esferas no rebotan en un palo).
export const SOLIDO_ANTORCHA = 0.28
// Oscar las quitó el 2026-11-26 (en su lugar, un solo rayo grande sobre la plaza): el plano se queda por si regresan.
export const HAY_ANTORCHAS = false
