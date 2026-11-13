import * as THREE from 'three'
import { playOrbKick, playOrbHit, playOrbBounce, playFootstep } from './homeSounds.js'
import { playEyePoke, playEyePop, playEyeRespawn } from './eyePokeSound.js'
import { playSfx, preloadSfx } from './sfx.js'
import { KICK_BONES, KICK_A, KICK_B, KICK_ROOT_A, KICK_ROOT_B } from './kickPose.js'

// El numerito de Skulley en la historia del preloader de escritorio (Oscar:
// "algo que lo haga verse un poco tonto"). Con el foco recién prendido, una
// esfera entra volando desde fuera de cuadro y le tumba la cabeza; la cabeza
// rebota, rueda y se queda de lado en lo oscuro. Skulley, sin cabeza, camina
// a tientas con los brazos por delante, primero para el lado equivocado; se
// da la vuelta y llega a ella, y la cabeza se le prende de la espinilla. Del
// dolor brinca, sacude la pierna con la cabeza colgando y la patea lejos (Oscar);
// va por ella con cuidado, se agacha, se la pone al revés, voltea a la cámara
// confundido y se la endereza de un tronido. El foco lo va siguiendo.
//
// Es una capa encima de las animaciones del GLB (el idle y la caminata, que
// aquí se mezclan), hueso por hueso, después del mixer (como la pose del láser
// en Player.jsx). Skulley es un esqueleto de piezas rígidas: mover el hueso
// `headx` despega el cráneo entero (ojos, mandíbula y mohawk cuelgan de él).
// Las manos llegan a donde deben con IK de dos huesos en espacio de mundo, así
// no depende de los ejes locales del rig. La cabeza y la esfera caen con una
// física precalculada al arrancar (paso fijo: igual en cualquier pantalla), y
// sus botes y los pasos suenan desde aquí.
//
// Tiempos en segundos desde que arranca (los nombres dicen qué pasa). Al
// terminar se queda donde acabó, ya con la cabeza bien puesta, hasta que el
// preloader lo suelta en un corte de cámara (ahí regresa al centro).
export const NUMERITO = {
  golpe: 0.42, // la esfera le pega en la cabeza
  sacudida: 1.2, // el cuerpo se sacude del golpe
  despiste: 2.1, // sin cabeza, voltea a los lados
  giro1: 2.55, // se voltea hacia el lado equivocado
  camina1: 3.95, // y camina a tientas
  pausa: 4.25,
  giro2: 4.95, // se da la vuelta
  llega: 7.2, // camina hasta la cabeza y se para junto a ella
  acecha: 7.3, // la cabeza despierta, ve a la cámara, voltea a la pierna y se agazapa
  muerde: 8.5, // ¡ÑAM! se lanza y se le prende de la espinilla (Oscar)
  patada: 9.6, // brinca y sacude la pierna del dolor... y la patea
  sueltaPierna: 10.05,
  despiste2: 10.75, // se recompone y voltea a ver dónde quedó
  giro3: 11.25,
  camina3: 12.85, // va por ella con cuidado, parándose antes
  laVe: 13.25,
  agachado: 13.95,
  agarra: 14.2,
  enPecho: 15.05, // se endereza con la cabeza en las manos
  puesta: 15.85, // se la pone... al revés
  suelta: 16.25,
  deFrente: 16.8, // voltea a la cámara con la cabeza al revés
  // Confundido (Oscar: el meneo rápido de antes casi no se notaba): mira a un
  // lado, se queda; al otro, se queda; y se queda dudando con la cabeza ladeada.
  mira1: 16.9,
  mira2: 17.5,
  duda: 18,
  confundido: 18.5, // sube las manos a la cabeza
  manosArriba: 18.85,
  tronido: 19.25, // y se la gira de golpe
  fin: 19.8,
}

// La curva de la patada del juego (Player.jsx), que empieza a dar el latigazo
// en `patada`: recoge la pierna, latigazo, aguanta y regresa. La cabeza sale
// casi en la extensión (`suelta`, segundos después de `patada`). El latigazo
// y el recoger duran más que en el juego (0.17 s y no 0.075; 0.26 y no 0.16)
// y arrancan y llegan suave: a la velocidad del juego la pierna recorría media
// patada en un cuadro y la cabeza pegada a la espinilla se teletransportaba
// (Oscar: "brincos").
const PATADA = { antic: 0.26, swing: 0.17, hold: 0.1, dur: 0.975, suelta: 0.13 }
function pesoPatada(t) {
  const k = t - (NUMERITO.patada - PATADA.antic)
  if (k < 0 || k >= PATADA.dur) return { W: 0, P: 0 }
  if (k < PATADA.antic) {
    const r = k / PATADA.antic
    return { W: r < 0.5 ? 2 * r * r : 1 - Math.pow(-2 * r + 2, 2) / 2, P: 0 }
  }
  if (k < PATADA.antic + PATADA.swing) {
    const u = (k - PATADA.antic) / PATADA.swing
    return { W: 1, P: u * u * (3 - 2 * u) }
  }
  if (k < PATADA.antic + PATADA.swing + PATADA.hold) return { W: 1, P: 1 }
  const r = (k - PATADA.antic - PATADA.swing - PATADA.hold) / (PATADA.dur - PATADA.antic - PATADA.swing - PATADA.hold)
  return { W: 1 - r * r * (3 - 2 * r), P: 1 }
}

// El madrazo también empuja el cuerpo (Oscar: más intención): el torso se va
// hacia donde iba la esfera y oscila como resorte (`lado`, radianes, `w`,
// `frena`), la cadera se carga sobre el pie de ese lado (`cadera`, en altos) y
// se balancea en él con el otro pie en el aire, abierto (`abre`, `alza`, en
// altos), agitando los brazos en círculos como molino (`molino`, en altos, a
// `vueltas` por segundo). `equilibrio`: cuándo sube y baja el pie (s desde el golpe).
const EMPUJE = { lado: 0.34, w: 2 * Math.PI * 1.5, frena: 2.2, cadera: 0.06, abre: 0.08, alza: 0.1, molino: 0.06, vueltas: 2, equilibrio: [0.05, 0.2, 1.0, 1.35] }

// Radio del cráneo (en altos del personaje): a esa altura del piso queda su
// centro, y a esa distancia van las manos a sus lados.
const RADIO_CRANEO = 0.135
// Cuánto se dobla cada vértebra para llegar al piso (radianes, ~80° en total).
const DOBLA = { spine_01x: 0.6, spine_02x: 0.45, spine_03x: 0.35 }
// Hacia dónde apuntan los codos: hacia afuera y un poco atrás.
const CODO = { x: 0.6, y: -0.2, z: -0.35 }
// La caminata del GLB (root|root|Walking, 1.367 s por ciclo): el pie apoyado
// retrocede ~1.15 unidades del rig por segundo a velocidad 1 (medido). El
// cuerpo avanza a esa velocidad por la escala de tiempo, y los pies no patinan.
const PASO_VEL = 1.15
const CICLO = 1.367
// Física en unidades del rig: Skulley mide 2 y representa ~1.7 m.
const G = 11.5
const RADIO_ORBE = 0.13
// De dónde sale la esfera (fuera de cuadro a la izquierda, un poco arriba y
// hacia la cámara) y cómo salen la cabeza y la esfera del golpe (unidades por
// segundo; `giro` es la vuelta de la cabeza alrededor del eje de la cámara).
const ORBE_SALE = new THREE.Vector3(-3.4, 1.95, 0.45)
// Sale más de lado que de alto: más cerca, al caer le pasaba rozando el codo
// izquierdo y el brazo la esquivaba de un jalón (Oscar: "un brazo tiene un brinco").
export const CABEZA_SALE = { vx: 1.55, vy: 2.5, vz: 0.25, giro: -8 }
// Del golpe rebota hacia atrás y hacia la cámara, y se queda en el piso
// enfrente (Oscar): cuando Skulley camina a la izquierda se ve de nuevo,
// borrosa por la profundidad de campo (ORBE_DESENFOQUE).
const ORBE_REBOTA = { vx: -0.55, vy: 1.7, vz: 0.5 }
// Qué tan desenfocada se ve la esfera según lo que está delante de Skulley
// (en altos): nada hasta `desde` y del todo en `hasta`.
export const ORBE_DESENFOQUE = { desde: 0.1, hasta: 0.3 }
// Hasta dónde camina para el lado equivocado (x del rig) y a qué distancia de
// la cabeza se para (lo que alcanza agachándose).
const IDA = -1.0
const ANTES_DE_CABEZA = 0.55
// La mordida: se para con la cabeza enfrente de su espinilla izquierda (en el
// espacio del cuerpo: `lado` a su izquierda, `adelante` hacia donde mira), la
// cabeza abre la boca (`abre`, radianes de mandíbula) y se le prende. La
// cabeza mordiendo va pegada al hueso de la pierna: así no se atraviesan
// (Oscar: parecía que le mordía la pierna; ahora le muerde de verdad).
const MORDIDA = { lado: 0.12, adelante: 0.36, abre: 0.5 }
// La mordida como caricatura (Oscar: más intención, más anime): despierta y se
// endereza con un brinquito viendo a la cámara (`despierta`, s desde
// `acecha`), se mece con picardía (`mira`: hasta cuándo, `mece` radianes),
// voltea de golpe a la pierna (`voltea`, s) y se agazapa (se aplasta `aplasta`, se echa para atrás `atras`
// altos) abriendo el hocico (`hocico`, veces `MORDIDA.abre`) y temblando
// (`tiembla`, altos) como "grrr"; se queda quieta un instante (`quieta`) y se
// lanza rapidísimo (`lanza`, s antes de `muerde`), estirándose (`estira`);
// al morder cierra de golpe y se aplasta con el impacto como resorte
// (`impacto`, `rebota` por segundo, `frena` s).
const MORDIDA_ANIM = { despierta: 0.3, mira: 0.55, mece: 0.14, voltea: 0.1, atras: 0.07, aplasta: 0.16, hocico: 1.25, tiembla: 0.006, quieta: 0.1, lanza: 0.09, estira: 0.14, impacto: 0.24, rebota: 6, frena: 0.08 }
// Al patearla sale en arco hacia adelante, arriba y hacia la cámara.
const PATADA_SALE = { adelante: 0.75, vy: 3.1, haciaCamara: 0.8, giro: -10 }
// Qué tan lejos del pecho carga la cabeza (en altos): sin aire, el cráneo se
// metía entre los brazos y las costillas.
const CARGA_ADELANTE = 0.26
// El giro hacia la cabeza, como animación y no de videojuego (Oscar: girando
// en su lugar se veía plano, sin intención; el tropiezo parecía error). Antes,
// lo siente: el torso se tuerce `anticipa` radianes al lado contrario. Luego el
// pecho voltea primero (le gana a la cadera hasta `adelanta` radianes, se pasa
// `pasa` de la vuelta y se acomoda) y la cadera lo sigue en pasos de verdad,
// uno tras otro sin que los dos pies estén en el aire (`pasos`: desde, hasta,
// en fracciones del giro, y qué parte de la vuelta da en cada uno; el primero
// con el pie de adentro y el último solo cierra la postura, si no ese pie se
// quedaba atrás y brincaba al terminar): el pie de apoyo
// plantado y girando sobre la planta (`pivota`), el otro en arco (`levanta`,
// en altos), la cadera baja `baja` altos en cada paso y se carga `carga` altos
// sobre el pie de apoyo.
const GIRO = {
  anticipa: 0.16, adelanta: 0.55, pasa: 0.08,
  pasos: [[0.04, 0.3, 0.34], [0.3, 0.56, 0.36], [0.56, 0.8, 0.3], [0.8, 0.98, 0]],
  pivota: 0.5, levanta: 0.05, baja: 0.018, carga: 0.025,
}
// Qué tanto del torso tuerce cada vértebra.
const TUERCE = { spine_01x: 0.25, spine_02x: 0.35, spine_03x: 0.4 }
// Cuánto de la vuelta lleva la cadera en `u`: gira mientras da cada paso.
function vueltaCadera(u) {
  let v = 0
  for (const [a, b, parte] of GIRO.pasos) v += parte * suave(clamp01((u - a) / (b - a)))
  return v
}
// Cuánto el pecho: se adelanta, se pasa un poco y se acomoda.
function vueltaPecho(u) {
  if (u <= 0) return 0
  if (u < 0.7) return (1 + GIRO.pasa) * suave(u / 0.7)
  return 1 + GIRO.pasa * (1 - suave(clamp01((u - 0.7) / 0.3)))
}
// Sin cabeza camina a tientas (Oscar: las manos daban vueltas, como en
// círculos): los brazos extendidos al frente, a la altura de los hombros
// (`alcance` de su largo, `alto` en altos), las palmas al frente con los dedos
// hacia arriba, inclinados `dedos` radianes hacia adelante, como quien palpa
// una pared, y cada mano tantea a su ritmo: de lado y de arriba abajo en
// movimientos chicos que no se repiten (`lado` y `sube`, en altos, a dos
// ritmos cada uno) y de vez en cuando se estira (`estira`, de su largo).
const TANTEO = { alcance: 0.84, alto: -0.03, abre: 0.02, dedos: 0.5, lado: [0.035, 0.015], sube: [0.025, 0.01], estira: 0.08 }
// Con la cabeza al revés trata de ver y no puede (`mira1` → `confundido`): el
// torso voltea a un lado (`lado1`, radianes, en `gira` s) asomándose hacia
// adelante (`asoma`) y se queda; al otro (`lado2`, en `gira2` s) y se queda;
// regresa al centro con la cabeza ladeada como perro confundido (`ladea`) y
// alza los hombros con las palmas arriba (`encoge`: dónde van las manos, en
// unidades del cuerpo).
const DUDA = { lado1: 0.55, lado2: -0.6, gira: 0.4, gira2: 0.35, asoma: 0.12, ladea: 0.34, encoge: { x: 0.34, y: 0.92, z: 0.24 } }
// Cuánto voltea el torso en la duda (radianes).
function volteaDuda(t) {
  const N = NUMERITO
  return suave(tramo(t, N.mira1, N.mira1 + DUDA.gira)) * DUDA.lado1
    + suave(tramo(t, N.mira2, N.mira2 + DUDA.gira2)) * (DUDA.lado2 - DUDA.lado1)
    - suave(tramo(t, N.duda, N.duda + 0.28)) * DUDA.lado2
}
// Los ? de la duda (los dibuja el rig, SignosDuda), como de anime (Oscar):
// muchos, de varios tamaños, y cada uno entra y sale con pop. `t` cuándo
// entra, `dura` cuánto se queda (o hasta `seVan`), dónde respecto al hueso de
// la cabeza (`x` a la derecha y `y` arriba en la pantalla, en altos) y qué
// tan grande.
const DUDA_MIRA1 = NUMERITO.mira1 + DUDA.gira
const DUDA_MIRA2 = NUMERITO.mira2 + DUDA.gira2
const DUDA_DUDA = NUMERITO.duda
export const SIGNOS_DUDA = {
  salen: [
    { t: DUDA_MIRA1 + 0.04, dura: 0.55, x: 0.24, y: 0.2, tam: 1 },
    { t: DUDA_MIRA1 + 0.16, dura: 0.4, x: 0.36, y: 0.33, tam: 0.55 },
    { t: DUDA_MIRA1 + 0.26, dura: 0.3, x: 0.17, y: 0.36, tam: 0.4 },
    { t: DUDA_MIRA2 + 0.04, dura: 0.5, x: -0.26, y: 0.24, tam: 1 },
    { t: DUDA_MIRA2 + 0.15, dura: 0.38, x: -0.38, y: 0.13, tam: 0.5 },
    { t: DUDA_DUDA + 0.2, dura: 9, x: 0.15, y: 0.33, tam: 1.4 },
    { t: DUDA_DUDA + 0.3, dura: 9, x: -0.2, y: 0.38, tam: 0.7 },
    { t: DUDA_DUDA + 0.38, dura: 0.35, x: 0.36, y: 0.16, tam: 0.6 },
    { t: DUDA_DUDA + 0.46, dura: 9, x: -0.33, y: 0.19, tam: 0.45 },
    { t: DUDA_DUDA + 0.52, dura: 9, x: 0.3, y: 0.42, tam: 0.38 },
  ],
  seVan: NUMERITO.confundido + 0.05,
}
// Ya armado otra vez después del rayo se revisa las manos, impresionado de que
// quedó bien (Oscar), como quien se ve las uñas, una mano a la vez (frente a
// la cara se las metía en ella; tiesa y sin intención, Oscar): la mano llega
// al frente de la panza, pasándose un poco (`llega`), con el codo afuera, los
// dedos arriba, la palma al frente y el dorso hacia su cara (Oscar; `donde`,
// en unidades del cuerpo; `dorso`: cuánto se dobla la muñeca hacia atrás). La
// palma se voltea girando el antebrazo entero sobre su eje (es una pieza
// rígida): torciendo la muñeca se adelgazaba la malla.
// Se acerca a verla con
// la cabeza ladeada (`mira`, `voltea`, `ladea`) y el torso hacia ella
// (`torso`), mueve los dedos en ola dos veces (`ola`), aprueba con la cabeza
// y una sacudida de la muñeca (`aprueba`) y la regresa (`regresa`). `manos`:
// cuándo empieza cada una (s desde que quedó armado) y cuál (1 la izquierda).
//
// Luego se estira de lado como en la referencia de Oscar, una vez a cada lado:
// abre las piernas parejas en dos pasitos (`piernas`: medio ancho en altos,
// `pasos`, `alzaPie`) y las deja abiertas hasta el final; sube un brazo
// tomando aire (`alza`) con el hombro encogido (`encoge`) y lo pasa en arco
// junto a lo alto de la cabeza, con el codo afuera (`arco`: a dónde va la mano
// desde el centro del cráneo, en altos, sin pasar de `dobla` del largo del
// brazo para que el codo vaya doblado desde que sube; con su cabezota no
// alcanza a pasar por encima ni estirado)
// mientras la otra mano va a la cintura (`cintura`); el torso se inclina en C
// hacia el otro lado (`dobla`, `inclina`, repartido en las vértebras por
// `curva`) y la cadera sale hacia el lado del brazo (`cadera`, en altos).
// Empuja dos veces más con la boca abierta (`empujes`, `empuje`) y las piezas
// se despegan un poquito una por una, de la mano a la columna (`despega`, en
// altos; Oscar: estilo manguera o despegadas, "eso está chido"); al soltar
// (`suelta`) regresan de golpe con un rebotito y el torso regresa con resorte,
// pasándose un poco, mientras suelta el aire. `lados`: desde cuándo y qué
// brazo sube. Todo va sobre una pose derecha (la de armado del esqueleto, a
// `neutro`): encima del idle, su vaivén y su peso en una pierna peleaban con la
// pose nueva (Oscar: "como si heredara otra pose").
// Al terminar se relaja, todo encimado, y se funde con el idle sin que se
// note (Oscar: el paso al idle se veía poco natural): los hombros caen al
// soltar el aire, los brazos bajan y se columpian por la inercia (`columpio`:
// radianes, por segundo, cómo se frena y desde cuándo, s después de soltar),
// la cabeza hace un giro de cuello (`cuello`), la cadera carga el peso en el
// otro pie en cada pasito (`peso`, en altos) y la pose derecha se suelta
// despacio (`neutro`: de cuándo a cuándo, s después de soltar el segundo).
export const INSPECCION = {
  neutro: 0.85,
  manos: [[0.2, -1], [1.45, 1]], llega: [0, 0.42], regresa: [1.2, 1.6], donde: { x: 0.32, y: 0.9, z: 0.72 },
  dorso: 1.15, mira: 0.18, voltea: 0.36, ladea: 0.12, torso: { gira: 0.14, dobla: 0.03 }, ola: [0.5, 0.78], aprueba: 1.05,
  lados: [[3.15, -1], [5.7, 1]],
  piernas: 0.15, pasos: [[0.05, 0.45], [0.3, 0.7]], alzaPie: 0.035,
  alza: [0, 0.6], dobla: [0.3, 1.15], empujes: [1.3, 1.75], empuje: 0.1, suelta: 2.15, regresa2: 0.7, baja: [2.15, 2.75],
  inclina: 0.6, curva: [0.22, 0.34, 0.44], cadera: 0.05,
  arco: { arriba: 0.15, lado: -0.19, dobla: 0.91 }, encoge: 0.5, cintura: { x: 0.03, y: 0.09 },
  despega: { piezas: { mano: 0.04, antebrazo: 0, brazo: 0.045, spine_02x: 0.014, spine_03x: 0.014, cuello: 0.012 }, desde: 0.15, escalon: 0.09, entra: 0.45 },
  relaja: { neutro: [0.2, 1.5], hombros: 0.12, cuello: 0.09, peso: 0.025, columpio: { a: 0.22, hz: 1.3, frena: 3.2, desde: 0.45 } },
  dura: 9.5,
}
// Para levantar la cabeza se pone en cuclillas: la cadera baja `baja` altos y
// las rodillas se doblan hacia adelante con los pies donde estaban. Solo con
// la espalda y las piernas rectas no le alcanzaban los brazos (llegaba con el
// brazo estirado, tieso; Oscar: "wonky"). `espalda`: lo que se dobla la
// columna en cuclillas, de lo que se doblaba sin ellas.
const CUCLILLAS = { baja: 0.15, espalda: 0.75 }
// Cómo agarra su cabeza (Oscar: las manos atravesaban el cráneo y se veía
// chueco). La palma va pegada al cráneo de cada lado, en el punto más afuera
// de verdad (los vértices del cráneo, sin el pelo), con `holgura` de aire (en
// altos), y se abre `abre` altos antes de agarrar y al soltar. La muñeca va
// casi derecha, como una mano de verdad: los dedos siguen la línea del
// antebrazo, la mano solo gira para que la palma mire al cráneo y se dobla
// `flexiona` radianes hacia él; los dedos se cierran `cierra` radianes por
// falange al agarrar. La palma no va en lo más ancho sino `atras` radianes
// más hacia la muñeca, pegada a esa parte del cráneo: en lo más ancho los
// dedos se salían por delante de la cabeza. (Imponerles hacia dónde apuntar según la altura los
// dejaba chuecos, apuntando arriba con la cabeza en el piso; Oscar.) Si aun así
// algún dedo se mete al cráneo, la mano sale lo que falte (`vueltas`). La
// cabeza siempre queda al `alcance` de sus brazos con las manos a `ancho`
// altos de su centro.
const AGARRE = { holgura: 0.004, abre: 0.07, flexiona: 0.22, cierra: 0.26, atras: 0.45, vueltas: 3, alcance: 0.9, ancho: 0.165, estira: 0.96 }
// La cabeza en las manos, en un solo movimiento: despega del piso derecho
// hacia arriba (`despega`, en altos), pasa frente al pecho, por encima del
// cuello y baja a su lugar, como quien se pone un casco (`casco`: qué tan
// arriba y adelante del cuello pasa). Con dos tramos, cada uno con su arranque
// y su frenón, se detenía en el pecho y se veía de robot (Oscar: "wonky").
const CARGA = { despega: 0.16, casco: { arriba: 0.14, adelante: 0.06 } }
// En qué fracción de cada caminata arranca y frena.
const ARRANQUE = 0.22
// Después de la patada la cabeza se acomoda en el aire, en estos segundos, a
// la orientación del primer golpe (de cara a la cámara): así rueda y se
// acuesta de lado como la primera vez. Con la que traía de la pierna se
// quedaba parada sobre la quijada, medio metida en el piso.
const ACOMODO = 0.4
// Contra el piso, la cabeza suelta se asienta en su punto más bajo cuando su
// centro está a menos de esto (en radios del cráneo) de donde reposa; más
// arriba solo se le impide bajar del piso.
const ASIENTA = 0.6
// Holgura contra el piso, en altos del personaje (ver `holgura` en aplicar).
const HOLGURA = 0.001
// Lo que se queda arriba del piso el pie que patea, en altos (ver aplicar).
const ROZA = 0.005
// Los brincos de dolor mientras lo muerde (medios ciclos por segundo).
const BRINCOS = 3
const BRINCO_HZ = 3.5
// Parado en un pie (lo muerde, brinca y patea), el de apoyo va plantado
// debajo de la cadera (`x`, `z` en el espacio del cuerpo). Llega a su lugar en
// el aire del primer brinco (`entra`, segundos) y al final regresa a su
// postura con un pasito (`regresa`, segundos; `paso`, cuánto sube el pie).
const APOYO = { x: -0.08, z: -0.02, entra: 0.18, regresa: 0.3, paso: 0.06 }

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const tramo = (t, a, b) => clamp01((t - a) / Math.max(1e-6, b - a))
const suave = (u) => u * u * (3 - 2 * u)
const sale = (u) => 1 - (1 - u) * (1 - u)
const lerp = (a, b, u) => a + (b - a) * u
// Posición (0..1) y velocidad (por unidad de u) de una caminata que arranca,
// va pareja y frena: velocidad en trapecio.
function trapecio(u, a = ARRANQUE) {
  const vmax = 1 / (1 - a)
  if (u <= 0) return 0
  if (u >= 1) return 1
  if (u < a) return (0.5 * vmax * u * u) / a
  if (u > 1 - a) { const r = 1 - u; return 1 - (0.5 * vmax * r * r) / a }
  return 0.5 * vmax * a + vmax * (u - a)
}
function trapecioVel(u, a = ARRANQUE) {
  const vmax = 1 / (1 - a)
  if (u <= 0 || u >= 1) return 0
  if (u < a) return (vmax * u) / a
  if (u > 1 - a) return (vmax * (1 - u)) / a
  return vmax
}

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _q3 = new THREE.Quaternion()
const _q4 = new THREE.Quaternion()
const _m1 = new THREE.Matrix4()
const _m2 = new THREE.Matrix4()
const _s = new THREE.Vector3()
const IDENTIDAD = new THREE.Quaternion()
const EJE_X = new THREE.Vector3(1, 0, 0)
const EJE_Y = new THREE.Vector3(0, 1, 0)
const EJE_Z = new THREE.Vector3(0, 0, 1)

