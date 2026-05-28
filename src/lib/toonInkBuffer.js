// Holder compartido entre CharacterNormalPass (Canvas) y EdgeInk (PostFX).
//  - current: textura del normal-render EXCLUSIVO del personaje.
//  - scale:   factor de grosor por distancia (1 cerca, <1 lejos) → evita que
//             las líneas se vean gruesas/sucias cuando la cámara se aleja.
export const characterNormalTexture = { current: null, scale: 1 }

// Holder separado para el retrato (CharacterPortrait), que corre en su PROPIO
// Canvas → no puede compartir buffer con la escena principal.
export const portraitNormalTexture = { current: null, scale: 1 }

// Holder para los housebirds del About (otro Canvas).
export const housebirdsNormalTexture = { current: null, scale: 1 }
