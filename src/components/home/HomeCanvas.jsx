import React from 'react'
import { Canvas } from '@react-three/fiber'
import HomeScene from './HomeScene.jsx'
import { canvasGLOptions, computeCanvasDpr, createOnCanvasCreated } from '../../lib/canvasSetup.js'
import patchThreeLoseContext from '../../lib/patchThreeLoseContext.js'

// Apply once at module load — idempotent.
patchThreeLoseContext()

// Wraps the <Canvas> + the full 3D scene.
// Imported lazily from App.jsx so that `three`, `@react-three/fiber`,
// `@react-three/drei` and the scene graph drop out of the eager vendor
// chunk — they now download in parallel while the HTML boot preloader
// shows. Saves ~X KB gzip in the first-paint download.
export default function HomeCanvas(props) {
  const {
    pageHidden, degradedMode, isMobilePerf, glRef, setDegradedMode,
    ...scene
  } = props
  return (
    <Canvas
      shadows={false}
      dpr={computeCanvasDpr({ pageHidden, degradedMode, isMobilePerf })}
      gl={canvasGLOptions}
      camera={{ position: [0, 3, 8], fov: 60, near: 0.1, far: 2000 }}
      events={undefined}
      onCreated={createOnCanvasCreated({ glRef, setDegradedMode })}
    >
      <HomeScene
        pageHidden={pageHidden}
        degradedMode={degradedMode}
        isMobilePerf={isMobilePerf}
        setDegradedMode={setDegradedMode}
        {...scene}
      />
    </Canvas>
  )
}
