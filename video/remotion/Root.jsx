import React from 'react'
import { Composition, AbsoluteFill } from 'remotion'
import { cargarFuentes } from './fonts.js'
import { GlitchTitle } from './GlitchTitle.jsx'
import { Spot, DURACION_CUADROS, duracionCorte } from './Spot.jsx'

cargarFuentes()

const PruebaTitulo = () => (
  <AbsoluteFill style={{ background: '#1530d8' }}>
    <GlitchTitle lineas={['THE LAST DESIGNER', 'OF HUMANITY']} durationInFrames={120} colores={['#ffffff', '#f5ff00']} />
  </AbsoluteFill>
)

export const Root = () => (
  <>
    <Composition id="SpotX" component={Spot} durationInFrames={DURACION_CUADROS} fps={60} width={1920} height={1080} defaultProps={{ vertical: false }} />
    <Composition id="SpotV" component={Spot} durationInFrames={DURACION_CUADROS} fps={60} width={1080} height={1920} defaultProps={{ vertical: true }} />
    <Composition id="Corto64X" component={Spot} durationInFrames={duracionCorte(60.21)} fps={60} width={1920} height={1080} defaultProps={{ vertical: false, corte: 60.21 }} />
    <Composition id="Corto64V" component={Spot} durationInFrames={duracionCorte(60.21)} fps={60} width={1080} height={1920} defaultProps={{ vertical: true, corte: 60.21 }} />
    <Composition id="PruebaTitulo" component={PruebaTitulo} durationInFrames={120} fps={60} width={1920} height={1080} />
  </>
)
