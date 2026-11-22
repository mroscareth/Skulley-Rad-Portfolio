// La mezcla del sitio (Oscar, 2026-11-22): los efectos mandan sobre la música.
// La música de fondo va tenue para no invadir, y todo lo demás (los bips de los
// diálogos, los choques de las esferas, los botones) suena por encima, porque son
// detalles que tienen que llamar la atención. Aplica a todo sonido nuevo: sale por
// el bus de SFX (playSfx / getSfxBus) y se mide contra la música antes de subirlo.
//
// VOLUMEN_MUSICA lo usan el reproductor (MusicPlayer) y la canción del lobby
// (musicaLobby). REFUERZO_SFX es la ganancia de salida del bus de SFX, con un
// limitador detrás para que lo que se junte no sature (sfx.js).
export const VOLUMEN_MUSICA = 0.35
export const REFUERZO_SFX = 2
