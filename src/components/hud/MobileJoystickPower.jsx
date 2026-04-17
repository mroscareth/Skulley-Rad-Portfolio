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
      {/* Power UI (horizontal bar + Bolt button) — placed within the free gap
          between portrait-left and controls-right, with iOS safe-area. */}
      <div
        className="fixed z-[12010] pointer-events-none"
        style={{
          left: `${powerSafeInsets.left}px`,
          right: `${powerSafeInsets.right}px`,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem + 40px)',
        }}
      >
        <div className="relative w-full max-w-[320px] mx-auto pointer-events-none">
          <PowerBar
            orientation="horizontal"
            fill={chargeFill}
            liveFillKey="__powerFillLive"
            glowOn={glowOn}
            boltScale={1.3}
            pressScale={1.3}
            pressStroke
            pressStrokeWidth={5}
            onPressStart={keyDown}
            onPressEnd={keyUp}
          />
        </div>
      </div>
    </>
  )
}
