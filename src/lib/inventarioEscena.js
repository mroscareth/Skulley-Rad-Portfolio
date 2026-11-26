// Inventario → Objetos (Oscar, 2026-11-25): mientras se ve la pestaña, Skulley se quita de en medio y
// en su lugar gira el objeto escogido (ObjetosInventario.jsx). CharacterCustomizer lo pide aquí
// (`ocultarSkulley`) y la escena lo pone (`ponerOculto`): en Customize, WallpaperEscena lo deshace en
// puntos (el mismo desintegrar de ir a una sección) y lo rearma al regresar; fuera, HomeScene lo pone de
// inmediato. HomeScene oculta su grupo raíz con lo que diga `skulleyOculto` (la tinta y la sombra no
// dibujan un grupo oculto). Sin three: CharacterCustomizer va en el chunk de entrada.

const st = { pide: false, oculto: false }
/** Lo que pide la interfaz (la pestaña de objetos). */
export function ocultarSkulley(si) { st.pide = Boolean(si) }
export const pideOculto = () => st.pide
/** Lo que se ve (lo pone la escena, con su animación). */
export function ponerOculto(si) { st.oculto = Boolean(si) }
export const skulleyOculto = () => st.oculto
