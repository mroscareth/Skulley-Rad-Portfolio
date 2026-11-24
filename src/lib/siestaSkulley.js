// Los idles de Skulley cuando lo dejan quieto (Oscar, 2026-11-23): un solo de guitarra de
// aire y, si sigue quieto, se tira a dormir en el piso y M.A.D.R.E. le trae una cobijita.
// Las animaciones salen de Character/SkulleyRad.blend (scripts/skulley-anim/idles.py) y la
// cobija es tela simulada ahí mismo (cobija.py). Sin three: lo leen Player (que anima),
// la cobija (home/CobijaSkulley.jsx) y el drone (drone/DroneNPC.jsx).

const BASE = import.meta.env.BASE_URL
// va en la URL de cada archivo de los idles: con el mismo nombre, el navegador seguía dando el de antes (en producción
// se veía la cobija vieja después del deploy). Si se vuelve a exportar algo de aquí, subirla.
const VERSION = '2026-11-24'
const url = (ruta) => `${BASE}${ruta}?v=${VERSION}`
export const URL_IDLES = {
  guitarra: url('animaciones/guitarra.glb'),
  entra: url('animaciones/dormir_entra.glb'),
  dormido: url('animaciones/dormir.glb'),
  sale: url('animaciones/dormir_sale.glb'),
}
export const URL_COBIJA = url('props/cobija.glb')
export const URL_GUITARRA = url('props/guitarra.glb')
export const URL_PUA = url('props/pua.glb')
// La guitarra del solo (cuadros de la acción Guitarra, los mismos de idles.py; Oscar, 2026-11-23: "que le caiga del
// cielo, y al terminar que se queme y se desintegre"): cae dando vueltas desde `alto` (unidades del mundo) en `cae`
// y él la cacha al final; después del último acorde se quema (`quema`: se pone negra con brillo de brasa y echa
// fuego) y en `deshace` se encoge en ceniza. La púa sale en su mano al cacharla y se va cuando la suelta (`pua`)
export const GUITARRA = { cae: [20, 36], quema: [197, 206], deshace: [206, 214], alto: 9, vueltas: 1.25, pua: [36, 39, 195, 198], rasgueos: rasgueosDelSolo() }

const suaveG = (x) => x * x * (3 - 2 * x)
const entre = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)))

/** Lo que mide la púa en el cuadro `f` del solo (0: no se ve). */
export function escalaPua(f) {
  const [a, b, c, d] = GUITARRA.pua
  if (f == null || f < a || f > d) return 0
  return suaveG(entre(f, a, b)) * (1 - suaveG(entre(f, c, d)))
}

/** Cómo va la guitarra en el cuadro `f` del solo (null: no se ve). alto: cuánto le falta caer; giro: radianes de su
 *  vuelta en el aire; carbon: 0..1 de quemada; escala: 1..0 al deshacerse; fuego y ceniza: 0..1 de lo que echa. */
export function estadoGuitarra(f) {
  const G = GUITARRA
  if (f < G.cae[0] || f > G.deshace[1]) return null
  const e = { alto: 0, giro: 0, carbon: 0, escala: 1, fuego: 0, ceniza: 0, cayendo: false }
  if (f < G.cae[1]) {
    const u = entre(f, G.cae[0], G.cae[1])
    e.alto = G.alto * (1 - u) * (1 - u)
    e.giro = G.vueltas * 2 * Math.PI * Math.pow(1 - u, 1.6)
    e.cayendo = true
  }
  if (f >= G.quema[0]) {
    e.carbon = suaveG(entre(f, G.quema[0], G.quema[1]))
    e.fuego = 1
  }
  if (f >= G.deshace[0]) {
    const u = entre(f, G.deshace[0], G.deshace[1])
    e.escala = 1 - suaveG(u)
    e.fuego = 1 - u
    e.ceniza = u < 0.85 ? 1 : 0
  }
  return e
}

// Los rasgueos del solo (los mismos cuadros de `guitarra()` en idles.py; si cambian allá, cambian aquí): cuándo
// suena, qué acorde (a: quinto traste, b: tercero, c: séptimo), hacia dónde y qué tan fuerte; el ¡zas! y el último acorde duran
function rasgueosDelSolo() {
  const r = [{ f: 42, acorde: 'a', abajo: false, fuerza: 0.45 }]
  for (let f = 48, i = 0; f <= 120; f += 6, i++) {
    r.push({ f, acorde: 'abc'[Math.floor(i / 4) % 3], abajo: i % 2 === 0, fuerza: i % 4 < 2 ? 1 : 0.6 })
  }
  r.push({ f: 141, acorde: 'b', abajo: true, fuerza: 1.25, largo: 1.4 })
  for (let f = 148, i = 0; f <= 168; f += 4, i++) {
    r.push({ f, acorde: 'bbccaa'[i], abajo: i % 2 === 0, fuerza: 0.75, corto: true })
  }
  r.push({ f: 195, acorde: 'a', abajo: true, fuerza: 1.15, largo: 1.8 })
  return r
}
// nombre de cada clip (el de su acción en el .blend)
export const CLIP_IDLE = { guitarra: 'Guitarra', entra: 'Dormir_entra', dormido: 'Dormir', sale: 'Dormir_sale' }

