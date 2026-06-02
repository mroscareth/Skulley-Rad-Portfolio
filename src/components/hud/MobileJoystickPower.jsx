import React from 'react'
import MobileJoystick from '../MobileJoystick.jsx'
import PowerBar from '../PowerBar.jsx'

// Mobile / iPad / hamburger-breakpoint HUD pair: on-screen joystick + horizontal
// power bar with a Bolt press button. Rendered only in HOME when orb-game not active.
// App owns placement/safe-insets/cooldown state; this component is pure rendering.
export default function MobileJoystickPower({
  powerSafeInsets,
  actionCooldown,
}) {
  const radius = 52
  const centerX = 'calc(1rem + 3.6rem)'
  const joyBottom = 'calc(1rem + 10.4rem + 0.75rem)'
  // Bolt enfrentado al joystick (mismo nivel horizontal): su wrapper tiene el
  // botón en el bottom, así que bottom = centro vertical del joystick (joyBottom + radius).
  const boltBottom = `calc(1rem + 10.4rem + 0.75rem + ${radius / 16}rem)`
  const keyDown = () => { try { window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })) } catch { } }
  const keyUp = () => { try { window.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' })) } catch { } }
  const chargeFill = Math.max(0, Math.min(1, 1 - actionCooldown))
  const glowOn = chargeFill >= 0.98
  return (
    <>
      <MobileJoystick
        radius={radius}
        style={{
          left: `calc(${centerX} - ${radius}px)`,
          bottom: joyBottom,
        }}
      />
      {/* Power: bolt VERTICAL anclado abajo-DERECHA (pulgar derecho, opuesto al
          joystick). La barra (vertical) crece desde el botón SOLO al presionar
          (revealBarOnPress) → no es invasiva. */}
      <div
        className="fixed z-[12010] pointer-events-none"
        style={{
          // Enfrentado al joystick: mismo nivel horizontal (boltBottom = centro
          // vertical del joystick), lado derecho (pulgar derecho).
          right: 'calc(env(safe-area-inset-right, 0px) + 1.5rem)',
          bottom: boltBottom,
        }}
      >
        <PowerBar
          orientation="vertical"
          fill={chargeFill}
          liveFillKey="__powerFillLive"
          glowOn={glowOn}
          boltScale={1.45}
          pressScale={1.22}
          pressStroke
          pressStrokeWidth={5}
          revealBarOnPress
          onPressStart={keyDown}
          onPressEnd={keyUp}
        />
      </div>
    </>
  )
}
