/**
 * GlitchImage — CSS-only glitch effect for blog cover images
 * Features:
 *   - Horizontal slice displacement (image splits into offset bands)
 *   - RGB channel separation (chromatic aberration)
 *   - Random rectangular artifacts with scanlines
 *   - Pixel block corruption squares
 *   - Smooth loop: glitch burst → calm pause → glitch burst
 *
 * Uses CSS custom properties, pseudo-elements, and keyframe animations.
 * No canvas, no JS animation loop — pure CSS performance.
 */

import React, { useId } from 'react'

const GLITCH_STYLES = `
/* ════════════════ GLITCH IMAGE CONTAINER ════════════════ */

.glitch-cover {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.glitch-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Base image layer with slice animation ── */
.glitch-cover__img {
  position: relative;
  width: 100%;
  height: 100%;
}

.glitch-cover__img img {
  animation: glitchSlice 8s infinite steps(1);
}

/* ── RGB channel clones (pseudo-elements on wrapper) ── */
.glitch-cover__r,
.glitch-cover__b {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.glitch-cover__r img,
.glitch-cover__b img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.glitch-cover__r {
  mix-blend-mode: screen;
  opacity: 0;
  animation: glitchRed 8s infinite steps(1);
}

.glitch-cover__b {
  mix-blend-mode: screen;
  opacity: 0;
  animation: glitchBlue 8s infinite steps(1);
}

.glitch-cover__r img {
  filter: saturate(0) brightness(1.2);
  /* Only red channel via CSS filter trick */
}

.glitch-cover__b img {
  filter: saturate(0) brightness(1.2);
}

/* ── Scanline overlay ── */
.glitch-cover__scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.08) 0px,
    rgba(0, 0, 0, 0.08) 1px,
    transparent 1px,
    transparent 3px
  );
  opacity: 0.6;
  animation: glitchScanFlicker 8s infinite;
}

/* ── Artifact rectangles (pseudo-element based) ── */
.glitch-cover__artifacts {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  opacity: 0;
  animation: glitchArtifacts 8s infinite steps(1);
}

.glitch-cover__artifacts::before,
.glitch-cover__artifacts::after {
  content: '';
  position: absolute;
  background: rgba(255, 107, 0, 0.15);
  border: 1px solid rgba(255, 107, 0, 0.3);
  animation: glitchRectMove 8s infinite steps(1);
}

.glitch-cover__artifacts::before {
  width: 60px;
  height: 8px;
  top: 20%;
  left: 10%;
}

.glitch-cover__artifacts::after {
  width: 40px;
  height: 12px;
  top: 65%;
  right: 15%;
  background: rgba(0, 255, 200, 0.1);
  border-color: rgba(0, 255, 200, 0.25);
}

/* ── Pixel corruption blocks ── */
.glitch-cover__pixels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
  opacity: 0;
  animation: glitchPixelBlocks 8s infinite steps(1);
}

.glitch-cover__pixels::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background:
    /* Scattered pixel blocks */
    linear-gradient(90deg, transparent 2%, rgba(255,107,0,0.12) 2%, rgba(255,107,0,0.12) 3%, transparent 3%) 0 15%,
    linear-gradient(90deg, transparent 70%, rgba(0,255,200,0.08) 70%, rgba(0,255,200,0.08) 73%, transparent 73%) 0 40%,
    linear-gradient(90deg, transparent 30%, rgba(255,50,50,0.1) 30%, rgba(255,50,50,0.1) 35%, transparent 35%) 0 55%,
    linear-gradient(90deg, transparent 55%, rgba(255,107,0,0.15) 55%, rgba(255,107,0,0.15) 58%, transparent 58%) 0 75%,
    linear-gradient(90deg, transparent 10%, rgba(0,200,255,0.08) 10%, rgba(0,200,255,0.08) 14%, transparent 14%) 0 85%;
  background-size: 100% 6px;
  background-repeat: no-repeat;
  animation: glitchPixelShift 8s infinite steps(1);
}

/* ── Horizontal slice lines (displacement bars) ── */
.glitch-cover__slices {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 6;
  overflow: hidden;
  opacity: 0;
  animation: glitchSliceVis 8s infinite steps(1);
}

.glitch-cover__slices::before,
.glitch-cover__slices::after {
  content: '';
  position: absolute;
  left: -5%;
  right: -5%;
  height: 4px;
  background: rgba(255, 107, 0, 0.2);
  box-shadow:
    0 0 8px rgba(255, 107, 0, 0.4),
    0 0 20px rgba(255, 107, 0, 0.1);
  animation: glitchSliceBar 8s infinite steps(1);
}

.glitch-cover__slices::before {
  top: 30%;
}

.glitch-cover__slices::after {
  top: 68%;
  height: 3px;
  background: rgba(0, 255, 200, 0.15);
  box-shadow:
    0 0 6px rgba(0, 255, 200, 0.3),
    0 0 15px rgba(0, 255, 200, 0.08);
}

/* ── Big glitch flash overlay ── */
.glitch-cover__flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 7;
  background: rgba(255, 107, 0, 0.03);
  opacity: 0;
  animation: glitchFlash 8s infinite;
}

/* ════════════════ KEYFRAME ANIMATIONS ════════════════ */

/*
  Timeline (8s cycle):
  0.0s – 3.0s : CALM (image visible, no glitch)
  3.0s – 3.8s : GLITCH BURST 1 (intense)
  3.8s – 5.5s : CALM
  5.5s – 6.0s : GLITCH BURST 2 (lighter)
  6.0s – 8.0s : CALM
*/

/* ── Main image slice displacement ── */
@keyframes glitchSlice {
  /* Calm periods */
  0%, 37%, 48%, 75%, 100% {
    clip-path: inset(0);
    transform: translate(0, 0);
    filter: none;
  }
  /* Burst 1 */
  37.5% {
    clip-path: inset(10% 0 60% 0);
    transform: translate(-8px, 0);
    filter: hue-rotate(15deg);
  }
  38.5% {
    clip-path: inset(30% 0 20% 0);
    transform: translate(12px, 0);
    filter: hue-rotate(-10deg);
  }
  39.5% {
    clip-path: inset(50% 0 10% 0);
    transform: translate(-5px, 0);
    filter: brightness(1.3);
  }
  40% {
    clip-path: inset(70% 0 5% 0);
    transform: translate(15px, 0);
  }
  41% {
    clip-path: inset(5% 0 80% 0);
    transform: translate(-20px, 0);
    filter: hue-rotate(20deg) brightness(1.1);
  }
  42% {
    clip-path: inset(40% 0 40% 0);
    transform: translate(8px, 0);
  }
  43% {
    clip-path: inset(60% 0 15% 0);
    transform: translate(-12px, 0);
    filter: saturate(1.5);
  }
  44% {
    clip-path: inset(20% 0 50% 0);
    transform: translate(6px, 0);
  }
  45% {
    clip-path: inset(0 0 70% 0);
    transform: translate(-3px, 2px);
  }
  46% {
    clip-path: inset(80% 0 0 0);
    transform: translate(10px, -1px);
  }
  47% {
    clip-path: inset(15% 0 65% 0);
    transform: translate(-15px, 0);
    filter: hue-rotate(-15deg);
  }
  /* Burst 2 (lighter) */
  69% {
    clip-path: inset(25% 0 50% 0);
    transform: translate(6px, 0);
  }
  70% {
    clip-path: inset(60% 0 20% 0);
    transform: translate(-8px, 0);
    filter: hue-rotate(10deg);
  }
  71% {
    clip-path: inset(10% 0 70% 0);
    transform: translate(4px, 0);
  }
  72% {
    clip-path: inset(45% 0 35% 0);
    transform: translate(-10px, 0);
  }
  73% {
    clip-path: inset(0);
    transform: translate(0, 0);
  }
}

/* ── Red channel ghost ── */
@keyframes glitchRed {
  0%, 37%, 48%, 68%, 75%, 100% {
    opacity: 0;
    transform: translate(0, 0);
  }
  38% {
    opacity: 0.5;
    transform: translate(4px, 0);
    filter: hue-rotate(-60deg) saturate(3);
  }
  39% {
    opacity: 0.3;
    transform: translate(-6px, 1px);
    filter: hue-rotate(-60deg) saturate(2);
  }
  40% {
    opacity: 0.6;
    transform: translate(8px, -1px);
    filter: hue-rotate(-60deg) saturate(4);
  }
  42% {
    opacity: 0.4;
    transform: translate(-3px, 0);
    filter: hue-rotate(-60deg) saturate(3);
  }
  44% {
    opacity: 0.2;
    transform: translate(5px, 2px);
    filter: hue-rotate(-60deg) saturate(2);
  }
  46% {
    opacity: 0.5;
    transform: translate(-7px, 0);
    filter: hue-rotate(-60deg) saturate(3);
  }
  47% {
    opacity: 0;
  }
  69% {
    opacity: 0.3;
    transform: translate(3px, 0);
    filter: hue-rotate(-60deg) saturate(2);
  }
  71% {
    opacity: 0.4;
    transform: translate(-5px, 1px);
    filter: hue-rotate(-60deg) saturate(3);
  }
  73% {
    opacity: 0;
  }
}

/* ── Blue channel ghost ── */
@keyframes glitchBlue {
  0%, 37%, 48%, 68%, 75%, 100% {
    opacity: 0;
    transform: translate(0, 0);
  }
  38% {
    opacity: 0.4;
    transform: translate(-5px, -1px);
    filter: hue-rotate(180deg) saturate(3);
  }
  39.5% {
    opacity: 0.5;
    transform: translate(7px, 0);
    filter: hue-rotate(180deg) saturate(2);
  }
  41% {
    opacity: 0.3;
    transform: translate(-4px, 2px);
    filter: hue-rotate(180deg) saturate(4);
  }
  43% {
    opacity: 0.6;
    transform: translate(6px, -1px);
    filter: hue-rotate(180deg) saturate(3);
  }
  45% {
    opacity: 0.2;
    transform: translate(-8px, 0);
    filter: hue-rotate(180deg) saturate(2);
  }
  47% {
    opacity: 0;
  }
  70% {
    opacity: 0.3;
    transform: translate(-4px, 0);
    filter: hue-rotate(180deg) saturate(2);
  }
  72% {
    opacity: 0.4;
    transform: translate(6px, -1px);
    filter: hue-rotate(180deg) saturate(3);
  }
  73% {
    opacity: 0;
  }
}

/* ── Artifact rectangles visibility ── */
@keyframes glitchArtifacts {
  0%, 37%, 48%, 68%, 75%, 100% { opacity: 0; }
  38% { opacity: 1; }
  40% { opacity: 0.8; }
  42% { opacity: 1; }
  44% { opacity: 0.6; }
  46% { opacity: 1; }
  47% { opacity: 0; }
  69% { opacity: 0.7; }
  71% { opacity: 0.9; }
  73% { opacity: 0; }
}

/* ── Artifact rectangles position jitter ── */
@keyframes glitchRectMove {
  0%, 37%, 48%, 100% {
    transform: translate(0, 0);
  }
  38% { transform: translate(30px, -5px) scaleX(1.5); }
  39% { transform: translate(-40px, 8px) scaleX(0.8); }
  40% { transform: translate(60px, -12px) scaleX(2); }
  41% { transform: translate(-20px, 15px) scaleX(1.2); }
  42% { transform: translate(45px, -3px) scaleX(0.6); }
  43% { transform: translate(-55px, 20px) scaleX(1.8); }
  44% { transform: translate(35px, -8px) scaleX(1.1); }
  45% { transform: translate(-15px, 10px) scaleX(2.2); }
  46% { transform: translate(50px, -18px) scaleX(0.9); }
  47% { transform: translate(0, 0) scaleX(1); }
  69% { transform: translate(25px, -6px) scaleX(1.3); }
  70% { transform: translate(-35px, 12px) scaleX(1.7); }
  71% { transform: translate(40px, -10px) scaleX(0.7); }
  73% { transform: translate(0, 0) scaleX(1); }
}

/* ── Pixel corruption blocks ── */
@keyframes glitchPixelBlocks {
  0%, 37%, 48%, 68%, 75%, 100% { opacity: 0; }
  38% { opacity: 0.8; }
  40% { opacity: 1; }
  42% { opacity: 0.6; }
  44% { opacity: 0.9; }
  46% { opacity: 0.7; }
  47% { opacity: 0; }
  70% { opacity: 0.5; }
  72% { opacity: 0.7; }
  73% { opacity: 0; }
}

@keyframes glitchPixelShift {
  0%, 37%, 48%, 100% {
    background-position:
      0 15%, 0 40%, 0 55%, 0 75%, 0 85%;
  }
  38% {
    background-position:
      10px 18%, -5px 38%, 15px 52%, -8px 78%, 12px 82%;
  }
  40% {
    background-position:
      -12px 12%, 8px 42%, -10px 58%, 20px 72%, -15px 88%;
  }
  42% {
    background-position:
      18px 20%, -15px 35%, 6px 50%, -12px 80%, 8px 90%;
  }
  44% {
    background-position:
      -8px 16%, 12px 44%, -20px 54%, 10px 76%, -6px 84%;
  }
  46% {
    background-position:
      15px 14%, -10px 40%, 8px 56%, -18px 74%, 20px 86%;
  }
}

/* ── Slice displacement bars ── */
@keyframes glitchSliceVis {
  0%, 37%, 48%, 68%, 75%, 100% { opacity: 0; }
  38% { opacity: 1; }
  41% { opacity: 0.7; }
  44% { opacity: 1; }
  47% { opacity: 0; }
  69% { opacity: 0.6; }
  72% { opacity: 0.8; }
  73% { opacity: 0; }
}

@keyframes glitchSliceBar {
  0%, 37%, 48%, 100% {
    transform: translateX(0);
  }
  38% { transform: translateX(-15px); }
  39% { transform: translateX(20px); }
  40% { transform: translateX(-25px); }
  41% { transform: translateX(10px); }
  42% { transform: translateX(-18px); }
  43% { transform: translateX(30px); }
  44% { transform: translateX(-8px); }
  45% { transform: translateX(22px); }
  46% { transform: translateX(-12px); }
  47% { transform: translateX(0); }
  69% { transform: translateX(10px); }
  70% { transform: translateX(-15px); }
  71% { transform: translateX(8px); }
  73% { transform: translateX(0); }
}

/* ── Scanline flicker ── */
@keyframes glitchScanFlicker {
  0%, 37%, 48%, 68%, 75%, 100% { opacity: 0.4; }
  38% { opacity: 0.9; }
  39% { opacity: 0.5; }
  40% { opacity: 1; }
  41% { opacity: 0.6; }
  42% { opacity: 0.95; }
  43% { opacity: 0.4; }
  44% { opacity: 0.85; }
  45% { opacity: 0.55; }
  46% { opacity: 0.9; }
  47% { opacity: 0.4; }
  69% { opacity: 0.7; }
  70% { opacity: 0.9; }
  71% { opacity: 0.6; }
  73% { opacity: 0.4; }
}

/* ── Flash overlay ── */
@keyframes glitchFlash {
  0%, 37%, 48%, 68%, 75%, 100% {
    opacity: 0;
    background: transparent;
  }
  37.5% {
    opacity: 0.8;
    background: rgba(255, 255, 255, 0.08);
  }
  38% {
    opacity: 0;
  }
  42% {
    opacity: 0.5;
    background: rgba(255, 107, 0, 0.06);
  }
  42.5% {
    opacity: 0;
  }
  46% {
    opacity: 0.3;
    background: rgba(0, 255, 200, 0.04);
  }
  46.5% {
    opacity: 0;
  }
  69% {
    opacity: 0.4;
    background: rgba(255, 255, 255, 0.05);
  }
  69.5% {
    opacity: 0;
  }
}

/* ── Reduce motion preference ── */
@media (prefers-reduced-motion: reduce) {
  .glitch-cover * {
    animation: none !important;
  }
}
`

export default function GlitchImage({ src, alt = '', className = '' }) {
    const id = useId()

    if (!src) return null

    return (
        <>
            <style>{GLITCH_STYLES}</style>
            <div className={`glitch-cover ${className}`}>
                {/* Main image with slice displacement */}
                <div className="glitch-cover__img">
                    <img src={src} alt={alt} loading="eager" />
                </div>

                {/* Red channel clone */}
                <div className="glitch-cover__r">
                    <img src={src} alt="" aria-hidden="true" />
                </div>

                {/* Blue channel clone */}
                <div className="glitch-cover__b">
                    <img src={src} alt="" aria-hidden="true" />
                </div>

                {/* Pixel corruption blocks */}
                <div className="glitch-cover__pixels" />

                {/* Artifact rectangles */}
                <div className="glitch-cover__artifacts" />

                {/* Slice displacement bars */}
                <div className="glitch-cover__slices" />

                {/* Scanlines */}
                <div className="glitch-cover__scanlines" />

                {/* Flash overlay */}
                <div className="glitch-cover__flash" />
            </div>
        </>
    )
}
