// Cuándo se detiene el loop del canvas de home: preloader encima, una sección
// abierta sin transición, pestaña oculta, o la ventana en que el preloader de
// sección tapa todo yendo a una sección.
//
// Lo usan PauseFrameloop (HomeScene) y la prop `frameloop` del <Canvas>
// (HomeCanvas). Tienen que coincidir: el <Canvas> de R3F vuelve a aplicar su
// prop `frameloop` (por defecto 'always') en CADA render, así que con solo
// PauseFrameloop el primer re-render de App lo despausaba. Medido en vivo el
// 2026-11-10: la escena completa se dibujaba detrás del preloader a 3840×1916
// con todo el post (~270 draws por cuadro) y el preloader bajaba a 10-20 fps.
// `historiaCubre`: "Conocer la historia" abierta encima de la home (App.jsx).
export function homeFramePaused({
  showPreloaderOverlay, showSectionUi, sectionUiAnimatingOut,
  transitionState, noiseMixEnabled, pageHidden, sectionCovered, historiaCubre,
}) {
  return Boolean(
    showPreloaderOverlay
    || historiaCubre
    || ((showSectionUi || sectionUiAnimatingOut) && !transitionState?.active && !noiseMixEnabled)
    || pageHidden
    || (sectionCovered && transitionState?.active && transitionState.to && transitionState.to !== 'home'),
  )
}