// Gira un hueso para que su dirección `desde` (mundo) apunte a `hacia`, con
// peso: la diferencia se aplica en mundo y se regresa a su espacio local.
function apuntar(hueso, desde, hacia, peso) {
  _q1.setFromUnitVectors(desde.normalize(), hacia.normalize())
  if (peso < 1) _q1.slerp(IDENTIDAD, 1 - peso)
  hueso.getWorldQuaternion(_q2)
  hueso.parent.getWorldQuaternion(_q3).invert()
  hueso.quaternion.copy(_q3.multiply(_q1.multiply(_q2)))
  hueso.updateMatrixWorld(true)
}

// IK de dos huesos: el brazo y el antebrazo llevan la mano a `objetivo`, con
// el codo hacia `polo` (todo en mundo).
function ik(brazo, antebrazo, mano, objetivo, polo, peso) {
  const A = brazo.getWorldPosition(new THREE.Vector3())
  const B = antebrazo.getWorldPosition(new THREE.Vector3())
  const C = mano.getWorldPosition(new THREE.Vector3())
  const l1 = A.distanceTo(B)
  const l2 = B.distanceTo(C)
  const haciaT = objetivo.clone().sub(A)
  const d = Math.min(Math.max(haciaT.length(), 1e-4), (l1 + l2) * 0.999)
  haciaT.normalize()
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
  const sinA = Math.sqrt(1 - cosA * cosA)
  const doblez = polo.clone().sub(A)
  doblez.sub(_v1.copy(haciaT).multiplyScalar(doblez.dot(haciaT))).normalize()
  const codo = A.clone().addScaledVector(haciaT, l1 * cosA).addScaledVector(doblez, l1 * sinA)
  apuntar(brazo, B.clone().sub(A), codo.sub(A), peso)
  const B2 = antebrazo.getWorldPosition(new THREE.Vector3())
  const C2 = mano.getWorldPosition(new THREE.Vector3())
  apuntar(antebrazo, C2.sub(B2), objetivo.clone().sub(B2), peso)
}

// ── La física ─────────────────────────────────────────────────────────────
// Paso fijo, muestras cada 1/120 s: [x, y, z, ángulo] en el espacio del rig.
const DT = 1 / 240
function muestra(sim, t) {
  const n = sim.datos.length / 4
  const f = Math.max(0, Math.min(n - 1, t / sim.paso))
  const i = Math.floor(f)
  const j = Math.min(n - 1, i + 1)
  const u = f - i
  const d = sim.datos
  return {
    x: lerp(d[i * 4], d[j * 4], u),
    y: lerp(d[i * 4 + 1], d[j * 4 + 1], u),
    z: lerp(d[i * 4 + 2], d[j * 4 + 2], u),
    a: lerp(d[i * 4 + 3], d[j * 4 + 3], u),
  }
}

// La cabeza sale del golpe: vuela girando, rebota perdiendo fuerza, rueda sin
// patinar (lo que gira es lo que avanza) y, ya lenta, se mece hasta quedar de
// lado, que es como se acuesta un cráneo con mohawk.
function simularCabeza(p0, suelo, radio, salida = CABEZA_SALE, a0 = 0) {
  const datos = []
  const botes = []
  let x = p0.x, y = p0.y, z = p0.z
  let vx = salida.vx, vy = salida.vy, vz = salida.vz
  let a = a0, w = salida.giro
  let enPiso = false
  let meciendo = false
  let objetivo = 0
  for (let i = 0, t = 0; t < 3.4; i++, t += DT) {
    if (!enPiso) {
      vy -= G * DT
      x += vx * DT; y += vy * DT; z += vz * DT; a += w * DT
      if (y <= suelo && vy < 0) {
        y = suelo
        const fuerza = -vy
        if (fuerza > 0.3) botes.push({ t, fuerza: Math.min(1, fuerza / 4) })
        vy = fuerza > 1 ? fuerza * 0.42 : 0
        vx *= 0.78; vz *= 0.7
        w = w * 0.4 + (-vx / radio) * 0.6
        if (vy === 0) enPiso = true
      }
    } else if (!meciendo) {
      const f = Math.exp(-2.4 * DT)
      vx *= f; vz *= f
      w = -vx / radio
      a += w * DT; x += vx * DT; z += vz * DT
      if (Math.hypot(vx, vz) < 0.35) {
        meciendo = true
        const k1 = Math.round((a - Math.PI / 2) / (Math.PI * 2))
        const k2 = Math.round((a + Math.PI / 2) / (Math.PI * 2))
        const de1 = Math.PI / 2 + Math.PI * 2 * k1
        const de2 = -Math.PI / 2 + Math.PI * 2 * k2
        objetivo = Math.abs(de1 - a) < Math.abs(de2 - a) ? de1 : de2
      }
    } else {
      w += (-70 * (a - objetivo) - 7 * w) * DT
      const da = w * DT
      a += da
      x -= da * radio
      vz *= Math.exp(-4 * DT); z += vz * DT
    }
    if (i % 2 === 0) datos.push(x, y, z, a)
  }
  return { datos, paso: DT * 2, botes }
}

// La esfera: de fuera de cuadro a la cabeza en `golpe` segundos, con un poco
// de arco, y del golpe hacia atrás y hacia la cámara, rebotando hasta quedarse
// en el piso.
function simularOrbe(golpe, impacto, suelo) {
  const datos = []
  const botes = []
  const pasos = Math.round(golpe / DT)
  for (let i = 0; i <= pasos; i++) {
    const s = i / pasos
    if (i % 2 === 0) {
      datos.push(
        lerp(ORBE_SALE.x, impacto.x, s),
        lerp(ORBE_SALE.y, impacto.y, s) + 0.3 * 4 * s * (1 - s),
        lerp(ORBE_SALE.z, impacto.z, s),
        0,
      )
    }
  }
  let x = impacto.x, y = impacto.y, z = impacto.z
  let vx = ORBE_REBOTA.vx, vy = ORBE_REBOTA.vy, vz = ORBE_REBOTA.vz
  for (let i = pasos + 1, t = 0; t < 5; i++, t += DT) {
    vy -= G * DT
    x += vx * DT; y += vy * DT; z += vz * DT
    if (y <= suelo && vy < 0) {
      y = suelo
      const fuerza = -vy
      if (fuerza > 0.4) botes.push({ t: golpe + t, fuerza: Math.min(1, fuerza / 4) })
      vy = fuerza > 0.8 ? fuerza * 0.55 : 0
      vx *= 0.85; vz *= 0.85
    }
    if (y <= suelo + 1e-4 && vy === 0) { const f = Math.exp(-0.9 * DT); vx *= f; vz *= f }
    if (i % 2 === 0) datos.push(x, y, z, 0)
  }
  return { datos, paso: DT * 2, botes }
}

// Piezas rígidas en el cuello. Hay vértices que reparten su peso entre el
// cuello y la cabeza; al despegar la cabeza, esa vértebra se estiraba como
// chicle hasta el piso (Oscar). Cada pieza (vértices unidos por triángulos o
// por estar en el mismo lugar, como en las costuras) se va completa con la
// cabeza o con el cuello, según de cuál tenga más peso: lo mismo que hace el
// desarme del rayo (characterPieces.js). Se calcula una vez, al crear el
// numerito, y se pone solo mientras dura.
function piezasRigidas(personaje, cabeza, cuello) {
  const enCabeza = new Set()
  cabeza.traverse((o) => { if (o.isBone) enCabeza.add(o) })
  const cambios = []
  personaje.traverse((m) => {
    if (!m.isSkinnedMesh) return
    const g = m.geometry
    const si = g.getAttribute('skinIndex')
    const sw = g.getAttribute('skinWeight')
    const pos = g.getAttribute('position')
    const huesosMalla = m.skeleton?.bones
    if (!si || !sw || !pos || !huesosMalla) return
    const esCabeza = huesosMalla.map((b) => enCabeza.has(b))
    const iCabeza = huesosMalla.indexOf(cabeza)
    const iCuello = huesosMalla.indexOf(cuello)
    const n = si.count
    const pesoCabeza = new Float32Array(n)
    let mixtos = false
    for (let v = 0; v < n; v++) {
      let w = 0
      for (let k = 0; k < 4; k++) if (esCabeza[si.getComponent(v, k)]) w += sw.getComponent(v, k)
      pesoCabeza[v] = w
      if (w > 0.001 && w < 0.999) mixtos = true
    }
    if (!mixtos || iCabeza < 0 || iCuello < 0) return

    const padre = new Int32Array(n)
    for (let v = 0; v < n; v++) padre[v] = v
    const raiz = (v) => { while (padre[v] !== v) { padre[v] = padre[padre[v]]; v = padre[v] } return v }
    const une = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b }
    const idx = g.getIndex()
    if (idx) {
      for (let t = 0; t < idx.count; t += 3) { une(idx.getX(t), idx.getX(t + 1)); une(idx.getX(t), idx.getX(t + 2)) }
    } else {
      for (let t = 0; t + 2 < n; t += 3) { une(t, t + 1); une(t, t + 2) }
    }
    const enSitio = new Map()
    for (let v = 0; v < n; v++) {
      const clave = `${Math.round(pos.getX(v) * 1e4)},${Math.round(pos.getY(v) * 1e4)},${Math.round(pos.getZ(v) * 1e4)}`
      const otro = enSitio.get(clave)
      if (otro === undefined) enSitio.set(clave, v)
      else une(v, otro)
    }
    const suma = new Map()
    const cuenta = new Map()
    const conMixtos = new Set()
    for (let v = 0; v < n; v++) {
      const rz = raiz(v)
      suma.set(rz, (suma.get(rz) || 0) + pesoCabeza[v])
      cuenta.set(rz, (cuenta.get(rz) || 0) + 1)
      if (pesoCabeza[v] > 0.001 && pesoCabeza[v] < 0.999) conMixtos.add(rz)
    }
    if (!conMixtos.size) return

    // La geometría es la del GLB, compartida con los demás Skulleys (el del
    // home, detrás): no se toca. Se arma una aparte que comparte todo menos
    // los pesos, y se intercambia en la malla mientras dura el numerito.
    const siR = si.clone()
    const swR = sw.clone()
    for (let v = 0; v < n; v++) {
      const rz = raiz(v)
      if (!conMixtos.has(rz)) continue
      const aCabeza = suma.get(rz) / cuenta.get(rz) >= 0.5
      let total = 0
      for (let k = 0; k < 4; k++) {
        if (esCabeza[siR.getComponent(v, k)] === aCabeza) total += swR.getComponent(v, k)
        else swR.setComponent(v, k, 0)
      }
      if (total > 1e-4) {
        for (let k = 0; k < 4; k++) swR.setComponent(v, k, swR.getComponent(v, k) / total)
      } else {
        siR.setComponent(v, 0, aCabeza ? iCabeza : iCuello)
        swR.setComponent(v, 0, 1)
        for (let k = 1; k < 4; k++) swR.setComponent(v, k, 0)
      }
    }
    const rigida = new THREE.BufferGeometry()
    for (const [nombre, attr] of Object.entries(g.attributes)) {
      rigida.setAttribute(nombre, nombre === 'skinIndex' ? siR : nombre === 'skinWeight' ? swR : attr)
    }
    rigida.morphAttributes = g.morphAttributes
    rigida.morphTargetsRelative = g.morphTargetsRelative
    rigida.setIndex(g.getIndex())
    for (const gr of g.groups) rigida.addGroup(gr.start, gr.count, gr.materialIndex)
    rigida.boundingBox = g.boundingBox
    rigida.boundingSphere = g.boundingSphere
    cambios.push({ malla: m, original: g, rigida })
  })
  return {
    poner: () => { for (const c of cambios) c.malla.geometry = c.rigida },
    quitar: () => { for (const c of cambios) c.malla.geometry = c.original },
    piezas: cambios.length,
    geometria: (m) => cambios.find((c) => c.malla === m)?.rigida || m.geometry,
  }
}

// ── Los puntos de contacto ────────────────────────────────────────────────
// Nada atraviesa el piso (Oscar, 2026-11-12: "es muy obvio para el espectador
// que eso es un error"). Lo único que puede tocar el piso son los pies, la
// cabeza (con su quijada) y los dedos de las manos. De cada hueso de esas
// partes se guarda una muestra pareja de sus vértices (la malla es tan densa
// que el más bajo de la muestra queda a menos de la holgura del verdadero),
// cada uno con su piel completa: los huesos que lo mueven y cuánto, así su
// altura en cualquier pose es exacta. Se arman al montar en ratos libres, un
// hueso a la vez para que ninguno tarde.
const MUESTRA = { pieL: 400, pieR: 400, cabeza: 1200, manoL: 150, manoR: 150, antebrazoL: 200, antebrazoR: 200, torso: 600, cadera: 400, musloL: 300, musloR: 300 }