export const SIESTA = {
  guitarraTras: 22,       // segundos quieto antes del solo de guitarra
  dormirTras: 48,         // segundos quieto antes de dormirse (siguen contando durante el solo)
  // Los clips no empiezan ni acaban en el idle (regla de Oscar, 2026-11-23: no heredan nada de la animación
  // de antes): el paso lo hace esta mezcla, que tiene que verse suave
  entraFundido: 0.5,      // mezcla de la locomoción a una animación
  saleFundido: 0.5,       // y de regreso
  cortaFundido: 0.3,      // si lo mueves a media guitarra (o antes de agacharse) se corta así de rápido
  despiertaVel: 1.3,      // Dormir_sale más rápida: lo despertaste y quieres jugar
  // fracciones de los clips: hasta aquí de Dormir_entra sigue de pie (moverlo lo corta con un
  // fundido; después, despierta), y desde aquí de Dormir_sale ya puede caminar
  entraDePie: 90 / 142,
  saleLibre: 56 / 82,
  // la llama de la mano se apaga al acostarse (cuadro 122 de Dormir_entra) y se vuelve a prender
  // cuando se sienta al despertar (cuadro 26 de Dormir_sale); `llamaVel`: qué tan rápido (1/s)
  llamaApaga: 122 / 142,
  llamaPrende: 26 / 82,
  llamaVel: 7,
  // los ojos se apagan del todo ya acostado (cuadro 128 de Dormir_entra) en `ojosFundido` s, y al
  // despertar se prenden parpadeando como foco: [segundos, brillo] uno tras otro (Oscar, 2026-11-23)
  ojosApaga: 128 / 142,
  ojosFundido: 0.6,
  ojosParpadeo: [[0.06, 1], [0.11, 0], [0.05, 0.55], [0.24, 0], [0.08, 1], [0.09, 0.12], [0.05, 0.8], [0.07, 0]],
  // respiración dormido (cuadros de Dormir a 30 fps): sube de 1 a 32, baja hasta 58
  respira: { sube: 32, baja: 58, largo: 91 },
}

// El estado de la siesta: lo escribe Player; la cobija y el drone solo lo leen (salvo `cobija`).
export const siesta = {
  estado: 'nada',         // nada | guitarra | entra | dormido | sale
  desde: 0,               // performance.now() / 1000 al entrar al estado
  dormidoDesde: 0,        // cuándo quedó acostado (para lo que dice M.A.D.R.E. al despertarlo)
  matriz: new Float32Array(16), // la del modelo (escena del personaje) al dormirse: la cobija va en ese espacio
  respira: 0,             // 0..1, lo hondo de la respiración ahora
  // la cobija: la pide el drone al llegar ('aparece'), cae sola, y Player la avienta al despertar
  cobija: { fase: 'nada', t0: 0 }, // nada | aparece | cae | puesta | tirada | sevaya
  cobijaCentro: { x: 0, y: 0, z: 0 }, // (lo pone la cobija) su centro extendida, en el mundo: ahí la suelta el drone
}

export const ahoraS = () => performance.now() / 1000

export function ponerEstado(estado) {
  siesta.estado = estado
  siesta.desde = ahoraS()
  if (estado === 'dormido') siesta.dormidoDesde = siesta.desde
}

export const dormido = () => siesta.estado === 'dormido'

// lo hondo de la respiración con el tiempo del clip Dormir (segundos)
export function respiracion(t) {
  const R = SIESTA.respira
  const f = ((t * 30) % (R.largo - 1)) + 1
  const ease = (x) => x * x * (3 - 2 * x)
  if (f < R.sube) return ease((f - 1) / (R.sube - 1))
  if (f < R.baja) return 1 - ease((f - R.sube) / (R.baja - R.sube))
  return 0
}

export function pedirCobija() {
  if (siesta.estado !== 'dormido' || siesta.cobija.fase !== 'nada') return false
  siesta.cobija.fase = 'aparece'
  siesta.cobija.t0 = ahoraS()
  return true
}

if (import.meta.env.DEV && typeof window !== 'undefined') window.__siesta = siesta
