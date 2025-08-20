import React, { useRef, useState, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Environment from './components/Environment.jsx'
import Player from './components/Player.jsx'
import Portal from './components/Portal.jsx'
import CameraController from './components/CameraController.jsx'
import TransitionOverlay from './components/TransitionOverlay.jsx'
import CharacterPortrait from './components/CharacterPortrait.jsx'
import PostFX from './components/PostFX.jsx'
import FollowLight from './components/FollowLight.jsx'
import PortalParticles from './components/PortalParticles.jsx'
// (Tumba removida)
import Section1 from './components/Section1.jsx'
import Section2 from './components/Section2.jsx'
import Section3 from './components/Section3.jsx'
import Section4 from './components/Section4.jsx'

// Define a colour palette for each section.  These values are used by the
// shader transition material to create a smooth transition between pages.
const sectionColors = {
  home: '#0f172a',
  section1: '#264653',
  section2: '#2a9d8f',
  section3: '#e9c46a',
  section4: '#e76f51',
}

export default function App() {
  // Estado para sliders de postprocesado (UI fuera del Canvas)
  const [fx, setFx] = useState({
    bloom: 0.41,
    vignette: 0.42,
    noise: 0.08,
    dotEnabled: true,
    dotScale: 0.7,
    dotAngle: 0.7853981633974483,
    dotCenterX: 0.38,
    dotCenterY: 0.44,
    dotOpacity: 0.04,
    dotBlend: 'screen',
    godEnabled: false,
    godDensity: 0.35,
    godDecay: 0.62,
    godWeight: 0.5,
    godExposure: 0.22,
    godClampMax: 0.56,
    godSamples: 39,
    dofEnabled: false,
    dofProgressive: true,
    dofFocusDistance: 0.2,
    dofFocalLength: 0.034,
    dofBokehScale: 4.2,
    dofFocusSpeed: 0.12,
  })
  const [topLight, setTopLight] = useState({ height: 3.3, intensity: 8, angle: 1.2, penumbra: 0.6 })
  const [showFxPanel, setShowFxPanel] = useState(false)
  const [showLightPanel, setShowLightPanel] = useState(false)
  const [showPortraitPanel, setShowPortraitPanel] = useState(false)
  const [copiedFx, setCopiedFx] = useState(false)
  // Track which section is currently active (home by default)
  const [section, setSection] = useState('home')
  // Track transition state; when active we animate the shader and then switch sections
  const [transitionState, setTransitionState] = useState({ active: false, from: 'home', to: null })
  const [eggActive, setEggActive] = useState(false)

  // Keep a ref to the player so the camera controller can follow it
  const playerRef = useRef()
  const sunRef = useRef()
  const dofTargetRef = playerRef // enfocamos al jugador

  // Define portal locations once.  Each portal leads to a specific section.
  const portals = useMemo(
    () => [
      // Alejados ligeramente del centro
      { id: 'section1', position: [0, 0, -16] },
      { id: 'section2', position: [16, 0, 0] },
      { id: 'section3', position: [-16, 0, 0] },
      { id: 'section4', position: [0, 0, 16] },
    ],
    [],
  )

  // Handler called when the player collides with a portal.  We initiate a transition
  // to the target section if we are not already transitioning.
  const handlePortalEnter = (target) => {
    if (!transitionState.active && target !== section) {
      setTransitionState({ active: true, from: section, to: target })
    }
  }

  // Called by the TransitionOverlay after the shader animation finishes.  We then
  // update the current section and reset the transition state.
  const handleTransitionComplete = () => {
    setSection(transitionState.to)
    setTransitionState({ active: false, from: transitionState.to || section, to: null })
  }

  const [tintFactor, setTintFactor] = useState(0)
  const baseBg = '#204580'
  const nearColor = '#0a132b'
  function lerpColor(hex1, hex2, t) {
    const c1 = parseInt(hex1.slice(1), 16)
    const c2 = parseInt(hex2.slice(1), 16)
    const r = Math.round(((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t)
    const g = Math.round(((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t)
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t)
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
  }
  const redEgg = '#7a0b0b'
  const sceneColor = eggActive ? redEgg : lerpColor(baseBg, nearColor, tintFactor)

  

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* The main WebGL canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 3, 8], fov: 60 }}
        // Use linear rendering to avoid washed out colours on some displays
      >
        <Suspense fallback={null}>
          <Environment overrideColor={sceneColor} />
          {/* Ancla para God Rays (malla invisible con material válido) */}
          <mesh ref={sunRef} position={[0, 8, 0]}>
            <sphereGeometry args={[0.35, 12, 12]} />
            <meshBasicMaterial color={'#ffffff'} transparent opacity={0} />
          </mesh>
          <Player
            playerRef={playerRef}
            portals={portals}
            onPortalEnter={handlePortalEnter}
            onProximityChange={setTintFactor}
          />
          {/* Tumba removida */}
          <FollowLight playerRef={playerRef} height={topLight.height} intensity={topLight.intensity} angle={topLight.angle} penumbra={topLight.penumbra} color={'#fff'} />
          {portals.map((p) => (
            <group key={p.id}>
              <Portal position={p.position} color={'#8ecae6'} size={2} />
              <PortalParticles center={p.position} radius={4} count={260} color={'#9ec6ff'} playerRef={playerRef} frenzyRadius={10} />
            </group>
          ))}
          <CameraController playerRef={playerRef} />
          {/* Perf can be used during development to monitor FPS; disabled by default. */}
          {/* <Perf position="top-left" /> */}
          {/* Postprocessing effects */}
          <PostFX
            bloom={fx.bloom}
            vignette={fx.vignette}
            noise={fx.noise}
            dotEnabled={fx.dotEnabled}
            dotScale={fx.dotScale}
            dotAngle={fx.dotAngle}
            dotCenterX={fx.dotCenterX}
            dotCenterY={fx.dotCenterY}
            dotOpacity={fx.dotOpacity}
            dotBlend={fx.dotBlend}
            godEnabled={fx.godEnabled}
            godSun={sunRef}
            godDensity={fx.godDensity}
            godDecay={fx.godDecay}
            godWeight={fx.godWeight}
            godExposure={fx.godExposure}
            godClampMax={fx.godClampMax}
            godSamples={fx.godSamples}
            dofEnabled={fx.dofEnabled}
            dofProgressive={fx.dofProgressive}
            dofFocusDistance={fx.dofFocusDistance}
            dofFocalLength={fx.dofFocalLength}
            dofBokehScale={fx.dofBokehScale}
            dofFocusSpeed={fx.dofFocusSpeed}
            dofTargetRef={dofTargetRef}
          />
          <TransitionOverlay
            active={transitionState.active}
            fromColor={sectionColors[transitionState.from]}
            toColor={sectionColors[transitionState.to || section]}
            duration={1.5}
            onComplete={handleTransitionComplete}
          />
        </Suspense>
      </Canvas>
      {/* Section content overlay.  We position it absolutely so it sits on top of the canvas. */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
        {section === 'section1' && <Section1 />}
        {section === 'section2' && <Section2 />}
        {section === 'section3' && <Section3 />}
        {section === 'section4' && <Section4 />}
      </div>
      {/* Toggle panel FX */}
      <button
        type="button"
        onClick={() => setShowFxPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 bottom-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md"
        aria-label="Toggle panel FX"
      >FX</button>
      {/* Panel externo para ajustar postprocesado */}
      {showFxPanel && (
      <div className="pointer-events-auto fixed right-4 bottom-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none">
        <div className="text-xs font-semibold opacity-80">Post‑Processing</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>GodRays</span>
          <input
            type="checkbox"
            checked={fx.godEnabled}
            onChange={(e) => {
              const enabled = e.target.checked
              // Si se activa y seguimos en los valores por defecto suaves, aplicar un preset más evidente
              const looksDefault = fx.godDensity === 0.9 && fx.godDecay === 0.95 && fx.godWeight === 0.6 && fx.godExposure === 0.3 && fx.godClampMax === 1.0 && fx.godSamples === 60
              setFx({
                ...fx,
                godEnabled: enabled,
                ...(enabled && looksDefault
                  ? { godDensity: 1.1, godDecay: 0.94, godWeight: 1.0, godExposure: 0.6, godClampMax: 1.2, godSamples: 80 }
                  : {}),
              })
            }}
          />
        </div>
        {fx.godEnabled && (
          <>
            <label className="block text-[11px] opacity-80">Density: {fx.godDensity.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godDensity} onChange={(e) => setFx({ ...fx, godDensity: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Decay: {fx.godDecay.toFixed(2)}
              <input className="w-full" type="range" min="0.5" max="1.0" step="0.01" value={fx.godDecay} onChange={(e) => setFx({ ...fx, godDecay: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Weight: {fx.godWeight.toFixed(2)}
              <input className="w-full" type="range" min="0.1" max="1.5" step="0.01" value={fx.godWeight} onChange={(e) => setFx({ ...fx, godWeight: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Exposure: {fx.godExposure.toFixed(2)}
              <input className="w-full" type="range" min="0.0" max="1.0" step="0.01" value={fx.godExposure} onChange={(e) => setFx({ ...fx, godExposure: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">ClampMax: {fx.godClampMax.toFixed(2)}
              <input className="w-full" type="range" min="0.2" max="2.0" step="0.01" value={fx.godClampMax} onChange={(e) => setFx({ ...fx, godClampMax: parseFloat(e.target.value) })} />
            </label>
            <label className="block text-[11px] opacity-80">Samples: {fx.godSamples}
              <input className="w-full" type="range" min="16" max="120" step="1" value={fx.godSamples} onChange={(e) => setFx({ ...fx, godSamples: parseInt(e.target.value, 10) })} />
            </label>
          </>
        )}
        <label className="block text-[11px] opacity-80">Bloom: {fx.bloom.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1.5" step="0.01" value={fx.bloom} onChange={(e) => setFx({ ...fx, bloom: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Vignette: {fx.vignette.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.vignette} onChange={(e) => setFx({ ...fx, vignette: parseFloat(e.target.value) })} />
        </label>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Halftone (DotScreen)</span>
          <input type="checkbox" checked={fx.dotEnabled} onChange={(e) => setFx({ ...fx, dotEnabled: e.target.checked })} />
        </div>
        <label className="block text-[11px] opacity-80">Dot scale: {fx.dotScale.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3" step="0.01" value={fx.dotScale} onChange={(e) => setFx({ ...fx, dotScale: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">Dot angle: {fx.dotAngle.toFixed(2)}
          <input className="w-full" type="range" min="0" max="3.1416" step="0.01" value={fx.dotAngle} onChange={(e) => setFx({ ...fx, dotAngle: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <div className="flex gap-2">
          <label className="flex-1 block text-[11px] opacity-80">Center X: {fx.dotCenterX.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterX} onChange={(e) => setFx({ ...fx, dotCenterX: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
          <label className="flex-1 block text-[11px] opacity-80">Center Y: {fx.dotCenterY.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotCenterY} onChange={(e) => setFx({ ...fx, dotCenterY: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
          </label>
        </div>
        <label className="block text-[11px] opacity-80">Dot opacity: {fx.dotOpacity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={fx.dotOpacity} onChange={(e) => setFx({ ...fx, dotOpacity: parseFloat(e.target.value) })} disabled={!fx.dotEnabled} />
        </label>
        <label className="block text-[11px] opacity-80">Dot blend
          <select
            className="w-full bg-black/30 border border-white/10 rounded mt-1"
            value={fx.dotBlend}
            onChange={(e) => setFx({ ...fx, dotBlend: e.target.value })}
            disabled={!fx.dotEnabled}
          >
            <option value="normal">Normal</option>
            <option value="multiply">Multiply</option>
            <option value="screen">Screen</option>
            <option value="overlay">Overlay</option>
            <option value="softlight">SoftLight</option>
            <option value="add">Add</option>
            <option value="darken">Darken</option>
            <option value="lighten">Lighten</option>
          </select>
        </label>
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          onClick={async () => {
            const preset = JSON.stringify(fx, null, 2)
            try {
              await navigator.clipboard.writeText(preset)
            } catch {
              const ta = document.createElement('textarea')
              ta.value = preset
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
            }
            setCopiedFx(true)
            setTimeout(() => setCopiedFx(false), 1200)
          }}
        >{copiedFx ? '¡Copiado!' : 'Copiar preset FX'}</button>
        <label className="block text-[11px] opacity-80">Noise: {fx.noise.toFixed(2)}
          <input className="w-full" type="range" min="0" max="0.6" step="0.01" value={fx.noise} onChange={(e) => setFx({ ...fx, noise: parseFloat(e.target.value) })} />
        </label>
        <div className="h-px bg-white/10 my-2" />
        <div className="text-xs font-semibold opacity-80">Depth of Field</div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Activar</span>
          <input type="checkbox" checked={fx.dofEnabled} onChange={(e) => setFx({ ...fx, dofEnabled: e.target.checked })} />
        </div>
        <div className="flex items-center justify-between text-[11px] opacity-80">
          <span>Progresivo</span>
          <input type="checkbox" checked={fx.dofProgressive} onChange={(e) => setFx({ ...fx, dofProgressive: e.target.checked })} />
        </div>
        {!fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">Focus distance: {fx.dofFocusDistance.toFixed(2)}
            <input className="w-full" type="range" min="0" max="1" step="0.005" value={fx.dofFocusDistance} onChange={(e) => setFx({ ...fx, dofFocusDistance: parseFloat(e.target.value) })} />
          </label>
        )}
        <label className="block text-[11px] opacity-80">Focal length: {fx.dofFocalLength.toFixed(3)}
          <input className="w-full" type="range" min="0.001" max="0.06" step="0.001" value={fx.dofFocalLength} onChange={(e) => setFx({ ...fx, dofFocalLength: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Bokeh scale: {fx.dofBokehScale.toFixed(1)}
          <input className="w-full" type="range" min="0.5" max="6" step="0.1" value={fx.dofBokehScale} onChange={(e) => setFx({ ...fx, dofBokehScale: parseFloat(e.target.value) })} />
        </label>
        {fx.dofProgressive && (
          <label className="block text-[11px] opacity-80">Focus speed: {fx.dofFocusSpeed.toFixed(2)}
            <input className="w-full" type="range" min="0.02" max="0.5" step="0.01" value={fx.dofFocusSpeed} onChange={(e) => setFx({ ...fx, dofFocusSpeed: parseFloat(e.target.value) })} />
          </label>
        )}
      </div>
      )}
      {/* Panel externo para ajustar la luz superior */}
      <button
        type="button"
        onClick={() => setShowLightPanel((v) => !v)}
        className="pointer-events-auto fixed right-4 top-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md"
        aria-label="Toggle panel Luz"
      >Luz</button>
      {showLightPanel && (
      <div className="pointer-events-auto fixed right-4 top-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none">
        <button
          type="button"
          className="mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors"
          onClick={async () => {
            const preset = JSON.stringify(topLight, null, 2)
            try {
              await navigator.clipboard.writeText(preset)
            } catch {
              const ta = document.createElement('textarea')
              ta.value = preset
              document.body.appendChild(ta)
              ta.select()
              document.execCommand('copy')
              document.body.removeChild(ta)
            }
          }}
        >Copiar preset Luz</button>
        <div className="text-xs font-semibold opacity-80">Luz superior</div>
        <label className="block text-[11px] opacity-80">Altura: {topLight.height.toFixed(2)}
          <input className="w-full" type="range" min="2" max="12" step="0.05" value={topLight.height} onChange={(e) => setTopLight({ ...topLight, height: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Intensidad: {topLight.intensity.toFixed(2)}
          <input className="w-full" type="range" min="0" max="8" step="0.05" value={topLight.intensity} onChange={(e) => setTopLight({ ...topLight, intensity: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Ángulo: {topLight.angle.toFixed(2)}
          <input className="w-full" type="range" min="0.1" max="1.2" step="0.01" value={topLight.angle} onChange={(e) => setTopLight({ ...topLight, angle: parseFloat(e.target.value) })} />
        </label>
        <label className="block text-[11px] opacity-80">Penumbra: {topLight.penumbra.toFixed(2)}
          <input className="w-full" type="range" min="0" max="1" step="0.01" value={topLight.penumbra} onChange={(e) => setTopLight({ ...topLight, penumbra: parseFloat(e.target.value) })} />
        </label>
      </div>
      )}
      {/* Portrait del personaje en cápsula, esquina inferior izquierda */}
      <CharacterPortrait
        showUI={showPortraitPanel}
        dotEnabled={fx.dotEnabled}
        dotScale={fx.dotScale}
        dotAngle={fx.dotAngle}
        dotCenterX={fx.dotCenterX}
        dotCenterY={fx.dotCenterY}
        dotOpacity={fx.dotOpacity}
        dotBlend={fx.dotBlend}
        onEggActiveChange={setEggActive}
      />
      {/* Toggle panel Retrato */}
      <button
        type="button"
        onClick={() => setShowPortraitPanel((v) => !v)}
        className="pointer-events-auto fixed left-40 bottom-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md"
        aria-label="Toggle panel Retrato"
      >Ret</button>
    </div>
  )
}