// partes: { nombre: hueso raíz }. Entrega { nombre: [puntos] } por `listo`.
function armarPuntosDeContacto(personaje, partes, geometria, listo) {
  const parteDe = new Map()
  for (const [nombre, raiz] of Object.entries(partes)) raiz?.traverse((o) => { if (o.isBone) parteDe.set(o, nombre) })
  const puntos = Object.fromEntries(Object.keys(partes).map((n) => [n, []]))
  const tareas = []

  // Qué vértices de la malla mueve más que ningún otro cada hueso de esas
  // partes; cada hueso queda como una tarea.
  const repartir = (malla) => {
    const g = geometria(malla)
    const pos = g.getAttribute('position')
    const si = g.getAttribute('skinIndex')
    const sw = g.getAttribute('skinWeight')
    const huesos = malla.skeleton.bones
    if (!pos || !si || !sw || !huesos.some((hb) => parteDe.has(hb))) return
    // Directo del arreglo (con getComponent una malla de 17 mil vértices
    // tardaba): para comparar pesos no hace falta normalizarlos.
    const directo = !si.isInterleavedBufferAttribute && !sw.isInterleavedBufferAttribute
    const siA = si.array, swA = sw.array
    const porHueso = new Map()
    for (let i = 0; i < pos.count; i++) {
      let b
      if (directo) {
        const o = i * 4
        let k = o
        if (swA[o + 1] > swA[k]) k = o + 1
        if (swA[o + 2] > swA[k]) k = o + 2
        if (swA[o + 3] > swA[k]) k = o + 3
        b = siA[k]
      } else {
        let k = 0
        for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j
        b = si.getComponent(i, k)
      }
      if (!parteDe.has(huesos[b])) continue
      let lista = porHueso.get(b)
      if (!lista) porHueso.set(b, (lista = []))
      lista.push(i)
    }
    for (const [b, vertices] of porHueso) tareas.push(() => muestrear(malla, pos, si, sw, b, vertices))
  }

  // La muestra de un hueso. Con el bind "attached" de three: mundo =
  // Σ peso · hueso.matrixWorld · boneInverse · bindMatrix · posición; aquí se
  // guarda boneInverse · bindMatrix · posición de cada hueso que lo mueve.
  const muestrear = (malla, pos, si, sw, b, vertices) => {
    const huesos = malla.skeleton.bones
    const parte = parteDe.get(huesos[b])
    const aHueso = new Map()
    const paso = Math.max(1, vertices.length / MUESTRA[parte])
    for (let f = 0; f < vertices.length; f += paso) {
      const i = vertices[Math.floor(f)]
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const punto = { huesos: [], pesos: [], pos: [] }
      let total = 0
      for (let k = 0; k < 4; k++) total += sw.getComponent(i, k)
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k)
        if (w <= 1e-3) continue
        const h = si.getComponent(i, k)
        let e = aHueso.get(h)
        if (!e) aHueso.set(h, (e = new THREE.Matrix4().multiplyMatrices(malla.skeleton.boneInverses[h], malla.bindMatrix).elements))
        punto.huesos.push(huesos[h])
        punto.pesos.push(w / total)
        punto.pos.push(
          e[0] * x + e[4] * y + e[8] * z + e[12],
          e[1] * x + e[5] * y + e[9] * z + e[13],
          e[2] * x + e[6] * y + e[10] * z + e[14],
        )
      }
      puntos[parte].push(punto)
    }
  }

  personaje.traverse((m) => { if (m.isSkinnedMesh && m.skeleton) tareas.push(() => repartir(m)) })
  const t0 = performance.now()
  let tardeMax = 0
  let terminado = false
  // Una tarea; false cuando ya no queda ninguna.
  const una = () => {
    const tarea = tareas.shift()
    if (!tarea) {
      if (!terminado) { terminado = true; listo(puntos, { totalMs: performance.now() - t0, tareaMasLentaMs: tardeMax }) }
      return false
    }
    const t1 = performance.now()
    try { tarea() } catch { }
    tardeMax = Math.max(tardeMax, performance.now() - t1)
    return true
  }
  const ratoLibre = window.requestIdleCallback || ((f) => setTimeout(() => f({ timeRemaining: () => 8 }), 16))
  const siguiente = () => ratoLibre((plazo) => {
    while (una()) if (plazo.timeRemaining() <= 4) { siguiente(); return }
  }, { timeout: 100 })
  siguiente()
  // Si el numerito arranca antes de que acaben (un teléfono muy ocupado), se
  // terminan de un jalón: nunca corre sin ellos.
  return () => { while (una()); }
}

// El punto más bajo (y en mundo) de una lista de puntos de contacto: por cada
// uno, Σ peso · (fila y de la matriz de su hueso · su posición en ese hueso).
// Dónde está un punto de la muestra en mundo, con su piel.
function puntoDe({ huesos, pesos, pos }, out) {
  out.set(0, 0, 0)
  for (let k = 0; k < huesos.length; k++) {
    const e = huesos[k].matrixWorld.elements
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2]
    out.x += pesos[k] * (e[0] * x + e[4] * y + e[8] * z + e[12])
    out.y += pesos[k] * (e[1] * x + e[5] * y + e[9] * z + e[13])
    out.z += pesos[k] * (e[2] * x + e[6] * y + e[10] * z + e[14])
  }
  return out
}
const _pm = new THREE.Vector3()
// Lo más lejos que llega la forma desde `centro` en la dirección `dir`.
function extremoEn(lista, dir, centro) {
  let max = -Infinity
  for (const m of lista) {
    const d = puntoDe(m, _pm).sub(centro).dot(dir)
    if (d > max) max = d
  }
  return max
}
// El giro de un cuaternión local alrededor del eje del hueso (y).
const giroY = (q) => 2 * Math.atan2(q.y, q.w)
// Lo más que la mano gira sobre el eje del antebrazo respecto a como la trae
// la animación (radianes). Con más, los huesos de giro del antebrazo
// estrangulaban la malla y se veía flaco a la mitad (Oscar: nada de mallas que
// se adelgacen o deformen; mejor doblar como manguera que torcer). La mano
// conserva hacia dónde apunta y solo pierde lo que se pasaba del giro.
// El tope es suave y sin saltos: con un tope duro, cuando lo que pedía la pose
// cruzaba media vuelta la mano brincaba de un lado al otro (Oscar: "brincos o
// teletransportes"); así, cerca de media vuelta regresa sola a la de la animación.
const GIRO_MANO_MAX = 1.0
const _qGiro = new THREE.Quaternion()
const _qSwing = new THREE.Quaternion()
function limitarGiro(q, q0) {
  if (Math.hypot(q.y, q.w) < 1e-4) return
  const d = giroY(q) - giroY(q0)
  const th = giroY(q0) + GIRO_MANO_MAX * Math.tanh(Math.sin(d) / GIRO_MANO_MAX)
  _qGiro.set(0, q.y, 0, q.w).normalize()
  _qSwing.copy(q).multiply(_qGiro.invert())
  q.copy(_qSwing).multiply(_qGiro.set(0, Math.sin(th / 2), 0, Math.cos(th / 2)))
}
// Slerp sin buscar el camino corto: el que tome lo deciden los signos de los
// dos cuaterniones (el corto cambia de lado de golpe cerca de media vuelta).
function slerpDirecto(q, b, t) {
  const c = Math.min(1, Math.max(-1, q.dot(b)))
  const th = Math.acos(c)
  const sn = Math.sin(th)
  const [wa, wb] = sn < 1e-5 ? [1 - t, t] : [Math.sin((1 - t) * th) / sn, Math.sin(t * th) / sn]
  return q.set(q.x * wa + b.x * wb, q.y * wa + b.y * wb, q.z * wa + b.z * wb, q.w * wa + b.w * wb).normalize()
}
// El hueso que más pesa en un punto de la muestra.
const huesoDe = (m) => m.huesos[m.pesos.indexOf(Math.max(...m.pesos))]

function bajoDe(lista) {
  let min = Infinity
  for (const { huesos, pesos, pos } of lista) {
    let y = 0
    for (let k = 0; k < huesos.length; k++) {
      const e = huesos[k].matrixWorld.elements
      y += pesos[k] * (e[1] * pos[k * 3] + e[5] * pos[k * 3 + 1] + e[9] * pos[k * 3 + 2] + e[13])
    }
    if (y < min) min = y
  }
  return min
}


