// Skulley aislado en escritorio: un solo objeto que comparten la interfaz (DOM) y
// la escena (Canvas), con el patrón de toonInkBuffer: nada de esto pasa por estado
// de React porque se lee en cada cuadro.
//
// Al entrar a Customize la trama se come al mundo y Skulley se queda solo sobre su
// color (pedido de Oscar); al salir, el mundo regresa. Adentro, el marco del
// wallpaper (`enMarco`) es solo otro encuadre de lo mismo.
//
// fase: 'off' → 'entra' (la trama avanza) → 'lista' → 'sale' → 'off'. `onda` va de
// 0 a 1 y es lo único que mueve la trama (fx/TramaEffect.jsx).
export const WALLPAPER_W = 3840
export const WALLPAPER_H = 2160
// Con 4 GB de RAM o menos sale a 2560 × 1440.
export const WALLPAPER_W_POCA_MEMORIA = 2560

export const FONDO_KEY = 'skulley_wallpaper_fondo'
export function leerFondo(porDefecto = '#022dd6') {
  try {
    const v = localStorage.getItem(FONDO_KEY)
    return /^#[0-9a-f]{6}$/i.test(v || '') ? v : porDefecto
  } catch { return porDefecto }
}

export const wallpaperEstado = {
  fase: 'off',
  onda: 0,
  // Saliendo: la onda no regresa hasta que el cuadro esté como estaba.
  cubre: false,
  // La trama: dónde caen sus pies (uv), de qué color es y la silueta que respeta.
  pies: [0.5, 0.2],
  color: '#022dd6',
  mascara: null,
  runas: null,
  // Skulley: el giro se suma a como estaba (`yawBase`), y lo que se ve persigue
  // a `giro` para tapar los brincos entre eventos del mouse.
  yawBase: 0,
  giro: 0,
  giroVisto: 0,
  // El marco del wallpaper. Zoom y corrimiento del encuadre, en px de pantalla;
  // `plano` es un atajo por aplicar (Cuerpo / Cara) y `marco`, dónde cae
  // ({ x, y, w, h }).
  enMarco: false,
  zoom: 1,
  ox: 0,
  oy: 0,
  plano: null,
  marco: null,
  // El cuadro va de regreso al centro, sin tocar el zoom ni el giro.
  centrar: false,
  // Skulley en la pose del archivo, desde Crear hasta que cambies algo.
  quieto: false,
  // El texto gigante detrás de Skulley: un lienzo del tamaño del archivo que la
  // trama pinta sobre el fondo. `capaVersion` sube cuando cambia.
  capaLienzo: null,
  capaVersion: 0,
  capaHay: false,
  // El pedido de captura ({ ancho, fondo, resolve, reject }).
  captura: null,
  // Los deja HomeScene / PostFX: el plano de la sombra y el composer.
  sombra: null,
  composer: null,
}

export function entrarAislado(jugador, color) {
  const e = wallpaperEstado
  if (!jugador) return
  e.color = color
  if (e.fase === 'off') {
    e.yawBase = jugador.rotation.y
    e.giro = 0
    e.giroVisto = 0
    e.zoom = 1
    e.ox = 0
    e.oy = 0
    e.plano = null
    e.quieto = false
  }
  if (e.fase !== 'lista') e.fase = 'entra'
}

export function salirAislado() {
  const e = wallpaperEstado
  e.enMarco = false
  e.quieto = false
  e.captura = null
  if (e.fase !== 'off') e.fase = 'sale'
}