// `idle` y `camina`: las acciones del mixer (se mezclan aquí). `orbe`: la
// malla de la esfera, hija del contenedor del rig (se mueve en su espacio).
// `alPatear(posicion)`: cuando la patada suelta la cabeza, con dónde está (en
// mundo): el rig saca ahí el humo del estallido del rayo (Oscar).
export function crearNumerito(personaje, { idle, camina, orbe, alPatear } = {}) {
  // El BONK se baja y se decodifica desde ya: si no, el primero llegaba tarde al golpe.
  preloadSfx(['bonk'])
  const h = (n) => personaje.getObjectByName(n)
  const huesos = {
    cuello: h('neckx'),
    cabeza: h('headx'),
    quijada: h('c_jawbonex'),
    spine_01x: h('spine_01x'),
    spine_02x: h('spine_02x'),
    spine_03x: h('spine_03x'),
    brazoL: h('arm_stretchl'), antebrazoL: h('forearm_stretchl'), manoL: h('handl'),
    brazoR: h('arm_stretchr'), antebrazoR: h('forearm_stretchr'), manoR: h('handr'),
    // Los que tuercen el antebrazo (hermanos de la mano: girar la mano sola
    // estrangula la muñeca).
    giroL: h('forearm_twistl'), giroL2: h('forearm_twist_2l'), giroR: h('forearm_twistr'), giroR2: h('forearm_twist_2r'),
    musloL: h('thigh_stretchl'), piernaL: h('leg_stretchl'), pieL: h('footl'),
    musloR: h('thigh_stretchr'), piernaR: h('leg_stretchr'), pieR: h('footr'),
    rootx: h('rootx'),
  }
  if (Object.values(huesos).some((b) => !b)) return null
  // Las falanges que se cierran al agarrar (del pulgar, las dos de la punta).
  const falanges = (l) => ['index1', 'index2', 'index3', 'middle1', 'middle2', 'middle3', 'pinky1', 'pinky2', 'pinky3', 'thumb2', 'thumb3'].map((n) => h(n + l))
  const dedos = { L: falanges('l'), R: falanges('r') }
  if ([...dedos.L, ...dedos.R].some((b) => !b)) return null
  const rigidas = piezasRigidas(personaje, huesos.cabeza, huesos.cuello)
  let contacto = null
  // Las partes de después se quedan con los huesos de su árbol: la cadera (el
  // árbol entero) se queda con la pelvis, el torso (que trae brazos y cabeza)
  // con la columna y los hombros, cada muslo con fémur y espinilla, y los
  // antebrazos antes que las manos.
  const terminarContacto = armarPuntosDeContacto(personaje, {
    cadera: huesos.rootx, torso: huesos.spine_01x, musloL: huesos.musloL, musloR: huesos.musloR,
    pieL: huesos.pieL, pieR: h('footr'), cabeza: huesos.cabeza,
    antebrazoL: huesos.antebrazoL, antebrazoR: huesos.antebrazoR, manoL: huesos.manoL, manoR: huesos.manoR,
  }, rigidas.geometria, (p, tiempos) => {
    contacto = { ...p, pies: p.pieL.concat(p.pieR), brazoL: p.antebrazoL.concat(p.manoL), brazoR: p.antebrazoR.concat(p.manoR) }
    if (import.meta.env.DEV) console.debug(`[numerito] puntos de contacto ${JSON.stringify({ cabeza: p.cabeza.length, pies: contacto.pies.length, manos: p.manoL.length + p.manoR.length, total: Math.round(tiempos.totalMs), tareaMasLenta: +tiempos.tareaMasLentaMs.toFixed(1) })}`)
  })
  // El brazo derecho no la sigue: va atrás para equilibrarse (abajo, con IK).
  // Desde el brazo de la patada, que va al frente, la IK quedaba casi en media
  // vuelta y el antebrazo se torcía de golpe.
  const piernaPatada = [huesos.musloL, huesos.piernaL, huesos.pieL]
  const patadaHuesos = KICK_BONES.filter((n) => !['headx', 'arm_stretchr', 'forearm_stretchr', 'handr'].includes(n))
    .map((n) => [h(n), KICK_A[n], KICK_B[n]])
    .filter(([b]) => b)

  // La pose del mixer, hueso por hueso. three solo reescribe un hueso cuando
  // el valor de la animación cambia de un cuadro a otro: lo que se le pone
  // encima se queda pegado si la pista no se mueve (así se quedó la cabeza de
  // lado al saltar la historia, Oscar). Cada cuadro se compara con lo que se
  // escribió en el anterior: si sigue igual, el mixer no pasó y se regresa a
  // su pose antes de volver a mover; al terminar, igual.
  const tocados = [
    huesos.cabeza, huesos.quijada, huesos.spine_01x, huesos.spine_02x, huesos.spine_03x,
    huesos.brazoL, huesos.antebrazoL, huesos.brazoR, huesos.antebrazoR, huesos.musloL, huesos.piernaL,
    huesos.manoL, huesos.manoR, huesos.giroL, huesos.giroL2, huesos.giroR, huesos.giroR2,
  ]
  for (const [b] of patadaHuesos) if (!tocados.includes(b)) tocados.push(b)
  if (!tocados.includes(huesos.rootx)) tocados.push(huesos.rootx)
  for (const b of [huesos.musloR, huesos.piernaR, huesos.pieL, huesos.pieR, huesos.cuello, ...dedos.L, ...dedos.R]) if (!tocados.includes(b)) tocados.push(b)
  const nuevaPose = () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() })
  const delMixer = tocados.map(nuevaPose)
  const escrita = tocados.map(nuevaPose)
  let hayEscrita = false
  // Cada propiedad por separado: el mixer puede reescribir el giro de un hueso
  // y no su posición (no trae pista de posición). Juntas, una posición puesta
  // aquí se tomaba como del mixer al cuadro siguiente y se acumulaba (las
  // piezas despegadas del estirón se iban al infinito).
  const PROPS = [['position', 'p'], ['quaternion', 'q'], ['scale', 's']]
  const copiar = (e, b) => { e.p.copy(b.position); e.q.copy(b.quaternion); e.s.copy(b.scale) }
  function partirDelMixer() {
    tocados.forEach((b, i) => {
      for (const [k, c] of PROPS) {
        if (hayEscrita && b[k].equals(escrita[i][c])) b[k].copy(delMixer[i][c])
        else delMixer[i][c].copy(b[k])
      }
    })
  }
  function reponer() {
    if (!hayEscrita) return
    tocados.forEach((b, i) => {
      for (const [k, c] of PROPS) if (b[k].equals(escrita[i][c])) b[k].copy(delMixer[i][c])
    })
    hayEscrita = false
  }

  let centroLocal = null // el centro del cráneo, en el espacio del hueso de la cabeza
  let derechaCabeza = null // la derecha de la cara, en el espacio del hueso de la cabeza
  // El cráneo como elipsoide en el espacio del hueso de la cabeza (sin la
  // quijada ni el pelo) y, de cada mano, el centro de la palma en su espacio:
  // se miden una vez de la muestra de vértices.
  let craneo = null
  const palmas = new Map()
  let estado = null // la física, el camino y los sonidos de esta función
  // Lo de la última función, por historia: al regresar con la barra (o pasar
  // otra vez por el numerito) se repite igual, como un video (Oscar). La
  // física sale de la pose del cuadro en que se calcula y cambiaría cada vez.
  let guardado = null
  let activo = false
  let tPrevio = 0
  let faseCamina = 0

  // Dónde va el cuerpo (en el espacio del rig), hacia dónde mira (giro sobre
  // su eje; 0 = a la cámara) y cuánto camina y a qué paso.
  function cuerpoEn(t) {
    const N = NUMERITO
    const e = estado
    const llega = e?.llega || { x: IDA, z: 0 }
    const parada = e?.parada || llega
    const psi1 = e?.psi1 ?? Math.PI / 2
    const psi2 = e?.psi2 ?? psi1
    let x = 0, z = 0, y = 0, psi = 0, vel = 0, paso = 0
    // Los pasos en su lugar al voltearse: arrancan y terminan sin golpe (con
    // el seno simple entraban de golpe y la rodilla brincaba).
    const enSitio = (u) => 0.5 * Math.sin(Math.PI * u) ** 2
    if (t >= N.golpe && t < N.despiste) {
      // El golpe lo empuja (la cadera, el torso y el pie en el aire; moviendo
      // el cuerpo entero los pies patinaban).
      x = 0
    } else if (t >= N.despiste && t < N.giro1) {
      const u = tramo(t, N.despiste, N.giro1)
      psi = -Math.PI / 2 * suave(u)
      paso = enSitio(u)
    } else if (t >= N.giro1 && t < N.camina1) {
      const u = tramo(t, N.giro1, N.camina1)
      x = IDA * trapecio(u)
      psi = -Math.PI / 2
      vel = (Math.abs(IDA) * trapecioVel(u)) / (N.camina1 - N.giro1)
    } else if (t >= N.camina1 && t < N.pausa) {
      x = IDA
      psi = -Math.PI / 2
    } else if (t >= N.pausa && t < N.giro2) {
      // La cadera gira con los pasos; los pies los lleva el giro, no la caminata.
      const u = tramo(t, N.pausa, N.giro2)
      x = IDA
      psi = lerp(-Math.PI / 2, psi1, vueltaCadera(u))
    } else if (t >= N.giro2 && t < N.llega) {
      const u = tramo(t, N.giro2, N.llega)
      const f = trapecio(u)
      x = lerp(IDA, llega.x, f)
      z = lerp(0, llega.z, f)
      psi = psi1
      vel = (Math.hypot(llega.x - IDA, llega.z) * trapecioVel(u)) / (N.llega - N.giro2)
    } else if (t >= N.llega && t < N.giro3) {
      x = llega.x
      z = llega.z
      psi = psi1
      // Brinca en un pie del dolor mientras lo muerde: tres brincos que
      // terminan en el piso (cortado a media subida, caía de golpe).
      // El primero, más alto y tieso: el susto de la mordida.
      if (t >= N.muerde && t < N.muerde + BRINCOS / BRINCO_HZ) y = 0.035 * Math.abs(Math.sin(Math.PI * BRINCO_HZ * (t - N.muerde))) * (t - N.muerde < 1 / BRINCO_HZ ? 2.2 : 1)
    } else if (t >= N.giro3 && t < N.camina3) {
      const u = tramo(t, N.giro3, N.camina3)
      const f = trapecio(u)
      x = lerp(llega.x, parada.x, f)
      z = lerp(llega.z, parada.z, f)
      psi = lerp(psi1, psi2, suave(clamp01(u * 3)))
      vel = (Math.hypot(parada.x - llega.x, parada.z - llega.z) * trapecioVel(u)) / (N.camina3 - N.giro3)
    } else if (t >= N.camina3) {
      x = parada.x
      z = parada.z
      const u = tramo(t, N.suelta, N.deFrente)
      psi = lerp(psi2, 0, suave(u))
      if (u > 0 && u < 1) paso = enSitio(u)
    }
    let escala = 0.8
    if (vel > 0) {
      // La caminata se mezcla con el idle según la velocidad; con 0.35 el
      // cambio al pararse duraba ~0.12 s a media zancada y rodillas y manos
      // brincaban.
      paso = suave(clamp01(vel / 0.7))
      escala = Math.min(1.4, Math.max(0.4, vel / PASO_VEL))
    }
    return { x, y, z, psi, paso, escala }
  }

  function arrancar(rig, fit, idleCentro, t, historia) {
    if (!contacto) terminarContacto()
    rigidas.poner()
    if (camina) {
      camina.reset()
      camina.setEffectiveWeight(0)
      camina.play()
    }
    // Los sonidos que ya pasaron no suenan al arrancar a media función.
    tPrevio = t
    if (historia != null && guardado?.historia === historia) {
      estado = guardado.estado
      for (const ev of estado.eventos) ev.hecho = ev.t <= t - 0.25
      return
    }
    const radio = fit.alto * RADIO_CRANEO
    const centroRig = rig.worldToLocal(idleCentro.clone())
    // La esfera llega por la izquierda: toca el cráneo por ese lado.
    const lado = ORBE_SALE.clone().sub(centroRig).normalize()
    const impacto = centroRig.clone().addScaledVector(lado, radio + RADIO_ORBE)
    const orbeSim = simularOrbe(NUMERITO.golpe, impacto, fit.piso + RADIO_ORBE)
    const N = NUMERITO
    estado = {
      radio,
      orbeSim,
      cabezaSim: null,
      cabezaSim2: null,
      q0: null,
      relPierna: null,
      eventos: [
        { t: 0.02, hacer: () => playOrbKick(0.7) },
        // El madrazo suena a BONK de caricatura (public/fx/bonk.mp3, el que
        // consiguió Oscar; el sintetizado no le gustó).
        { t: N.golpe, hacer: () => { playSfx('bonk'); playEyePop() } },
        // El ñam y los quejidos de hule mientras lo muerde.
        { t: N.muerde, hacer: () => { playOrbHit(0.9, 0.1); playEyePoke(0) } },
        { t: N.muerde + 0.3, hacer: () => playEyePoke(1) },
        { t: N.muerde + 0.55, hacer: () => playEyePoke(2) },
        { t: N.muerde + 0.8, hacer: () => playEyePoke(3) },
        { t: N.patada + PATADA.suelta, hacer: () => { playOrbKick(1); playEyePop(); alPatear?.(huesos.cabeza.getWorldPosition(new THREE.Vector3())) } },
        { t: N.tronido - 0.08, hacer: () => playEyeRespawn() },
        ...orbeSim.botes.map((b) => ({ t: b.t, hacer: () => playOrbBounce(b.fuerza * 0.8, 0.18) })),
      ],
    }
    guardado = historia != null ? { historia, estado } : null
  }

  // `t`: segundos desde que arrancó. `rig`: el contenedor que gira con la
  // cámara. `fit`: medidas del personaje (alto, piso, headY). Devuelve a dónde
  // debe apuntar el foco (en mundo).
  function aplicar(t, rig, fit, historia) {
    const N = NUMERITO
    partirDelMixer()
    const alto = fit.alto

    // ── El cuerpo: dónde va y hacia dónde mira ────────────────────────────
    const cuerpo = cuerpoEn(t)
    personaje.position.set(cuerpo.x, cuerpo.y, cuerpo.z)
    personaje.rotation.set(0, cuerpo.psi, 0)
    rig.updateMatrixWorld(true)
    const rigQ = rig.getWorldQuaternion(new THREE.Quaternion())
    const rigQi = rigQ.clone().invert()
    const cuerpoQ = personaje.getWorldQuaternion(new THREE.Quaternion())
    const derecha = EJE_X.clone().applyQuaternion(cuerpoQ)
    const arriba = EJE_Y.clone().applyQuaternion(cuerpoQ)
    const adelante = EJE_Z.clone().applyQuaternion(cuerpoQ)
    const delCuerpo = (x, y, z) => personaje.localToWorld(new THREE.Vector3(x, y, z))

    // ── La cabeza puesta según el idle de este cuadro ─────────────────────
    const cab = huesos.cabeza
    const idleLocal = new THREE.Matrix4().compose(cab.position, cab.quaternion, cab.scale)
    const idleMundo = new THREE.Matrix4().multiplyMatrices(huesos.cuello.matrixWorld, idleLocal)
    const idleQ = new THREE.Quaternion()
    idleMundo.decompose(_v1, idleQ, _s)
    const escala = _s.clone()
    if (!centroLocal) {
      // El centro del cráneo, entre el cuello y la cara, y la derecha de la
      // cara, medidos una vez en el espacio del cuerpo (así no importa dónde
      // esté parado).
      const origen = personaje.worldToLocal(new THREE.Vector3().setFromMatrixPosition(idleMundo))
      centroLocal = delCuerpo(0, fit.headY + alto * 0.02, origen.z).applyMatrix4(idleMundo.clone().invert())
      derechaCabeza = derecha.clone().applyQuaternion(idleQ.clone().invert())
    }
    const idleCentro = centroLocal.clone().applyMatrix4(idleMundo)

    if (!activo) { activo = true; arrancar(rig, fit, idleCentro, t, historia) }
    const e = estado
    if (!e.cabezaSim && t >= N.golpe) {
      // La cabeza sale volando desde donde está justo al golpe.
      const p0 = rig.worldToLocal(idleCentro.clone())
      e.q0 = rigQi.clone().multiply(idleQ)
      e.cabezaSim = simularCabeza(p0, fit.piso + e.radio, e.radio)
      for (const b of e.cabezaSim.botes) e.eventos.push({ t: N.golpe + b.t, hacer: () => playOrbBounce(b.fuerza, 0.45) })
      // Se para con la cabeza enfrente de su espinilla izquierda.
      const fin = muestra(e.cabezaSim, 99)
      e.psi1 = Math.atan2(fin.x - IDA, fin.z)
      const fx = Math.sin(e.psi1), fz = Math.cos(e.psi1) // hacia donde mira
      const ix = Math.cos(e.psi1), iz = -Math.sin(e.psi1) // su izquierda
      e.llega = {
        x: fin.x - fx * MORDIDA.adelante - ix * MORDIDA.lado,
        z: fin.z - fz * MORDIDA.adelante - iz * MORDIDA.lado,
      }
    }

    // ── La pierna: del dolor la sacude con la cabeza colgando… ────────────
    // Con la cabeza colgando, la pierna no regresa al piso: la sacudida la
    // sostiene hasta que la patada ya la tomó completa. Una sacudida por
    // brinco, al ritmo del cuerpo (vibrando a 7 y 9 Hz se veía de máquina), y
    // más calmada cuando deja de brincar, justo antes de patear.
    const dolor = t - N.muerde
    const ritmo = Math.PI * BRINCO_HZ * dolor
    const agita = dolor < 0 ? 0 : 1 - 0.6 * suave(tramo(dolor, BRINCOS / BRINCO_HZ - 0.1, BRINCOS / BRINCO_HZ + 0.05))
    const pesoPierna = suave(tramo(t, N.muerde, N.muerde + 0.15)) * (1 - suave(tramo(t, N.patada, N.patada + 0.1)))
    if (pesoPierna > 0.001) {
      const sacude = delCuerpo(
        0.14 + 0.025 * agita * Math.sin(2 * ritmo + 0.9),
        0.25 + 0.05 * agita * Math.sin(2 * ritmo),
        0.15 + 0.07 * agita * Math.sin(2 * ritmo - 0.7),
      )
      const cadera = huesos.musloL.getWorldPosition(new THREE.Vector3())
      const rodilla = cadera.addScaledVector(adelante, 0.6 * alto).addScaledVector(arriba, -0.1 * alto)
      ik(huesos.musloL, huesos.piernaL, huesos.pieL, sacude, rodilla, pesoPierna)
    }

    // …y la patea con la patada del juego (kickPose.js, posada en el Pose
    // Studio; Oscar: la de IK se veía chafa). Patea con la izquierda, la misma
    // que muerde. Igual que en Player.jsx: recoge, latigazo, aguanta y regresa,
    // con el peso de la cadera. La cabeza no entra: va suelta.
    const patada = pesoPatada(t)
    if (patada.W > 0.001) {
      for (const [hueso, a, b] of patadaHuesos) {
        _q1.copy(a).slerp(b, patada.P)
        // El muslo que sacude la cabeza queda a media vuelta de la pose de la
        // patada: el camino corto cambiaba de lado a media mezcla y la pierna
        // brincaba (medido). Va siempre por el lado de la pose de la animación.
        // Solo en la pierna que patea: en el brazo, el mismo criterio cambiaba
        // de lado a media patada (medido).
        if (piernaPatada.includes(hueso)) {
          const m = delMixer[tocados.indexOf(hueso)].q
          if (_q1.dot(m) * hueso.quaternion.dot(m) < 0) _q1.set(-_q1.x, -_q1.y, -_q1.z, -_q1.w)
          slerpDirecto(hueso.quaternion, _q1, patada.W)
        } else hueso.quaternion.slerp(_q1, patada.W)
      }
      if (huesos.rootx) huesos.rootx.position.add(_v1.copy(KICK_ROOT_A).lerp(KICK_ROOT_B, patada.P).multiplyScalar(patada.W))
      personaje.updateMatrixWorld(true)
    }

    // ── En cuclillas para levantar la cabeza ──────────────────────────────
    const cuclillas = suave(tramo(t, N.camina3 + 0.1, N.agachado)) * (1 - suave(tramo(t, N.agarra + 0.1, N.enPecho + 0.15)))
    if (cuclillas > 0.001) {
      const pies = [[huesos.musloL, huesos.piernaL, huesos.pieL], [huesos.musloR, huesos.piernaR, huesos.pieR]].map(([muslo, pierna, pie]) => ({
        muslo, pierna, pie, p: pie.getWorldPosition(new THREE.Vector3()), q: pie.getWorldQuaternion(new THREE.Quaternion()),
      }))
      const r = huesos.rootx.getWorldPosition(new THREE.Vector3())
      r.y -= alto * CUCLILLAS.baja * cuclillas
      huesos.rootx.position.copy(huesos.rootx.parent.worldToLocal(r))
      huesos.rootx.updateMatrixWorld(true)
      for (const { muslo, pierna, pie, p: donde, q } of pies) {
        // La rodilla parte de donde la trae la animación y se va hacia
        // adelante con las cuclillas: con el polo fijo adelante, al entrar y al
        // salir brincaba de un plano a otro (Oscar: "se teletransportan").
        const rodilla = pierna.getWorldPosition(new THREE.Vector3()).addScaledVector(adelante, 0.6 * alto * cuclillas)
        ik(muslo, pierna, pie, donde, rodilla, 1)
        pie.parent.getWorldQuaternion(_q3).invert().multiply(q)
        pie.quaternion.copy(_q3)
        pie.updateMatrixWorld(true)
      }
    }

    // ── Del madrazo, en un pie ────────────────────────────────────────────
    // La cadera se carga sobre el pie del lado al que iba la esfera (+x) y el
    // otro sube abierto, tambaleándose con el torso; los dos pies, donde estaban.
    const kG = t - N.golpe
    const [eq0, eq1, eq2, eq3] = EMPUJE.equilibrio
    const equilibrio = kG > 0 ? suave(tramo(kG, eq0, eq1)) * (1 - suave(tramo(kG, eq2, eq3))) : 0
    const empuja = kG > 0 ? EMPUJE.lado * Math.sin(EMPUJE.w * kG) * Math.exp(-EMPUJE.frena * kG) * (1 - suave(tramo(kG, 1.2, 1.6))) : 0
    if (equilibrio > 0.001) {
      const pies = [[huesos.musloL, huesos.piernaL, huesos.pieL, 0], [huesos.musloR, huesos.piernaR, huesos.pieR, 1]].map(([muslo, pierna, pie, sube]) => ({
        muslo, pierna, pie, sube,
        donde: pie.getWorldPosition(new THREE.Vector3()),
        q: pie.getWorldQuaternion(new THREE.Quaternion()),
        rodilla: pierna.getWorldPosition(new THREE.Vector3()).addScaledVector(adelante, 0.3 * alto * equilibrio),
      }))
      const r = huesos.rootx.getWorldPosition(new THREE.Vector3()).addScaledVector(derecha, EMPUJE.cadera * alto * equilibrio)
      huesos.rootx.position.copy(huesos.rootx.parent.worldToLocal(r))
      huesos.rootx.updateMatrixWorld(true)
      for (const { muslo, pierna, pie, sube, donde, q, rodilla } of pies) {
        const meta = donde.clone()
        if (sube) {
          meta.addScaledVector(derecha, -EMPUJE.abre * alto * equilibrio)
          meta.addScaledVector(arriba, EMPUJE.alza * alto * equilibrio * (1 + 2.5 * empuja))
        }
        ik(muslo, pierna, pie, meta, rodilla, 1)
        pie.parent.getWorldQuaternion(_q3).invert().multiply(q)
        pie.quaternion.copy(_q3)
        // El pie en el aire, con la punta un poco abajo.
        if (sube) pie.quaternion.multiply(_q4.setFromAxisAngle(EJE_X, 0.35 * equilibrio))
        pie.updateMatrixWorld(true)
      }
    }

    // ── La columna: el susto, la búsqueda, el dolor, agacharse ────────────
    const susto = t > N.golpe ? -0.55 * Math.exp(-5 * (t - N.golpe)) * Math.sin(Math.min(1, (t - N.golpe) * 10) * Math.PI / 2) : 0
    const tantea = 0.12 * Math.max(
      suave(tramo(t, N.despiste, N.giro1)) * (1 - suave(tramo(t, N.llega - 0.3, N.acecha))),
      suave(tramo(t, N.despiste2, N.giro3)) * (1 - suave(tramo(t, N.camina3 - 0.3, N.laVe))),
    )
    const dobla = suave(tramo(t, N.camina3, N.agachado)) * (1 - suave(tramo(t, N.agarra, N.enPecho))) * lerp(1, CUCLILLAS.espalda, cuclillas)
    // Del dolor se encorva un poco sobre la pierna mordida.
    const encorva = 0.16 * suave(tramo(t, N.muerde, N.muerde + 0.15)) * (1 - suave(tramo(t, N.patada - PATADA.antic, N.patada)))
    // Al tratar de ver se asoma un poco hacia adelante.
    const asoma = DUDA.asoma * suave(tramo(t, N.mira1, N.mira1 + 0.3)) * (1 - suave(tramo(t, N.duda, N.duda + 0.3)))
    const inclina = Math.max(tantea, dobla) + encorva + susto + asoma
    // El giro hacia la cabeza: el pecho primero (y antes, la anticipación).
    let giroTorso = 0
    if (e.psi1 != null && t >= N.pausa - 0.3 && t < N.giro2) {
      const vuelta = e.psi1 + Math.PI / 2
      const lado = Math.sign(vuelta) || 1
      const ug = tramo(t, N.pausa, N.giro2)
      // Tope suave (con un tope duro las manos daban un jalón al llegar a él).
      const gana = GIRO.adelanta * Math.tanh((vuelta * (vueltaPecho(ug) - vueltaCadera(ug))) / GIRO.adelanta)
      const antes = -lado * GIRO.anticipa * Math.sin(Math.PI * tramo(t, N.pausa - 0.3, N.pausa + 0.12)) ** 2
      giroTorso = gana + antes
    }
    if (t >= N.mira1 && t < N.confundido + 0.4) giroTorso += volteaDuda(t)
    let voltea = 0
    if (t < N.despiste) voltea = Math.sin(tramo(t, N.sacudida, N.despiste) * Math.PI * 2) * 0.32
    else if (t >= N.muerde && t < N.patada) voltea = 0.07 * agita * Math.sin(2 * ritmo + 1.2)
    else if (t >= N.sueltaPierna && t < N.giro3) voltea = Math.sin(tramo(t, N.sueltaPierna, N.despiste2) * Math.PI * 2) * 0.3

    for (const n of ['spine_01x', 'spine_02x', 'spine_03x']) {
      const b = huesos[n]
      b.getWorldQuaternion(_q1).invert()
      if (inclina) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(derecha).applyQuaternion(_q1), DOBLA[n] * inclina))
      if (empuja) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(adelante).applyQuaternion(_q1), -empuja / 3))
      if (n === 'spine_03x' && voltea) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(arriba).applyQuaternion(_q1), voltea))
      if (giroTorso) b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(arriba).applyQuaternion(_q1), giroTorso * TUERCE[n]))
      b.updateMatrixWorld(true)
    }

    // ── El pie de apoyo ───────────────────────────────────────────────────
    // Con la postura del idle el pie de apoyo quedaba 0.22 adelante de la
    // cadera, junto con la rodilla mordida, y la patada, que inclina la cadera,
    // lo arrastraba medio cuerpo hacia atrás (Oscar: las dos piernas adelante
    // no se ven naturales). Aquí va plantado debajo de la cadera desde el
    // primer brinco hasta que la patada regresa.
    const finPatada = N.patada - PATADA.antic + PATADA.dur
    const entraApoyo = suave(tramo(t, N.muerde + 0.02, N.muerde + 0.02 + APOYO.entra))
    const regresaApoyo = suave(tramo(t, finPatada, finPatada + APOYO.regresa))
    // Su altura y su giro del idle, en el espacio del cuerpo (el pie plano), se
    // toman parado quieto antes de la mordida: en cualquier otro cuadro puede
    // venir a media zancada.
    const tomarPie = () => {
      e.alturaPie = personaje.worldToLocal(huesos.pieR.getWorldPosition(new THREE.Vector3())).y
      e.pieRPlano = personaje.getWorldQuaternion(new THREE.Quaternion()).invert()
        .multiply(huesos.pieR.getWorldQuaternion(new THREE.Quaternion()))
    }
    if (t >= N.llega + 0.3 && t < N.muerde + 0.02) tomarPie()
    if (entraApoyo > 0 && regresaApoyo < 1) {
      if (e.alturaPie == null) tomarPie()
      const pie = personaje.worldToLocal(huesos.pieR.getWorldPosition(new THREE.Vector3()))
      const objetivo = pie.clone()
        .lerp(_v2.set(APOYO.x, e.alturaPie, APOYO.z), entraApoyo)
        .lerp(pie, regresaApoyo)
      objetivo.y += APOYO.paso * Math.sin(Math.PI * regresaApoyo)
      // La rodilla, del plano en que la trae la animación al de adelante con
      // el apoyo (con el polo fijo adelante brincaba al entrar y al salir).
      const poloR = huesos.piernaR.getWorldPosition(new THREE.Vector3()).lerp(huesos.musloR.getWorldPosition(new THREE.Vector3())
        .addScaledVector(adelante, 0.6 * alto)
        .addScaledVector(arriba, -0.1 * alto), entraApoyo * (1 - regresaApoyo))
      ik(huesos.musloR, huesos.piernaR, huesos.pieR, personaje.localToWorld(objetivo), poloR, 1)
      // Y plano en el piso: con la rodilla más doblada se quedaba de puntas y
      // el tobillo 0.15 arriba del piso.
      personaje.getWorldQuaternion(_q4).multiply(e.pieRPlano)
      huesos.pieR.parent.getWorldQuaternion(_q3).invert().multiply(_q4)
      huesos.pieR.quaternion.slerp(_q3, entraApoyo * (1 - regresaApoyo))
      huesos.pieR.updateMatrixWorld(true)
    }

    // ── El giro hacia la cabeza: pasos de verdad ──────────────────────────
    if (e.psi1 != null && t >= N.pausa && t < N.giro2) {
      const u = tramo(t, N.pausa, N.giro2)
      const psi0 = -Math.PI / 2
      const vuelta = e.psi1 - psi0
      const psiEn = (v) => psi0 + vuelta * vueltaCadera(v)
      const piernas = { L: [huesos.musloL, huesos.piernaL, huesos.pieL], R: [huesos.musloR, huesos.piernaR, huesos.pieR] }
      // Dónde va cada pie respecto al cuerpo, parado: se mide una vez.
      if (!e.postura) {
        const qi = personaje.getWorldQuaternion(new THREE.Quaternion()).invert()
        e.postura = {}
        for (const k of ['L', 'R']) {
          const pie = piernas[k][2]
          e.postura[k] = { p: personaje.worldToLocal(pie.getWorldPosition(new THREE.Vector3())), q: qi.clone().multiply(pie.getWorldQuaternion(new THREE.Quaternion())) }
        }
      }
      // El primer paso con el pie de adentro de la vuelta.
      const primero = vuelta > 0 ? 'L' : 'R'
      const otro = primero === 'L' ? 'R' : 'L'
      const pasosDe = { L: [], R: [] }
      GIRO.pasos.forEach(([a, b], k) => pasosDe[k % 2 === 0 ? primero : otro].push([a, b]))
      // La cadera baja en cada paso y se carga sobre el pie de apoyo.
      let baja = 0
      const carga = new THREE.Vector3()
      GIRO.pasos.forEach(([a, b], k) => {
        const sp = (u - a) / (b - a)
        if (sp <= 0 || sp >= 1) return
        const arco = Math.sin(Math.PI * sp)
        baja += arco
        const apoyo = (k % 2 === 0 ? otro : primero) === 'L' ? 1 : -1
        carga.addScaledVector(derecha, apoyo * GIRO.carga * alto * arco)
      })
      if (baja > 0) {
        const r = huesos.rootx.getWorldPosition(new THREE.Vector3()).add(carga)
        r.y -= GIRO.baja * alto * baja
        huesos.rootx.position.copy(huesos.rootx.parent.worldToLocal(r))
        huesos.rootx.updateMatrixWorld(true)
      }
      // Cada pie: plantado donde quedó (girando sobre la planta) o en el aire
      // hacia donde lo pide la cadera al terminar el paso.
      // Con la escala del personaje (sin ella los pies no caían donde están).
      const enRig = (k, yaw) => rig.localToWorld(e.postura[k].p.clone().applyMatrix4(
        new THREE.Matrix4().compose(personaje.position, _q3.setFromAxisAngle(EJE_Y, yaw), personaje.scale)))
      for (const k of ['L', 'R']) {
        const [muslo, pierna, pie] = piernas[k]
        let yawPlanta = psiEn(0)
        let enAire = null
        for (const [a, b] of pasosDe[k]) {
          if (u >= b) yawPlanta = psiEn(b)
          else { if (u > a) enAire = [a, b]; break }
        }
        let donde, yaw
        if (enAire) {
          const [a, b] = enAire
          const sl = (u - a) / (b - a)
          const sv = suave(sl)
          const desdeYaw = yawPlanta + GIRO.pivota * (psiEn(a) - yawPlanta)
          donde = enRig(k, yawPlanta).lerp(enRig(k, psiEn(b)), sv)
          donde.y += GIRO.levanta * alto * Math.sin(Math.PI * sl)
          yaw = lerp(desdeYaw, psiEn(b), sv)
        } else {
          donde = enRig(k, yawPlanta)
          yaw = yawPlanta + GIRO.pivota * (psiEn(u) - yawPlanta)
        }
        // La rodilla hacia donde apunta el pie, desde el plano en que la trae
        // la animación (al entrar y al salir del giro, sin brinco).
        const qPie = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Y, yaw)).multiply(e.postura[k].q)
        const rodilla = pierna.getWorldPosition(new THREE.Vector3()).addScaledVector(EJE_Z.clone().applyQuaternion(rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Y, yaw))), 0.3 * alto * Math.sin(Math.PI * u))
        ik(muslo, pierna, pie, donde, rodilla, 1)
        pie.parent.getWorldQuaternion(_q3).invert().multiply(qPie)
        pie.quaternion.copy(_q3)
        pie.updateMatrixWorld(true)
      }
    }

    // ── Los pies en el piso ───────────────────────────────────────────────
    // El punto más bajo de los pies toca el piso
    // en cada cuadro, más el brinco: la caminata mezclada con el idle, los
    // giros en su lugar y la cadera de la patada lo enterraban o lo dejaban
    // flotando. Mientras patea cuenta solo el pie de apoyo, hasta que la pierna
    // termina de regresar: con los dos, el pie que patea pasaba bajo la cadera
    // y levantaba a Skulley entero (0.26 en lo fuerte, 0.07 de regreso, con el
    // apoyo plantado y la rodilla doblada).
    const pateando = patada.W > 0.001
    const pisoY = fit.piso
    // Lo que separa la forma del piso: entre los vértices de la muestra puede
    // quedar uno un pelo más abajo. Una milésima del alto (menos de un pixel)
    // lo absorbe.
    const holgura = alto * HOLGURA
    const aterriza = () => {
      if (!contacto) return
      personaje.updateMatrixWorld(true)
      const dy = pisoY + holgura + cuerpo.y - bajoDe(pateando ? contacto.pieR : contacto.pies)
      if (Math.abs(dy) < 1e-6) return
      personaje.position.y += dy
      personaje.updateMatrixWorld(true)
    }
    aterriza()
    // Y el pie que patea, si roza el piso, dobla la rodilla lo justo (IK de la
    // pierna hacia arriba, la rodilla hacia adelante). Con margen (`ROZA`): al
    // regresar pasa por debajo de la cadera con la punta inclinada, y la
    // muestra de vértices no alcanza la puntita de los dedos (medido con todos:
    // se metía 0.0065).
    if (contacto && pateando) {
      // La rodilla en el plano que ya trae (con un polo fijo adelante brincaba
      // el cuadro en que el pie empezaba a rozar).
      const poloRodilla = huesos.piernaL.getWorldPosition(new THREE.Vector3())
      for (let k = 0; k < 4; k++) {
        const falta = pisoY + holgura + alto * ROZA - bajoDe(contacto.pieL)
        if (falta <= 1e-5) break
        const p = huesos.pieL.getWorldPosition(new THREE.Vector3())
        p.y += falta
        ik(huesos.musloL, huesos.piernaL, huesos.pieL, p, poloRodilla, 1)
      }
    }
    // El cuello ya está donde quedó (la columna, la patada y los pies en el
    // piso lo movieron): de ahí sale a dónde regresa la cabeza.
    idleMundo.multiplyMatrices(huesos.cuello.matrixWorld, idleLocal)
    idleMundo.decompose(_v1, idleQ, _s)
    idleCentro.copy(centroLocal).applyMatrix4(idleMundo)

    // ── La cabeza ─────────────────────────────────────────────────────────
    const ejeLocal = arriba.clone().applyQuaternion(idleQ.clone().invert())
    const giroPuesta = t < N.manosArriba ? Math.PI : (() => {
      const u = tramo(t, N.manosArriba + 0.05, N.tronido)
      // De golpe, se pasa un poco y regresa.
      return Math.PI * (1 - sale(u)) - 0.28 * Math.sin(u * Math.PI)
    })()
    const puestaQ = idleQ.clone().multiply(_q1.setFromAxisAngle(ejeLocal, giroPuesta))
    let mundo = null // la matriz de la cabeza en mundo, si va suelta
    let fase = null // 'suelta' (vuela, rueda, reposa o va en las manos) o 'pegada' (a la pierna)
    let crearRel = false
    // `sxz` / `sy`: aplastar o estirar la cabeza (su y es hacia arriba del cráneo).
    const aMatriz = (centroRig, q, sxz = 1, sy = 1) => _m2.compose(rig.localToWorld(centroRig.clone()), q, escala.clone().multiply(_v2.set(sxz, sy, sxz)))
      .multiply(new THREE.Matrix4().makeTranslation(-centroLocal.x, -centroLocal.y, -centroLocal.z))
    // Antes del golpe va puesta aunque la física ya esté guardada de otra
    // pasada (al regresar con la barra se desprendía antes del impacto; Oscar).
    if (e.cabezaSim && t >= N.golpe && t < N.puesta) {
      const fin1 = muestra(e.cabezaSim, 99)
      const reposo1 = new THREE.Vector3(fin1.x, fin1.y, fin1.z)
      const acostada1 = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, fin1.a).multiply(e.q0))
      // Donde muerde: abajo de la espinilla, y la cabeza enfrente, de cara a
      // la pierna y apoyada en el piso.
      const rodilla = huesos.piernaL.getWorldPosition(new THREE.Vector3())
      const tobillo = huesos.pieL.getWorldPosition(new THREE.Vector3())
      const mordida = rodilla.lerp(tobillo, 0.55)
      const haciaCab = rig.localToWorld(reposo1.clone()).sub(mordida).setY(0).normalize()
      const deCara = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Y, Math.atan2(-haciaCab.x, -haciaCab.z)).multiply(e.q0))
      fase = 'suelta'
      if (t < N.acecha) {
        const m = muestra(e.cabezaSim, t - N.golpe)
        mundo = aMatriz(new THREE.Vector3(m.x, m.y, m.z), rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, m.a).multiply(e.q0)))
      } else if (t < N.muerde) {
        // Despierta y se endereza de cara a la pierna con un brinquito; se
        // agazapa (aplastada, hacia atrás, temblando con el hocico abierto),
        // se queda quieta un instante y se lanza rapidísimo, estirándose.
        const MA = MORDIDA_ANIM
        // Viendo a la cámara (de frente en el espacio del rig) y luego a la pierna.
        const camRig = new THREE.Vector3(0, 0, 1).applyQuaternion(rigQi)
        const aCamara = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Y, Math.atan2(camRig.x, camRig.z)).multiply(e.q0))
        const mece = MA.mece * Math.sin(Math.PI * 4 * tramo(t, N.acecha + MA.despierta, N.acecha + MA.mira)) * (1 - tramo(t, N.acecha + MA.despierta, N.acecha + MA.mira))
        aCamara.multiply(_q4.setFromAxisAngle(EJE_Z, mece))
        const q = acostada1.clone().slerp(aCamara, suave(tramo(t, N.acecha, N.acecha + MA.despierta)))
          .slerp(deCara, sale(tramo(t, N.acecha + MA.mira, N.acecha + MA.mira + MA.voltea)))
        const objetivo = rig.worldToLocal(mordida.clone().addScaledVector(haciaCab, e.radio * 0.85))
        objetivo.y = Math.max(objetivo.y, fit.piso + e.radio * 0.92)
        const sale0 = N.muerde - MA.lanza
        const agazapa = suave(tramo(t, N.acecha + MA.mira + MA.voltea * 0.5, sale0 - MA.quieta))
        const lanza = tramo(t, sale0, N.muerde) ** 2
        const atras = reposo1.clone().addScaledVector(haciaCab.clone().applyQuaternion(rigQi), alto * MA.atras * agazapa)
        const c = atras.lerp(objetivo, lanza)
        c.y += alto * 0.03 * Math.sin(Math.PI * tramo(t, N.acecha, N.acecha + MA.despierta))
        const tiembla = alto * MA.tiembla * agazapa * (1 - suave(tramo(t, sale0 - MA.quieta, sale0 - MA.quieta * 0.4))) * (1 - lanza)
        c.x += tiembla * Math.sin(t * Math.PI * 2 * 21)
        c.z += tiembla * Math.sin(t * Math.PI * 2 * 17 + 1)
        const sy = 1 - MA.aplasta * agazapa * (1 - lanza) + MA.estira * Math.sin(Math.PI * lanza)
        const sxz = 1 + MA.aplasta * 0.6 * agazapa * (1 - lanza) - MA.estira * 0.5 * Math.sin(Math.PI * lanza)
        c.y -= e.radio * (1 - sy) * (1 - lanza)
        mundo = aMatriz(c, q, sxz, sy)
      } else if (t < N.patada + PATADA.suelta) {
        // Prendida de la espinilla: va pegada al hueso de la pierna. El primer
        // cuadro es el último del salto; ya asentada en el piso, se guarda
        // dónde quedó respecto a la pierna (abajo, con `crearRel`).
        if (!e.relPierna) {
          const objetivo = rig.worldToLocal(mordida.clone().addScaledVector(haciaCab, e.radio * 0.85))
          objetivo.y = Math.max(objetivo.y, fit.piso + e.radio * 0.92)
          mundo = aMatriz(objetivo, deCara)
          crearRel = true
        } else {
          mundo = huesos.piernaL.matrixWorld.clone().multiply(e.relPierna)
          fase = 'pegada'
          // El aplastón del impacto, que rebota como resorte.
          const k = t - N.muerde
          const MA = MORDIDA_ANIM
          const aplasta = MA.impacto * Math.exp(-k / MA.frena) * Math.cos(Math.PI * 2 * MA.rebota * k)
          if (Math.abs(aplasta) > 1e-3) {
            mundo.multiply(new THREE.Matrix4().makeTranslation(centroLocal.x, centroLocal.y, centroLocal.z))
              .multiply(new THREE.Matrix4().makeScale(1 + aplasta * 0.6, 1 - aplasta, 1 + aplasta * 0.6))
              .multiply(new THREE.Matrix4().makeTranslation(-centroLocal.x, -centroLocal.y, -centroLocal.z))
          }
        }
      } else {
        if (!e.cabezaSim2) {
          // La patada: sale desde donde iba, en arco, hacia la cámara.
          const suelta = huesos.piernaL.matrixWorld.clone().multiply(e.relPierna || new THREE.Matrix4())
          const q = new THREE.Quaternion()
          suelta.decompose(_v1, q, _s)
          const centro = rig.worldToLocal(centroLocal.clone().applyMatrix4(suelta))
          e.q0b = rigQi.clone().multiply(q)
          const fwd = adelante.clone().applyQuaternion(rigQi)
          e.cabezaSim2 = simularCabeza(centro, fit.piso + e.radio, e.radio, {
            vx: fwd.x * PATADA_SALE.adelante,
            vy: PATADA_SALE.vy,
            vz: fwd.z * PATADA_SALE.adelante + PATADA_SALE.haciaCamara,
            giro: PATADA_SALE.giro,
          })
          for (const b of e.cabezaSim2.botes) e.eventos.push({ t: N.patada + PATADA.suelta + b.t, hacer: () => playOrbBounce(b.fuerza, 0.45) })
          // Va por ella: se para a lo que alcanza agachándose.
          const fin2 = muestra(e.cabezaSim2, 99)
          const dx = fin2.x - cuerpo.x
          const dz = fin2.z - cuerpo.z
          const largo = Math.max(1e-3, Math.hypot(dx, dz))
          e.parada = { x: fin2.x - (dx / largo) * ANTES_DE_CABEZA, z: fin2.z - (dz / largo) * ANTES_DE_CABEZA }
          e.psi2 = Math.atan2(dx, dz)
        }
        const fin2 = muestra(e.cabezaSim2, 99)
        const acostada2 = rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, fin2.a).multiply(e.q0))
        if (t < N.agarra) {
          const vuela = t - N.patada - PATADA.suelta
          const m = muestra(e.cabezaSim2, vuela)
          const base = e.q0b.clone().slerp(e.q0, suave(tramo(vuela, 0, ACOMODO)))
          mundo = aMatriz(new THREE.Vector3(m.x, m.y, m.z), rigQ.clone().multiply(_q3.setFromAxisAngle(EJE_Z, m.a).multiply(base)))
        } else {
          // En las manos: del piso al pecho y del pecho al cuello.
          const reposo = new THREE.Vector3(fin2.x, fin2.y, fin2.z)
          const pecho = rig.worldToLocal(delCuerpo(0, fit.piso + alto * 0.47, alto * CARGA_ADELANTE))
          // A dónde llega: el centro del cráneo ya puesto al revés (girado
          // sobre el hueso), no el del idle: el giro corre el centro 0.03 altos y
          // al soltarla la cabeza y las manos brincaban (Oscar: "se
          // teletransportan").
          const cuello = rig.worldToLocal(centroLocal.clone().applyMatrix4(
            idleMundo.clone().multiply(new THREE.Matrix4().makeRotationFromQuaternion(_q1.setFromAxisAngle(ejeLocal, Math.PI)))))
          const camino = new THREE.CatmullRomCurve3([
            reposo,
            reposo.clone().addScaledVector(EJE_Y, alto * CARGA.despega),
            pecho,
            cuello.clone()
              .addScaledVector(EJE_Y, alto * CARGA.casco.arriba)
              .addScaledVector(adelante.clone().applyQuaternion(rigQi), alto * CARGA.casco.adelante),
            cuello,
          ], false, 'centripetal')
          const c = camino.getPointAt(suave(tramo(t, N.agarra, N.puesta)))
          // Siempre al alcance de sus brazos (a medio camino se le iba de las
          // manos: le faltaba hasta un 30 % de brazo): si no llega con
          // `alcance` de su largo a los lados del cráneo (`ancho`, en altos),
          // la cabeza se acerca a sus hombros.
          const cMundo = rig.localToWorld(c.clone())
          const hombros = [[huesos.brazoL, huesos.antebrazoL, huesos.manoL, 1], [huesos.brazoR, huesos.antebrazoR, huesos.manoR, -1]].map(([b, a, m, lado]) => {
            const A = b.getWorldPosition(new THREE.Vector3())
            const B = a.getWorldPosition(new THREE.Vector3())
            return { A, largo: A.distanceTo(B) + B.distanceTo(m.getWorldPosition(new THREE.Vector3())), lado }
          })
          const medio = hombros[0].A.clone().add(hombros[1].A).multiplyScalar(0.5)
          for (let k = 0; k < 4; k++) {
            let sobra = 0
            for (const h of hombros) sobra = Math.max(sobra, cMundo.clone().addScaledVector(derecha, h.lado * alto * AGARRE.ancho).distanceTo(h.A) - h.largo * AGARRE.alcance)
            if (sobra <= 1e-5) break
            cMundo.addScaledVector(medio.clone().sub(cMundo).normalize(), sobra)
          }
          c.copy(rig.worldToLocal(cMundo))
          mundo = aMatriz(c, acostada2.slerp(puestaQ, suave(tramo(t, N.agarra, N.puesta - 0.25))))
        }
      }
    }
    const ponerCabeza = (m) => {
      new THREE.Matrix4().multiplyMatrices(huesos.cuello.matrixWorld.clone().invert(), m)
        .decompose(cab.position, cab.quaternion, _s)
      cab.updateMatrixWorld(true)
    }
    if (mundo) {
      ponerCabeza(mundo)
    } else if (t >= N.puesta && giroPuesta !== 0) {
      // Puesta (al revés y luego derecha): su pose local con el giro encima,
      // sobre el hueso, que es lo que empata las vértebras de la cabeza con
      // las del cuello (girada sobre el centro del cráneo no empataban; Oscar).
      cab.quaternion.multiply(_q1.setFromAxisAngle(ejeLocal, giroPuesta))
      // Ladeada de duda, como perro confundido, hasta que se la agarra.
      const ladea = DUDA.ladea * suave(tramo(t, N.duda, N.duda + 0.3)) * (1 - suave(tramo(t, N.confundido, N.manosArriba)))
      if (ladea > 0.001) cab.quaternion.multiply(_q1.setFromAxisAngle(adelante.clone().applyQuaternion(idleQ.clone().invert()).normalize(), ladea))
    }
    cab.updateMatrixWorld(true)

    // La boca: se abre al agazaparse, se cierra de golpe al morder y va abierta
    // del grito mientras vuela de la patada.
    let boca = 0
    if (t >= N.acecha && t < N.muerde + 0.05) {
      const MA = MORDIDA_ANIM
      // Una sonrisita viendo a la cámara y el hocico bien abierto al agazaparse.
      const risa = 0.25 * Math.sin(Math.PI * tramo(t, N.acecha + MA.despierta * 0.7, N.acecha + MA.mira + MA.voltea))
      boca = Math.max(risa, MA.hocico * sale(tramo(t, N.acecha + MA.mira + MA.voltea, N.muerde - MA.lanza - MA.quieta))) * (1 - tramo(t, N.muerde, N.muerde + 0.04))
    }
    else if (t >= N.patada) boca = 0.8 * Math.sin(Math.PI * tramo(t, N.patada, N.patada + 0.9))
    if (boca > 0.001) {
      const q = huesos.quijada
      const derechaMundo = derechaCabeza.clone().applyQuaternion(cab.getWorldQuaternion(new THREE.Quaternion()))
      q.getWorldQuaternion(_q1).invert()
      q.quaternion.multiply(_q2.setFromAxisAngle(derechaMundo.applyQuaternion(_q1), MORDIDA.abre * boca))
      q.updateMatrixWorld(true)
    }

    // ── La cabeza contra el piso ──────────────────────────────────────────
    // Suelta: nunca más abajo del piso y, ya cerca de donde reposa, apoyada en
    // su punto más bajo de verdad (el mohawk, la quijada abierta, un lado del
    // cráneo), no en la esfera de la física. Así rueda sobre su forma.
    const subirCabeza = (dy) => {
      if (Math.abs(dy) < 1e-6) return
      const p = cab.getWorldPosition(new THREE.Vector3())
      p.y += dy
      cab.position.copy(huesos.cuello.worldToLocal(p))
      cab.updateMatrixWorld(true)
    }
    if (contacto && (fase === 'suelta' || crearRel)) {
      const falta = pisoY + holgura - bajoDe(contacto.cabeza)
      const centroY = _v1.copy(centroLocal).applyMatrix4(cab.matrixWorld).y
      const cerca = 1 - clamp01((centroY - (pisoY + e.radio)) / (e.radio * ASIENTA))
      subirCabeza(falta > 0 ? falta : falta * cerca)
    } else if (contacto && fase === 'pegada') {
      // Mordiendo la espinilla: al pasar la pierna de la sacudida (adelante) a
      // la patada (atrás) la espinilla cruza por abajo y la cabeza rozaba el
      // piso unos 40 ms. Sube derecho lo que le falta: es lo que menos se
      // mueve (girarla sobre la mordida, como péndulo, la barría 38° de golpe,
      // y subir la rodilla metía al piso el pie de atrás).
      subirCabeza(Math.max(0, pisoY + holgura - bajoDe(contacto.cabeza)))
    }
    if (crearRel) e.relPierna = huesos.piernaL.matrixWorld.clone().invert().multiply(cab.matrixWorld)

    // ── Las manos ─────────────────────────────────────────────────────────
    // Del susto, arriba; del dolor, abiertos para no caerse; caminando, por
    // delante a tientas; con la cabeza, a los lados del cráneo. Gana la que
    // pese más en este momento.
    const pesoGolpe = 0.8 * suave(tramo(t, N.golpe + 0.03, N.golpe + 0.25)) * (1 - suave(tramo(t, N.sacudida - 0.2, N.despiste - 0.3)))
    const pesoDolor = 0.85 * suave(tramo(t, N.muerde + 0.03, N.muerde + 0.2)) * (1 - suave(tramo(t, N.patada + 0.15, N.sueltaPierna + 0.2)))
    const pesoSusto = (1 - patada.W) * Math.max(pesoGolpe, pesoDolor)
    const pesoTantea = Math.max(
      suave(tramo(t, N.despiste, N.giro1)) * (1 - suave(tramo(t, N.llega - 0.25, N.acecha))),
      suave(tramo(t, N.despiste2, N.giro3)) * (1 - suave(tramo(t, N.camina3 - 0.25, N.laVe))),
    )
    const pesoCabeza = Math.max(
      suave(tramo(t, N.laVe, N.agachado - 0.1)) * (1 - suave(tramo(t, N.puesta, N.suelta))),
      suave(tramo(t, N.confundido, N.manosArriba)) * (1 - suave(tramo(t, N.tronido, N.fin))),
    )
    const centroCab = centroLocal.clone().applyMatrix4(cab.matrixWorld)
    // Las medidas del agarre, una vez, cuando ya están los puntos de contacto.
    if (contacto && !craneo) {
      const inv = cab.matrixWorld.clone().invert()
      const min = new THREE.Vector3(Infinity, Infinity, Infinity)
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      for (const m of contacto.cabeza) {
        if (huesoDe(m) !== cab) continue
        puntoDe(m, _v1).applyMatrix4(inv)
        min.min(_v1)
        max.max(_v1)
      }
      // `lista`: solo el cráneo. Con el pelo, las púas que salen a los lados
      // dejaban las manos lejos de la cabeza al enderezarla.
      if (min.x < max.x) craneo = { centro: min.clone().add(max).multiplyScalar(0.5), ejes: max.clone().sub(min).multiplyScalar(0.5), lista: contacto.cabeza.filter((m) => huesoDe(m) === cab) }
    }
    const palmaDe = (mano, lista) => {
      if (!palmas.has(mano)) {
        // La palma: los puntos del hueso de la mano (no los dedos), su centro
        // de lado a lado y de la muñeca a los nudillos, y su cara de la palma
        // (-z en este esqueleto: hacia ahí se doblan los dedos).
        const inv = mano.matrixWorld.clone().invert()
        const c = new THREE.Vector3()
        let n = 0
        let zMin = Infinity
        for (const m of lista) {
          if (huesoDe(m) !== mano) continue
          puntoDe(m, _v1).applyMatrix4(inv)
          c.add(_v1)
          zMin = Math.min(zMin, _v1.z)
          n++
        }
        palmas.set(mano, n ? c.divideScalar(n).setZ(zMin) : null)
      }
      return palmas.get(mano)
    }
    // Qué tanto se mete la mano al cráneo (en mundo): lo más hondo de sus
    // puntos dentro del elipsoide.
    const hundido = (lista) => {
      if (!craneo) return 0
      const inv = cab.matrixWorld.clone().invert()
      const escalaCab = cab.matrixWorld.getMaxScaleOnAxis()
      let fondo = 0
      for (const m of lista) {
        puntoDe(m, _v1).applyMatrix4(inv).sub(craneo.centro)
        const r = Math.hypot(_v1.x / craneo.ejes.x, _v1.y / craneo.ejes.y, _v1.z / craneo.ejes.z)
        if (r < 1) fondo = Math.max(fondo, (1 - r) * _v1.length() * escalaCab)
      }
      return fondo
    }
    // Cuánto se abren las manos: antes de agarrar y al soltar, en cada vez
    // que toman la cabeza (al levantarla y al enderezarla de un tronido).
    const abre = alto * AGARRE.abre * (t < N.suelta + 0.3
      ? 1 - suave(tramo(t, N.agachado - 0.2, N.agarra)) + suave(tramo(t, N.puesta, N.suelta))
      : 1 - suave(tramo(t, N.confundido, N.manosArriba)) + suave(tramo(t, N.tronido, N.fin)))
    const adelanteCuerpo = adelante
    const derechaCuerpo = derecha
    // Lo que la mano giró sobre el eje del antebrazo lo reparte el antebrazo:
    // el giro de cerca de la muñeca entero y el de en medio la mitad, como en el
    // brazo de verdad (sus huesos son hermanos de la mano: girar la mano sola
    // estrangula la muñeca).
    const torcer = (s, mano, q0) => {
      const dg = giroY(mano.quaternion) - giroY(q0)
      const torsion = Math.atan2(Math.sin(dg), Math.cos(dg))
      const [giro, giro2] = s > 0 ? [huesos.giroL, huesos.giroL2] : [huesos.giroR, huesos.giroR2]
      giro.quaternion.multiply(_q3.setFromAxisAngle(EJE_Y, torsion))
      giro2.quaternion.multiply(_q3.setFromAxisAngle(EJE_Y, torsion / 2))
      giro.updateMatrixWorld(true)
      giro2.updateMatrixWorld(true)
    }
    const agarrar = (s, brazo, antebrazo, mano, polo, peso) => {
      const lista = s > 0 ? contacto.manoL : contacto.manoR
      const palma = palmaDe(mano, lista)
      if (!palma) return false
      const d = derecha.clone().multiplyScalar(s) // del cráneo hacia afuera, de su lado
      // La mano: los dedos en la línea del brazo (del hombro al costado del
      // cráneo; con el antebrazo que deja el IK se retroalimentaba y un brazo
      // se iba hacia atrás), un poco doblados hacia el cráneo, y la palma (-z)
      // mirándolo donde se apoya (`n`: un poco atrás de lo más ancho).
      const qMano = new THREE.Quaternion()
      const n = d.clone()
      const lado = centroCab.clone().addScaledVector(d, alto * AGARRE.ancho)
      const orientar = () => {
        const y = lado.clone().sub(brazo.getWorldPosition(new THREE.Vector3()))
        y.addScaledVector(d, -y.dot(d))
        if (y.lengthSq() < 1e-10) y.copy(arriba)
        y.normalize()
        n.copy(d).multiplyScalar(Math.cos(AGARRE.atras)).addScaledVector(y, -Math.sin(AGARRE.atras)).normalize()
        y.addScaledVector(n, -y.dot(n)).normalize()
        y.multiplyScalar(Math.cos(AGARRE.flexiona)).addScaledVector(n, -Math.sin(AGARRE.flexiona)).normalize()
        const z = n.clone().addScaledVector(y, -n.dot(y)).normalize()
        qMano.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z))
      }
      // Desde la pose del mixer cada vez (girar sobre lo ya girado acumulaba).
      const q0 = mano.quaternion.clone()
      const girar = () => {
        mano.parent.getWorldQuaternion(_q3).invert().multiply(qMano)
        mano.quaternion.copy(q0).slerp(_q3, peso)
        limitarGiro(mano.quaternion, q0)
        mano.updateMatrixWorld(true)
      }
      // De la palma a la muñeca, con la mano girada, y la palma donde el
      // cráneo llega hacia `n` (la distancia, no el vértice que llega: ese
      // brinca de uno a otro y la mano se teletransportaba; Oscar). Dos
      // pasadas: la línea del antebrazo cambia con el IK y la mano la sigue.
      const escalaMano = mano.matrixWorld.getMaxScaleOnAxis()
      const muneca = new THREE.Vector3()
      const llega = new THREE.Vector3()
      // Lo que no alcanza se queda a `estira` del largo del brazo: con el brazo
      // recto del todo el codo titubeaba de un cuadro a otro (al estirarse por
      // la cabeza antes de agarrarla).
      const hombro = brazo.getWorldPosition(new THREE.Vector3())
      const largoBrazo = hombro.distanceTo(antebrazo.getWorldPosition(new THREE.Vector3())) + antebrazo.getWorldPosition(new THREE.Vector3()).distanceTo(mano.getWorldPosition(new THREE.Vector3()))
      const alcanza = () => {
        const v = muneca.clone().sub(hombro)
        if (v.length() > largoBrazo * AGARRE.estira) muneca.copy(hombro).addScaledVector(v.normalize(), largoBrazo * AGARRE.estira)
      }
      for (let k = 0; k < 2; k++) {
        orientar()
        llega.copy(centroCab).addScaledVector(n, extremoEn(craneo ? craneo.lista : contacto.cabeza, n, centroCab) + alto * AGARRE.holgura + abre)
        muneca.copy(llega).sub(palma.clone().multiplyScalar(escalaMano).applyQuaternion(qMano))
        alcanza()
        ik(brazo, antebrazo, mano, muneca, polo, peso)
      }
      orientar()
      girar()
      // Los dedos se cierran sobre el cráneo al agarrar (abiertos, no).
      const cierra = AGARRE.cierra * peso * (1 - clamp01(abre / (alto * AGARRE.abre)))
      if (cierra > 0.001) {
        for (const f of s > 0 ? dedos.L : dedos.R) {
          f.quaternion.multiply(_q3.setFromAxisAngle(EJE_X, -cierra))
          f.updateMatrixWorld(true)
        }
      }
      for (let k = 0; k < AGARRE.vueltas; k++) {
        const fondo = hundido(lista)
        if (fondo <= alto * 1e-4) break
        // Solo lo que se mete (empieza en cero): sumarle la holgura daba un
        // brinquito al empezar a rozar.
        muneca.addScaledVector(n, fondo)
        alcanza()
        ik(brazo, antebrazo, mano, muneca, polo, peso)
        girar()
      }
      torcer(s, mano, q0)
      return true
    }
    // Las palmas al frente para tantear: la mano girada en mundo y el antebrazo
    // torcido con ella.
    const tantear = (s, brazo, antebrazo, mano, polo, peso) => {
      // Con el pecho: en el giro hacia la cabeza el pecho voltea primero.
      const adelante = adelanteCuerpo.clone().applyAxisAngle(arriba, giroTorso)
      const derecha = derechaCuerpo.clone().applyAxisAngle(arriba, giroTorso)
      const A = brazo.getWorldPosition(new THREE.Vector3())
      const B = antebrazo.getWorldPosition(new THREE.Vector3())
      const largo = A.distanceTo(B) + B.distanceTo(mano.getWorldPosition(new THREE.Vector3()))
      const f = s > 0 ? 0 : 2.1
      const onda = (hz, fase) => Math.sin(Math.PI * 2 * hz * t + fase)
      const lado = TANTEO.lado[0] * onda(0.37, f) + TANTEO.lado[1] * onda(0.91, 1.3 * f + 0.4)
      const sube = TANTEO.sube[0] * onda(0.53, 0.8 * f + 1.1) + TANTEO.sube[1] * onda(1.27, f + 2.2)
      const estira = TANTEO.estira * Math.pow(Math.max(0, onda(0.29, 1.7 * f + 0.6)), 3)
      const objetivo = A.clone()
        .addScaledVector(adelante, largo * (TANTEO.alcance + estira))
        .addScaledVector(derecha, alto * (s * TANTEO.abre + lado))
        .addScaledVector(arriba, alto * (TANTEO.alto + sube))
      ik(brazo, antebrazo, mano, objetivo, polo, peso)
      // Dedos arriba e inclinados al frente, palma (-z) al frente; se mece un
      // poco con lo que tantea.
      const inclina = TANTEO.dedos + 6 * sube
      const y = arriba.clone().multiplyScalar(Math.cos(inclina)).addScaledVector(adelante, Math.sin(inclina))
        .addScaledVector(derecha, 4 * lado).normalize()
      const palmaAl = adelante.clone().addScaledVector(y, -adelante.dot(y)).normalize()
      const z = palmaAl.negate()
      const qMano = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z))
      const q0 = mano.quaternion.clone()
      mano.parent.getWorldQuaternion(_q3).invert().multiply(qMano)
      mano.quaternion.copy(q0).slerp(_q3, peso)
      limitarGiro(mano.quaternion, q0)
      mano.updateMatrixWorld(true)
      torcer(s, mano, q0)
    }
    // Alza los hombros con las palmas arriba mientras duda; de ahí las manos
    // suben a la cabeza (encima de esto, sin brinco).
    const pesoEncoge = suave(tramo(t, N.duda, N.duda + 0.3)) * (1 - suave(tramo(t, N.confundido - 0.05, N.confundido + 0.3)))
    for (const [s, brazo, antebrazo, mano] of [
      [1, huesos.brazoL, huesos.antebrazoL, huesos.manoL],
      [-1, huesos.brazoR, huesos.antebrazoR, huesos.manoR],
    ]) {
      let peso = 0
      let objetivo = null
      let agarrando = false
      const polo = brazo.getWorldPosition(new THREE.Vector3())
        .addScaledVector(derecha, s * CODO.x * alto)
        .addScaledVector(arriba, CODO.y * alto)
        .addScaledVector(adelante, CODO.z * alto)
      let poloIk = polo
      if (pesoEncoge > 0.001) {
        ik(brazo, antebrazo, mano, delCuerpo(s * DUDA.encoge.x, DUDA.encoge.y, DUDA.encoge.z), polo, pesoEncoge)
        // Palmas arriba, dedos al frente.
        const q0 = mano.quaternion.clone()
        const y = adelante.clone()
        const z = arriba.clone().negate()
        mano.parent.getWorldQuaternion(_q3).invert().multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z)))
        mano.quaternion.copy(q0).slerp(_q3, pesoEncoge)
        limitarGiro(mano.quaternion, q0)
        mano.updateMatrixWorld(true)
        torcer(s, mano, q0)
      }
      if (pesoCabeza >= pesoTantea && pesoCabeza >= pesoSusto && pesoCabeza > 0.001) {
        peso = pesoCabeza
        agarrando = !!contacto && agarrar(s, brazo, antebrazo, mano, polo, peso)
        if (!agarrando) objetivo = centroCab.clone().addScaledVector(derecha, s * alto * RADIO_CRANEO * 1.05)
      } else if (pesoTantea >= pesoSusto && pesoTantea > 0.001) {
        peso = pesoTantea
        tantear(s, brazo, antebrazo, mano, polo, peso)
      } else if (pesoSusto > 0.001) {
        peso = pesoSusto
        // Brincando en un pie, los brazos abiertos a los lados aletean con los
        // brincos, uno sube cuando el otro baja (arriba y a 5 Hz se veía de
        // máquina).
        // Del madrazo la cabeza sale volando por encima de su izquierda y cae
        // de ese lado: esa mano se estira al frente con el codo abajo, pegado
        // al cuerpo, hasta que la cabeza ya está en el piso (alzado o abierto,
        // la cabeza le atravesaba el brazo o el codo).
        const paso = s > 0 ? suave(tramo(t, N.golpe + 0.72, N.golpe + 1.0)) : 1
        if (pesoGolpe >= pesoDolor && paso < 1) {
          poloIk = brazo.getWorldPosition(new THREE.Vector3()).addScaledVector(arriba, -0.6 * alto).addScaledVector(adelante, 0.1 * alto).lerp(polo, paso)
        }
        objetivo = pesoGolpe >= pesoDolor
          ? delCuerpo(s * lerp(0.2, 0.38, paso), lerp(0.92, 1.42, paso), lerp(0.45, 0.16, paso))
          : delCuerpo(s * 0.46, 0.98 + 0.1 * agita * Math.sin(ritmo + (s > 0 ? 0 : Math.PI)), 0.1)
        // En un pie, los brazos dan vueltas como molino para no caerse (el
        // izquierdo cuando ya pasó la cabeza).
        const molino = pesoGolpe >= pesoDolor ? equilibrio * paso : 0
        if (molino > 0.001) {
          const a = 2 * Math.PI * EMPUJE.vueltas * kG * -s + (s > 0 ? Math.PI : 0)
          objetivo.addScaledVector(derecha, s * EMPUJE.molino * alto * molino * Math.cos(a))
          objetivo.addScaledVector(arriba, EMPUJE.molino * alto * molino * Math.sin(a))
        }
      }
      // En la patada el brazo derecho se va atrás y afuera para equilibrarse:
      // la patada del juego lo balancea al frente, justo por donde sale la
      // cabeza (medido: se la atravesaba).
      if (objetivo) ik(brazo, antebrazo, mano, objetivo, poloIk, peso)
      // Encima, sin cambiar de objetivo de golpe (eso brincaba).
      if (!agarrando && s < 0 && patada.W > 0.001) {
        objetivo = delCuerpo(s * 0.46, 1.08, -0.22)
        // El codo atrás y arriba: con el polo de siempre (afuera) casi en la
        // línea del hombro a la mano, el codo daba vueltas y el antebrazo se
        // torcía de golpe.
        const poloAtras = brazo.getWorldPosition(new THREE.Vector3()).addScaledVector(arriba, 0.4 * alto).addScaledVector(adelante, -0.7 * alto)
        ik(brazo, antebrazo, mano, objetivo, poloAtras, patada.W)
        peso = Math.max(peso, patada.W)
      }
      // Que la cabeza (volando o puesta) ni las costillas se le metan al brazo,
      // siga una pose de aquí o la animación (la patada): si se meten, la mano
      // se aparta lo que falte (se lee como que la esquiva). Medido: tras el
      // golpe y tras la patada la cabeza le atravesaba el brazo. Agarrándola,
      // tocarla es a propósito.
      if (!agarrando) {
        const lista = s > 0 ? contacto?.brazoL : contacto?.brazoR
        // Desde donde quedó la mano, con el codo en su plano: así, sin
        // traspaso, la pose no cambia nada.
        const meta = mano.getWorldPosition(new THREE.Vector3())
        const codo = antebrazo.getWorldPosition(new THREE.Vector3())
        apartar(lista, meta, (m) => ik(brazo, antebrazo, mano, m, codo, 1), alto)
      }
      // Agachado por la cabeza, la punta de los dedos se metía en el piso:
      // la mano sube lo que falte. Solo se revisa con la mano cerca del piso.
      // Gira el brazo desde el hombro sin rehacer el codo: resolverlo otra vez
      // entero lo hacía brincar el cuadro en que los dedos tocaban el piso.
      if (contacto && mano.getWorldPosition(_v1).y - pisoY < alto * 0.35) {
        const lista = s > 0 ? contacto.manoL : contacto.manoR
        const hombro = brazo.getWorldPosition(new THREE.Vector3())
        for (let k = 0; k < 3; k++) {
          const falta = pisoY + holgura - bajoDe(lista)
          if (falta <= 1e-5) break
          const p = mano.getWorldPosition(new THREE.Vector3()).sub(hombro)
          apuntar(brazo, p.clone(), p.setY(p.y + falta), 1)
        }
      }
    }

    // ── La esfera ─────────────────────────────────────────────────────────
    // Se queda en el piso todo el numerito. Enfrente de Skulley se desenfoca:
    // la nítida se esconde y la dibuja borrosa el rig (`userData.desenfoque`,
    // de 0 a 1; OrbeBorrosa), como la profundidad de campo de una cámara.
    if (orbe) {
      const m = muestra(e.orbeSim, t)
      orbe.position.set(m.x, m.y, m.z)
      const delante = (m.z - cuerpo.z) / alto
      const borrosa = t > N.golpe ? suave(tramo(delante, ORBE_DESENFOQUE.desde, ORBE_DESENFOQUE.hasta)) : 0
      orbe.userData.desenfoque = borrosa
      // Ya con la cabeza puesta se desvanece, para que no estorbe (Oscar).
      orbe.userData.queda = 1 - suave(tramo(t, N.puesta, N.puesta + 0.5))
      orbe.visible = borrosa < 0.35 && t < N.puesta
    }

    // ── La caminata del GLB, mezclada con el idle, y sus pasos ────────────
    if (camina && idle) {
      camina.setEffectiveWeight(cuerpo.paso)
      idle.setEffectiveWeight(1 - cuerpo.paso)
      camina.setEffectiveTimeScale(cuerpo.escala)
      // El pie izquierdo apoya al empezar el ciclo y el derecho a la mitad.
      const fase = (camina.time % CICLO) / CICLO
      if (cuerpo.paso > 0.3 && Math.floor(fase * 2) !== Math.floor(faseCamina * 2)) playFootstep(fase >= 0.5)
      faseCamina = fase
    }

    // ── Los sonidos que tocan en este cuadro ──────────────────────────────
    // Al saltar hacia adelante con la barra, los de en medio no suenan juntos.
    if (t < tPrevio) for (const ev of e.eventos) if (ev.t > t) ev.hecho = false
    for (const ev of e.eventos) {
      if (ev.hecho || ev.t > t) continue
      ev.hecho = true
      if (ev.t > tPrevio - 0.25 && ev.t > t - 0.5) { try { ev.hacer() } catch { } }
    }
    tPrevio = t

    auditar(t, fit, 'numerito', pesoCabeza > 0.05)
    tocados.forEach((b, i) => copiar(escrita[i], b))
    hayEscrita = true

    // El foco sigue al cuerpo; cuando va por la cabeza, alumbra a los dos.
    const enCuerpo = personaje.getWorldPosition(new THREE.Vector3()).setY(0)
    if (e.cabezaSim2 && t >= N.camina3 - 0.6 && t < N.suelta) {
      const juntos = suave(tramo(t, N.camina3 - 0.6, N.laVe)) * (1 - suave(tramo(t, N.enPecho, N.puesta)))
      enCuerpo.lerp(centroCab.clone().setY(0), juntos * 0.5)
    }
    return enCuerpo
  }

  // Regresa todo: la pose del mixer, el cuerpo al centro, sin caminata, sin
  // piezas rígidas y la esfera fuera de cuadro.
  // ── Que nada atraviese el cuerpo (Oscar: "detecta esas cosas y evítalo a
  // toda costa") ──────────────────────────────────────────────────────────
  // Elipsoides del cráneo y de las costillas (cada vértebra en su espacio),
  // medidos una vez de la muestra de vértices, un poco inflados (`HOLGURA_CUERPO`)
  // para dejar aire. `traspaso` da lo más hondo que se mete una muestra (en
  // mundo) y hacia dónde salir.
  const HOLGURA_CUERPO = 1.06
  let cuerpoDuro = null
  function medirCuerpoDuro() {
    if (cuerpoDuro || !contacto?.torso) return cuerpoDuro
    personaje.updateMatrixWorld(true)
    const elipse = (hueso, lista) => {
      const inv = hueso.matrixWorld.clone().invert()
      const min = new THREE.Vector3(Infinity, Infinity, Infinity)
      const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
      for (const m of lista) {
        if (huesoDe(m) !== hueso) continue
        puntoDe(m, _v1).applyMatrix4(inv)
        min.min(_v1)
        max.max(_v1)
      }
      if (!(min.x < max.x)) return null
      return { hueso, centro: min.clone().add(max).multiplyScalar(0.5), ejes: max.clone().sub(min).multiplyScalar(0.5 * HOLGURA_CUERPO) }
    }
    // Y cada hueso de la pelvis y de las piernas (fémur y espinilla, con sus
    // huesos de giro): la mano en la cintura se metía en la cadera (Oscar).
    const porHueso = (lista) => {
      const cuenta = new Map()
      for (const m of lista || []) { const b = huesoDe(m); cuenta.set(b, (cuenta.get(b) || 0) + 1) }
      return [...cuenta].filter(([, n]) => n >= 25).map(([b]) => elipse(b, lista))
    }
    cuerpoDuro = [
      elipse(huesos.cabeza, contacto.cabeza),
      elipse(huesos.spine_01x, contacto.torso), elipse(huesos.spine_02x, contacto.torso), elipse(huesos.spine_03x, contacto.torso),
      ...porHueso(contacto.cadera), ...porHueso(contacto.musloL), ...porHueso(contacto.musloR),
    ].filter(Boolean)
    if (import.meta.env.DEV) console.debug('[numerito] cuerpo duro', cuerpoDuro.map((el) => el.hueso.name).join(' '))
    return cuerpoDuro
  }
  const _inv = new THREE.Matrix4()
  // `margen`: cuánto más grande se toma el cuerpo (para apartar el brazo antes
  // de que toque). `salida`: hacia dónde salir, el promedio de lo que se mete
  // pesado por lo hondo (con solo el punto más hondo la dirección cambiaba de
  // golpe entre dos puntos y el brazo brincaba).
  // Cada punto se calcula una vez (en mundo) y las piezas que quedan lejos de
  // la caja del brazo se saltan: con la pelvis y las piernas son 17 piezas y,
  // calculando los puntos pieza por pieza, el estirón bajaba a la mitad de
  // cuadros por segundo.
  const _sale = new THREE.Vector3()
  const _c = new THREE.Vector3()
  let _mundo = new Float32Array(0)
  function traspaso(lista, salida = null, cuales = null, margen = 0) {
    let fondo = 0
    if (salida) salida.set(0, 0, 0)
    const n = lista.length
    if (_mundo.length < n * 3) _mundo = new Float32Array(n * 3)
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
    for (let i = 0; i < n; i++) {
      puntoDe(lista[i], _v1)
      _mundo[i * 3] = _v1.x; _mundo[i * 3 + 1] = _v1.y; _mundo[i * 3 + 2] = _v1.z
      if (_v1.x < x0) x0 = _v1.x; if (_v1.x > x1) x1 = _v1.x
      if (_v1.y < y0) y0 = _v1.y; if (_v1.y > y1) y1 = _v1.y
      if (_v1.z < z0) z0 = _v1.z; if (_v1.z > z1) z1 = _v1.z
    }
    const g = 1 + margen
    for (const el of medirCuerpoDuro() || []) {
      if (cuales && !cuales.includes(el.hueso)) continue
      const mw = el.hueso.matrixWorld
      const k = mw.getMaxScaleOnAxis()
      const radio = Math.max(el.ejes.x, el.ejes.y, el.ejes.z) * k * g
      _c.copy(el.centro).applyMatrix4(mw)
      if (_c.x + radio < x0 || _c.x - radio > x1 || _c.y + radio < y0 || _c.y - radio > y1 || _c.z + radio < z0 || _c.z - radio > z1) continue
      const e = _inv.copy(mw).invert().elements
      const cx = el.centro.x, cy = el.centro.y, cz = el.centro.z
      const ex = el.ejes.x * g, ey = el.ejes.y * g, ez = el.ejes.z * g
      for (let i = 0; i < n; i++) {
        const wx = _mundo[i * 3], wy = _mundo[i * 3 + 1], wz = _mundo[i * 3 + 2]
        const lx = e[0] * wx + e[4] * wy + e[8] * wz + e[12] - cx
        const ly = e[1] * wx + e[5] * wy + e[9] * wz + e[13] - cy
        const lz = e[2] * wx + e[6] * wy + e[10] * wz + e[14] - cz
        const r = Math.hypot(lx / ex, ly / ey, lz / ez)
        if (r >= 1) continue
        const d = (1 - r) * Math.hypot(lx, ly, lz) * k
        if (d > fondo) fondo = d
        if (salida) salida.addScaledVector(_sale.set(lx, ly, lz).transformDirection(mw), d)
      }
    }
    if (salida && fondo > 0) salida.normalize()
    return fondo
  }
  // Aparta un brazo del cuerpo: `posar(meta)` lo vuelve a poner con la mano en
  // `meta`, que sale lo que se mete (sin empujón fijo: así es continuo, y el
  // margen deja el aire).
  const MARGEN_BRAZO = 0.07
  // Con `peso` menor que 1 la IK solo se acerca a la meta: se empuja más.
  // `tope`: lo más que se mueve la meta (en altos); sin tope, contra algo que
  // no podía esquivar la mandaba lejísimos y el brazo quedaba estirado.
  function apartar(lista, meta, posar, alto, veces = 8, peso = 1, tope = Infinity) {
    const sale = new THREE.Vector3()
    const ganancia = 1.25 / Math.max(0.35, peso)
    const inicio = meta.clone()
    for (let k = 0; lista && k < veces; k++) {
      const d = traspaso(lista, sale, null, MARGEN_BRAZO)
      if (d <= alto * 1e-5) break
      meta.addScaledVector(sale, d * ganancia)
      const lejos = meta.distanceTo(inicio)
      if (lejos > tope * alto) meta.sub(inicio).multiplyScalar(tope * alto / lejos).add(inicio)
      posar(meta)
    }
  }
  // En desarrollo, `window.__auditarTraspasos = true` deja en `window.__traspasos`
  // lo más que se mete cada brazo en el cuerpo en cada cuadro (en altos).
  // `agarrando`: las manos tocan el cráneo a propósito; solo cuentan las costillas.
  function auditar(t, fit, que, agarrando = false) {
    grabarSaltos(t, fit, que)
    if (!import.meta.env.DEV || !window.__auditarTraspasos || !contacto?.brazoL) return
    const cuerpo = medirCuerpoDuro() || []
    const cuales = agarrando ? cuerpo.filter((el) => el.hueso !== huesos.cabeza).map((el) => el.hueso) : null
    const en = (lista) => cuerpo.map((el) => +(traspaso(lista, null, [el.hueso]) / fit.alto).toFixed(4))
    ;(window.__traspasos ||= []).push([+t.toFixed(3), que, +(traspaso(contacto.brazoL, null, cuales) / fit.alto).toFixed(4), +(traspaso(contacto.brazoR, null, cuales) / fit.alto).toFixed(4), en(contacto.brazoL), en(contacto.brazoR)])
  }

  // En desarrollo, `window.__auditarSaltos = true` deja en `window.__saltos` por
  // cuadro dónde quedan manos, codos, puntas de los dedos, cabeza, rodillas y
  // pies (en mundo) y cómo quedan girados manos y antebrazos, para encontrar
  // brincos: un cuadro que se mueve mucho más que los de junto.
  function grabarSaltos(t, fit, que) {
    if (!import.meta.env.DEV || !window.__auditarSaltos) return
    const fila = [+t.toFixed(4), que, fit.alto]
    for (const b of [huesos.manoL, huesos.manoR, huesos.antebrazoL, huesos.antebrazoR, dedos.L[2], dedos.R[2], huesos.cabeza, huesos.piernaL, huesos.piernaR, huesos.pieL, huesos.pieR]) {
      b.getWorldPosition(_v1)
      fila.push(_v1.x, _v1.y, _v1.z)
    }
    for (const b of [huesos.manoL, huesos.manoR, huesos.giroL2, huesos.giroR2]) {
      b.getWorldQuaternion(_q1)
      fila.push(_q1.x, _q1.y, _q1.z, _q1.w)
    }
    ;(window.__saltos ||= []).push(fila)
  }

  // Se revisa al quedar armado (INSPECCION): capa sobre el idle con IK de las
  // manos, la cabeza y la columna; `t` en segundos desde que quedó armado.
  // La pose de armado de cada hueso (de pie y derecho), en el espacio de su
  // padre, sacada de las matrices de armado del esqueleto.
  let armado = null
  function medirArmado() {
    if (armado) return armado
    armado = new Map()
    let malla = null
    personaje.traverse((m) => { if (!malla && m.isSkinnedMesh && m.skeleton) malla = m })
    if (!malla) return armado
    const { bones, boneInverses } = malla.skeleton
    const enArmado = (b) => {
      const i = bones.indexOf(b)
      return i < 0 ? null : boneInverses[i].clone().invert()
    }
    for (const b of bones) {
      const w = enArmado(b)
      const pw = b.parent && enArmado(b.parent)
      if (!w || !pw) continue
      const q = new THREE.Quaternion()
      pw.invert().multiply(w).decompose(_v1, q, _s)
      armado.set(b, q)
    }
    return armado
  }

  const hombrosHueso = [h('shoulderl'), h('shoulderr')]
  const derechos = [huesos.rootx, huesos.spine_01x, huesos.spine_02x, huesos.spine_03x, huesos.cuello, huesos.cabeza, ...hombrosHueso]
  function inspeccionar(t, rig, fit) {
    const I = INSPECCION
    partirDelMixer()
    personaje.updateMatrixWorld(true)
    const alto = fit.alto
    const cuerpoQ = personaje.getWorldQuaternion(new THREE.Quaternion())
    const derecha = EJE_X.clone().applyQuaternion(cuerpoQ)
    const arriba = EJE_Y.clone().applyQuaternion(cuerpoQ)
    const adelante = EJE_Z.clone().applyQuaternion(cuerpoQ)
    const delCuerpo = (x, y, z) => personaje.localToWorld(new THREE.Vector3(x, y, z))
    const rotarMundo = (b, eje, ang) => {
      if (Math.abs(ang) < 1e-5) return
      b.getWorldQuaternion(_q1).invert()
      b.quaternion.multiply(_q2.setFromAxisAngle(_v1.copy(eje).applyQuaternion(_q1), ang))
      b.updateMatrixWorld(true)
    }
    const bump = (u, a, d) => Math.sin(Math.PI * tramo(u, a, a + d)) ** 2

    // ── De pie y derecho, sin el vaivén del idle ──────────────────────────
    // Cuándo suelta el segundo estirón: de ahí sale el relajamiento.
    const finEstiron = I.lados[1][0] + I.suelta
    const R = I.relaja
    const neutro = I.neutro * suave(tramo(t, 0, 0.4)) * (1 - suave(tramo(t, finEstiron + R.neutro[0], finEstiron + R.neutro[1])))
    if (neutro > 0.001) {
      const A = medirArmado()
      for (const b of derechos) {
        const q = b && A.get(b)
        if (!q) continue
        b.quaternion.slerp(q, neutro)
      }
      personaje.updateMatrixWorld(true)
    }

    // ── Las uñas ──────────────────────────────────────────────────────────
    const manos = I.manos.map(([a, s]) => {
      const u = t - a
      const llega = sale(tramo(u, I.llega[0], I.llega[1])) + 0.08 * Math.sin(Math.PI * tramo(u, 0.28, 0.62))
      const peso = Math.min(1, llega) * (1 - suave(tramo(u, I.regresa[0], I.regresa[1])))
      const revisa = suave(tramo(u, 0.35, 0.55)) * (1 - suave(tramo(u, I.aprueba, I.aprueba + 0.2)))
      const asiente = Math.sin(Math.PI * tramo(u, I.aprueba, I.aprueba + 0.28))
      const x = tramo(u, I.aprueba, I.aprueba + 0.4)
      const sacude = 0.3 * Math.sin(Math.PI * 3 * x) * (1 - x) ** 1.5
      // Cada dedo se dobla a su turno (índice, medio, meñique, pulgar), dos veces.
      const dedo = (k) => 0.55 * (bump(u, I.ola[0] + 0.07 * k, 0.22) + bump(u, I.ola[1] + 0.07 * k, 0.22))
      return { s, u, llega, peso, revisa, asiente, sacude, dedo }
    })
    const unas = (s) => manos.find((m) => m.s === s)
    const ve = manos.reduce((m, x) => Math.max(m, x.peso), 0)

    // ── Los estirones ─────────────────────────────────────────────────────
    const pulso = (u, a) => Math.sin(Math.PI * tramo(u, a, a + 0.4)) ** 2
    const resorte = (u) => {
      // Regresa pasándose un poco, sin arrancar de golpe (velocidad 0 al soltar).
      const x = tramo(u, I.suelta, I.suelta + I.regresa2)
      const r = 1 - Math.exp(-5 * x) * (Math.cos(6.9 * x) + 0.72 * Math.sin(6.9 * x))
      return lerp(r, 1, suave(tramo(x, 0.8, 1)))
    }
    const lados = I.lados.map(([desde, sube]) => {
      const u = t - desde
      const empuja = I.empujes.reduce((m, a) => m + pulso(u, a), 0)
      const brazo = suave(tramo(u, I.alza[0], I.alza[1])) * (1 - suave(tramo(u, I.baja[0], I.baja[1])))
      const dobla = (suave(tramo(u, I.dobla[0], I.dobla[1])) + I.empuje * empuja) * (1 - resorte(u))
      const aguanta = suave(tramo(u, I.dobla[1] - 0.25, I.dobla[1] + 0.15)) * (1 - suave(tramo(u, I.suelta, I.suelta + 0.35)))
      // Toma aire al alzar el brazo y lo suelta al regresar.
      const aire = 0.05 * Math.sin(Math.PI * tramo(u, 0, 1.0)) - 0.06 * Math.sin(Math.PI * tramo(u, I.suelta, I.suelta + 0.8))
      // Cuánto se despega cada pieza: crece de la mano a la columna y, al
      // soltar, regresa de golpe en el mismo orden con un rebotito.
      const D = I.despega
      const despega = (i) => {
        const d = D.desde + i * D.escalon
        const suelta = I.suelta + 0.035 * i
        const crece = suave(tramo(u, d, d + D.entra)) + 0.35 * empuja
        return crece * (1 - suave(tramo(u, suelta, suelta + 0.13))) + 0.3 * Math.sin(Math.PI * tramo(u, suelta + 0.13, suelta + 0.33))
      }
      return { u, sube, brazo, dobla, aguanta, empuja, aire, despega }
    })
    const brazoDe = (s) => lados.reduce((m, l) => m + (l.sube === s ? l.brazo : 0), 0)
    const despegaDe = (i, s) => lados.reduce((m, l) => m + (s == null || l.sube === s ? l.despega(i) : 0), 0)
    const ladoDobla = lados.reduce((m, l) => m + l.sube * l.dobla, 0)
    const inclina = I.inclina * ladoDobla
    const aire = lados.reduce((m, l) => m + l.aire, 0)
    const aguanta = lados.reduce((m, l) => m + l.aguanta, 0)
    const empuja = lados.reduce((m, l) => m + l.empuja * l.aguanta, 0)

    // Las piezas se despegan un poquito a lo largo de su hueso.
    const nombresPieza = Object.keys(I.despega.piezas)
    const despegar = (hueso, nombre, s) => {
      const i = nombresPieza.indexOf(nombre)
      const g = I.despega.piezas[nombre] * despegaDe(i, s)
      if (Math.abs(g) < 1e-6 || hueso.position.lengthSq() < 1e-12) return
      const escala = hueso.parent.matrixWorld.getMaxScaleOnAxis()
      hueso.position.addScaledVector(_v1.copy(hueso.position).normalize(), g * alto / escala)
      hueso.updateMatrixWorld(true)
    }

    // ── Las piernas abiertas y la cadera ──────────────────────────────────
    // Abre en dos pasitos al empezar el primer estirón (primero el pie del
    // brazo que sube) y cierra al terminar el segundo, al revés.
    const [l1, l2] = I.lados
    const abreEn = l1[0]
    const cierraEn = l2[0] + I.baja[1] - 0.1
    const primero = l1[1]
    const pie = (s) => {
      const [ida, vuelta] = s === primero ? [I.pasos[0], I.pasos[1]] : [I.pasos[1], I.pasos[0]]
      const a = tramo(t, abreEn + ida[0], abreEn + ida[1])
      const b = tramo(t, cierraEn + vuelta[0], cierraEn + vuelta[1])
      return { abre: suave(a) * (1 - suave(b)), alza: Math.sin(Math.PI * a) + Math.sin(Math.PI * b) }
    }
    const pesoPiernas = Math.min(1, pie(1).abre + pie(-1).abre + pie(1).alza + pie(-1).alza)
    const pies = pesoPiernas > 0.001 ? [[1, huesos.musloL, huesos.piernaL, huesos.pieL], [-1, huesos.musloR, huesos.piernaR, huesos.pieR]].map(([s, muslo, pierna, p]) => {
      const donde = p.getWorldPosition(new THREE.Vector3())
      const { abre, alza } = pie(s)
      // Parejos a los lados del cuerpo, a la altura del pie del idle.
      const parejo = personaje.getWorldPosition(new THREE.Vector3()).addScaledVector(derecha, s * I.piernas * alto)
      parejo.addScaledVector(arriba, donde.clone().sub(parejo).dot(arriba))
      return {
        muslo, pierna, pie: p,
        q: p.getWorldQuaternion(new THREE.Quaternion()),
        rodilla: pierna.getWorldPosition(new THREE.Vector3()).addScaledVector(adelante, 0.3 * alto * pesoPiernas),
        meta: donde.clone().lerp(parejo, abre).addScaledVector(arriba, alza * I.alzaPie * alto),
        largo: muslo.getWorldPosition(new THREE.Vector3()).distanceTo(pierna.getWorldPosition(new THREE.Vector3())) + pierna.getWorldPosition(new THREE.Vector3()).distanceTo(donde),
      }
    }) : null
    // La cadera sale hacia el lado del brazo que sube y baja lo que le falte a
    // las piernas para llegar al piso.
    {
      const r = huesos.rootx.getWorldPosition(new THREE.Vector3()).addScaledVector(derecha, ladoDobla * I.cadera * alto)
        .addScaledVector(derecha, -(pie(1).alza - pie(-1).alza) * R.peso * alto)
      if (pies) {
        let baja = 0
        const enR = r.clone().sub(huesos.rootx.getWorldPosition(new THREE.Vector3()))
        for (const { muslo, meta, largo } of pies) {
          const v = muslo.getWorldPosition(new THREE.Vector3()).add(enR).sub(meta)
          const alzado = v.dot(arriba)
          const lado = v.addScaledVector(arriba, -alzado).length()
          const cabe = largo * 0.97
          if (lado < cabe) baja = Math.max(baja, alzado - Math.sqrt(cabe * cabe - lado * lado))
        }
        r.addScaledVector(arriba, -Math.max(0, baja))
      }
      huesos.rootx.position.copy(huesos.rootx.parent.worldToLocal(r))
      huesos.rootx.updateMatrixWorld(true)
    }

    // ── La columna ────────────────────────────────────────────────────────
    // Toma aire, se inclina en C (más arriba) y, viéndose las uñas, se voltea
    // y se acerca a la mano.
    const giraTorso = I.torso.gira * manos.reduce((m, x) => m + x.s * x.peso, 0)
    ;['spine_01x', 'spine_02x', 'spine_03x'].forEach((nombre, i) => {
      const b = huesos[nombre]
      rotarMundo(b, adelante, inclina * I.curva[i])
      rotarMundo(b, derecha, -aire / 3 + I.torso.dobla * ve / 3)
      rotarMundo(b, arriba, giraTorso / 3)
    })
    for (const nombre of ['spine_02x', 'spine_03x', 'cuello']) despegar(huesos[nombre], nombre, null)

    // ── La cabeza ─────────────────────────────────────────────────────────
    const cab = huesos.cabeza
    const revisa = manos.reduce((m, x) => Math.max(m, x.revisa), 0)
    const asiente = manos.reduce((m, x) => m + x.asiente * x.peso, 0)
    const mira = I.mira * ve + 0.04 * revisa + 0.1 * asiente - 0.12 * aguanta
    rotarMundo(cab, derecha, mira)
    rotarMundo(cab, arriba, I.voltea * manos.reduce((m, x) => m + x.s * x.peso, 0))
    const xc = tramo(t, finEstiron + 0.3, finEstiron + 1.5)
    rotarMundo(cab, adelante, -I.ladea * manos.reduce((m, x) => m + x.s * x.revisa, 0) + 0.25 * inclina + R.cuello * Math.sin(2 * Math.PI * xc) * (1 - xc))
    const boca = Math.min(1, 0.5 * aguanta + 0.35 * empuja)
    if (boca > 0.001 && derechaCabeza) {
      const q = huesos.quijada
      const derechaMundo = derechaCabeza.clone().applyQuaternion(cab.getWorldQuaternion(new THREE.Quaternion()))
      q.getWorldQuaternion(_q1).invert()
      q.quaternion.multiply(_q2.setFromAxisAngle(derechaMundo.applyQuaternion(_q1), MORDIDA.abre * boca))
      q.updateMatrixWorld(true)
    }

    // ── Los pies, plantados ───────────────────────────────────────────────
    if (pies) {
      for (const { muslo, pierna, pie: p, q, rodilla, meta } of pies) {
        ik(muslo, pierna, p, meta, rodilla, 1)
        p.parent.getWorldQuaternion(_q3).invert().multiply(q)
        p.quaternion.copy(_q3)
        p.updateMatrixWorld(true)
      }
    }

    // ── Los brazos ────────────────────────────────────────────────────────
    const arribaTorso = arriba.clone().applyAxisAngle(adelante, inclina)
    const derechaTorso = derecha.clone().applyAxisAngle(adelante, inclina)
    const centroCab = centroLocal ? centroLocal.clone().applyMatrix4(cab.matrixWorld) : cab.getWorldPosition(new THREE.Vector3())
    // Al soltar el aire, los hombros caen un poco y regresan.
    const caen = Math.sin(Math.PI * tramo(t, finEstiron + 0.05, finEstiron + 0.75))
    if (caen > 0.001) hombrosHueso.forEach((b, i) => rotarMundo(b, adelante, -(i === 0 ? 1 : -1) * R.hombros * caen))
    // Y los brazos, ya abajo, se columpian por la inercia.
    const columpio = (s) => {
      const C = R.columpio
      const x = t - (finEstiron + C.desde + (s > 0 ? 0.08 : 0))
      if (x <= 0) return 0
      return C.a * Math.sin(2 * Math.PI * C.hz * x) * Math.exp(-C.frena * x) * (1 - suave(tramo(t, I.dura - 0.3, I.dura)))
    }
    for (const [s, brazo, antebrazo, mano] of [[1, huesos.brazoL, huesos.antebrazoL, huesos.manoL], [-1, huesos.brazoR, huesos.antebrazoR, huesos.manoR]]) {
      const m = unas(s)
      const e = m.peso
      const arribaW = brazoDe(s)
      const abajoW = brazoDe(-s)
      const peso = Math.max(e, arribaW, abajoW)
      if (peso < 0.001) {
        // Sin pose propia, el del idle tampoco se mete (colgando rozaba el muslo).
        rotarMundo(brazo, derecha, columpio(s))
        const meta = mano.getWorldPosition(new THREE.Vector3())
        const codo = antebrazo.getWorldPosition(new THREE.Vector3())
        apartar(s > 0 ? contacto?.brazoL : contacto?.brazoR, meta, (m) => ik(brazo, antebrazo, mano, m, codo, 1), alto)
        continue
      }
      // El hombro del brazo que sube se encoge (sube la clavícula), como en la
      // referencia: con su cabezota el brazo no alcanzaba a pasar por encima.
      if (arribaW > 0.001) rotarMundo(s > 0 ? hombrosHueso[0] : hombrosHueso[1], adelante, s * I.encoge * arribaW)
      const hombro = brazo.getWorldPosition(new THREE.Vector3())
      // Uñas: estirada abajo y al frente (pasándose un poco al llegar).
      // Estirón: en arco por encima de la cabeza hacia el otro lado (con el
      // codo afuera), más en cada empujón; o la mano en la cintura.
      const D = I.donde
      const objetivo = new THREE.Vector3()
      objetivo.addScaledVector(delCuerpo(s * D.x, D.y, D.z + 0.06 * (m.llega - Math.min(1, m.llega))), e)
      if (arribaW > 0.001) {
        // El arco: la mano hacia lo alto del cráneo, siempre a `dobla` de lo que
        // mide el brazo en ese momento (con lo que se despega): así el codo va
        // igual de doblado desde que empieza a subir (si no alcanzaba, iba recto
        // y solo se arqueaba ya despegado; Oscar).
        const arco = centroCab.clone().addScaledVector(arribaTorso, (I.arco.arriba + 0.02 * empuja) * alto).addScaledVector(derechaTorso, -s * I.arco.lado * alto)
        const P = I.despega.piezas
        const largo = hombro.distanceTo(antebrazo.getWorldPosition(new THREE.Vector3())) + antebrazo.getWorldPosition(new THREE.Vector3()).distanceTo(mano.getWorldPosition(new THREE.Vector3()))
          + (P.brazo * despegaDe(nombresPieza.indexOf('brazo'), s) + P.mano * despegaDe(nombresPieza.indexOf('mano'), s)) * alto
        const v = arco.sub(hombro).setLength(I.arco.dobla * largo)
        objetivo.addScaledVector(hombro.clone().add(v), arribaW)
      }
      if (abajoW > 0.001) {
        // La cintura: en la orilla de la pelvis medida, más el grosor de la
        // mano (adentro, la esquiva la sacaba a jalones; contra el fémur
        // quedaba lejos de la cadera, Oscar).
        const centro = (s > 0 ? huesos.musloL : huesos.musloR).getWorldPosition(new THREE.Vector3()).addScaledVector(arriba, I.cintura.y * alto)
        const lado = derecha.clone().multiplyScalar(s)
        const orilla = contacto?.cadera?.length ? Math.max(0, extremoEn(contacto.cadera, lado, centro)) : 0
        objetivo.addScaledVector(centro.addScaledVector(lado, orilla + I.cintura.x * alto), abajoW)
      }
      objetivo.divideScalar(e + arribaW + abajoW)
      // El codo afuera (y atrás en el arco y en la cintura; nunca en la línea
      // del brazo: ahí da la vuelta de golpe).
      const afuera = Math.min(1, arribaW + abajoW + 0.7 * e)
      const polo = hombro.clone()
        .addScaledVector(derecha, s * (0.38 + 0.2 * abajoW + 0.15 * arribaW) * alto * afuera)
        .addScaledVector(arriba, (-0.3 * (1 - afuera) + 0.12 * arribaW) * alto)
        .addScaledVector(adelante, (-0.45 + 0.25 * e + 0.3 * abajoW + 0.28 * arribaW) * alto)
      // La pose de la animación, para posar siempre desde ella.
      const piezas = [brazo, antebrazo, mano]
      const q0s = piezas.map((b) => b.quaternion.clone())
      const p0s = piezas.map((b) => b.position.clone())
      const q0 = q0s[2]
      const [giro, giro2] = s > 0 ? [huesos.giroL, huesos.giroL2] : [huesos.giroR, huesos.giroR2]
      const giros0 = [giro.quaternion.clone(), giro2.quaternion.clone()]
      const dedosDe = s > 0 ? dedos.L : dedos.R
      const dedos0 = dedosDe.map((f) => f.quaternion.clone())
      const posar = () => {
        piezas.forEach((b, i) => { b.quaternion.copy(q0s[i]); b.position.copy(p0s[i]); b.updateMatrixWorld(true) })
        giro.quaternion.copy(giros0[0])
        giro2.quaternion.copy(giros0[1])
        // El brazo que sube se despega antes de la IK: así la IK ya cuenta con
        // el brazo más largo y dobla el codo para pasar la mano por encima de
        // la cabeza (despegado después, quedaba recto y no llegaba; Oscar: como
        // en la referencia, un poco doblado con el codo afuera).
        if (arribaW > 0.001) {
          despegar(brazo, 'brazo', s)
          despegar(mano, 'mano', s)
        }
        // El brazo que sube pasa primero por un lado: de colgando a arriba el
        // giro corto queda a media vuelta, cambia de lado y torcía el antebrazo.
        if (arribaW > 0.001) {
          const A = brazo.getWorldPosition(new THREE.Vector3())
          apuntar(brazo, antebrazo.getWorldPosition(new THREE.Vector3()).sub(A), derecha.clone().multiplyScalar(s).addScaledVector(arriba, 0.3), arribaW)
        }
        ik(brazo, antebrazo, mano, objetivo, polo, peso)
        // La mano: para las uñas, la palma al piso y los dedos al frente, con la
        // sacudida de aprobación. En el arco la muñeca se dobla hacia la cabeza
        // y en la cintura un poco hacia atrás, desde la pose de la animación
        // (puesta en mundo, al subir y bajar el brazo el camino corto cambiaba
        // de lado y la mano daba media vuelta de un cuadro a otro).
        // La palma (el -z de la mano) hacia `hacia`, girando el antebrazo
        // entero sobre su eje (torciendo la muñeca se adelgazaba la malla).
        const voltearPalma = (hacia, cuanto) => {
          if (cuanto < 0.001) return
          const B = antebrazo.getWorldPosition(new THREE.Vector3())
          const eje = mano.getWorldPosition(new THREE.Vector3()).sub(B).normalize()
          const palma = new THREE.Vector3(0, 0, -1).transformDirection(mano.matrixWorld)
          palma.addScaledVector(eje, -palma.dot(eje))
          hacia.addScaledVector(eje, -hacia.dot(eje))
          if (palma.lengthSq() < 1e-6 || hacia.lengthSq() < 1e-6) return
          palma.normalize()
          hacia.normalize()
          rotarMundo(antebrazo, eje, cuanto * Math.atan2(eje.dot(_v2.crossVectors(palma, hacia)), palma.dot(hacia)))
        }
        // Uñas: la palma al piso y luego la muñeca hacia atrás: los dedos
        // arriba, la palma al frente y el dorso hacia su cara (Oscar: como
        // quien se ve las uñas). En el arco no se gira (con la pieza despegada,
        // la malla del codo quedaba como un hilo torcido, Oscar): el codo va
        // afuera y la muñeca se dobla hacia la cabeza, con la palma hacia adentro.
        voltearPalma(arriba.clone().negate(), e)
        mano.quaternion.multiply(_q4.setFromAxisAngle(EJE_X, -0.55 * arribaW + 0.3 * abajoW + (I.dorso + m.sacude) * e))
        limitarGiro(mano.quaternion, q0)
        mano.updateMatrixWorld(true)
        // El antebrazo se tuerce con la mano (sus huesos de giro son hermanos de ella).
        const dg = giroY(mano.quaternion) - giroY(q0)
        const torsion = Math.atan2(Math.sin(dg), Math.cos(dg))
        giro.quaternion.multiply(_q3.setFromAxisAngle(EJE_Y, torsion))
        giro2.quaternion.multiply(_q3.setFromAxisAngle(EJE_Y, torsion / 2))
        giro.updateMatrixWorld(true)
        giro2.updateMatrixWorld(true)
        // En el arco, la palma hacia adentro (viendo la cabeza, Oscar) girando
        // solo la mano, que va despegada: ni el codo ni el antebrazo se tuercen.
        // Le falta casi media vuelta: el ángulo va de 0 a una vuelta (no de
        // -media a media), para que no cambie de lado a medio camino.
        if (arribaW > 0.001) {
          const eje = mano.getWorldPosition(new THREE.Vector3()).sub(antebrazo.getWorldPosition(new THREE.Vector3())).normalize()
          const palma = new THREE.Vector3(0, 0, -1).transformDirection(mano.matrixWorld)
          palma.addScaledVector(eje, -palma.dot(eje))
          const hacia = centroCab.clone().sub(mano.getWorldPosition(new THREE.Vector3()))
          hacia.addScaledVector(eje, -hacia.dot(eje))
          if (palma.lengthSq() > 1e-6 && hacia.lengthSq() > 1e-6) {
            palma.normalize()
            hacia.normalize()
            let ang = Math.atan2(eje.dot(_v2.crossVectors(palma, hacia)), palma.dot(hacia))
            if (ang < 0) ang += 2 * Math.PI
            rotarMundo(mano, eje, arribaW * ang)
          }
        }
        rotarMundo(brazo, derecha, columpio(s))
        // Los dedos: estirados para las uñas, en ola revisándolas; estirados en
        // el arco; juntos en la cintura.
        dedosDe.forEach((f, i) => {
          const k = i < 9 ? Math.floor(i / 3) : 3
          const cierra = (-0.1 + 0.4 * m.dedo(k)) * e - (0.15 + 0.12 * aguanta) * arribaW + 0.1 * abajoW
          f.quaternion.copy(dedos0[i]).multiply(_q3.setFromAxisAngle(EJE_X, -cierra))
          f.updateMatrixWorld(true)
        })
      }
      // Que ni la mano ni el antebrazo se metan al cráneo o a las costillas.
      posar()
      apartar(s > 0 ? contacto?.brazoL : contacto?.brazoR, objetivo, posar, alto, 16, peso, 0.12)
    }
    auditar(t, fit, 'inspeccion')
    tocados.forEach((b, i) => copiar(escrita[i], b))
    hayEscrita = true
  }
  function dejarInspeccion() { reponer() }

  function soltar() {
    if (!activo) return
    activo = false
    estado = null
    tPrevio = 0
    reponer()
    rigidas.quitar()
    personaje.position.set(0, 0, 0)
    personaje.rotation.set(0, 0, 0)
    if (camina) { camina.setEffectiveWeight(0); camina.stop() }
    if (idle) idle.setEffectiveWeight(1)
    if (orbe) { orbe.position.set(0, -100, 0); orbe.visible = true; orbe.userData.desenfoque = 0; orbe.userData.queda = 1 }
  }

  // Diagnóstico de desarrollo: el punto más bajo del cuerpo y de la cabeza con
  // TODOS los vértices (caro: solo para medir).
  const enCabezaDx = new Set()
  huesos.cabeza.traverse((o) => { if (o.isBone) enCabezaDx.add(o) })
  function medirTodo() {
    personaje.updateMatrixWorld(true)
    const r = { cuerpo: Infinity, cabeza: Infinity, huesoCuerpo: '', huesoCabeza: '' }
    const v = new THREE.Vector3()
    personaje.traverse((m) => {
      if (!m.isMesh || !m.visible) return
      const g = m.geometry
      const pos = g.getAttribute('position')
      if (!pos) return
      const si = g.getAttribute('skinIndex')
      const sw = g.getAttribute('skinWeight')
      let ancestroCabeza = false
      for (let o = m.parent; o; o = o.parent) if (o === huesos.cabeza) { ancestroCabeza = true; break }
      for (let i = 0; i < pos.count; i++) {
        let hueso = null
        if (m.isSkinnedMesh && si && sw) {
          let k = 0
          for (let j = 1; j < 4; j++) if (sw.getComponent(i, j) > sw.getComponent(i, k)) k = j
          hueso = m.skeleton.bones[si.getComponent(i, k)]
          m.getVertexPosition(i, v)
        } else {
          v.fromBufferAttribute(pos, i)
        }
        v.applyMatrix4(m.matrixWorld)
        const esCabeza = hueso ? enCabezaDx.has(hueso) : ancestroCabeza
        if (esCabeza) { if (v.y < r.cabeza) { r.cabeza = v.y; r.huesoCabeza = hueso?.name || m.name } }
        else if (v.y < r.cuerpo) { r.cuerpo = v.y; r.huesoCuerpo = hueso?.name || m.name }
      }
    })
    return r
  }

  return { aplicar, soltar, inspeccionar, dejarInspeccion, piezas: rigidas.piezas, medirTodo, grabar: grabarSaltos }
}
