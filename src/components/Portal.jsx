import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ALPHABET_MAP } from '../lib/runeAlphabet.js'

/**
 * Portal — ritual arcano compuesto por tres capas:
 *   1. Torus anillo con shader de plasma + runas (Tier 1)
 *   2. Disco interior con vórtice (Tier 2)
 *   3. Círculo mágico en el suelo con runas giratorias (Tier 3)
 *
 * Mantiene la API original (position, color, targetColor, mix, size, flicker,
 * flickerKey) para que `HomeScene.jsx` no cambie. Añade un prop opcional
 * `lowPerf` para reducir octavas de noise en mobile.
 */

// Noise helpers — compartidos por los 3 shaders. Se inyectan en cada fragment
// vía template string. 3 octavas de FBM = barato, 4 = más detalle.
const NOISE_GLSL = /* glsl */`
  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`

// ── TORUS (Tier 1): anillo de plasma con runas + fresnel ───────────────────
const TORUS_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`
const TORUS_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uFlicker;
  uniform float uDarkMode; // 1.0 apaga plasma+scanlines → anillo casi negro
                           // con solo runas/data/sweep/glitch brillando (rojo).
  ${NOISE_GLSL}

  // Runas pixel-perfect: grid-aligned, bordes duros (step en vez de smoothstep)
  // → lee como display digital / circuit board, no como grabado rústico.
  float runeStampDigital(vec2 uv, float slots) {
    float slot = floor(uv.x * slots);
    vec2 local = vec2(fract(uv.x * slots), uv.y);
    vec2 cell = floor(local * vec2(3.0, 5.0));
    vec2 cellLocal = fract(local * vec2(3.0, 5.0));
    float cellHash = hash21(vec2(slot, cell.x * 5.0 + cell.y));
    // Band con bordes duros — 50% central del tube
    float yMask = step(0.25, local.y) * (1.0 - step(0.75, local.y));
    // Celda pixel-perfect (90% de cada cell lit, 10% de "gap" entre pixeles)
    float shape = step(0.10, cellLocal.x) * (1.0 - step(0.90, cellLocal.x)) *
                  step(0.10, cellLocal.y) * (1.0 - step(0.90, cellLocal.y));
    return step(0.55, cellHash) * yMask * shape;
  }

  // Data strip: grid de celdas pixeladas que aparecen/desaparecen con un
  // reloj cuantizado — efecto scroll de binario/hex tipo terminal.
  float dataStrip(vec2 uv, float yMin, float yMax, float cellsX, float speed, float seed) {
    float band = step(yMin, uv.y) * (1.0 - step(yMax, uv.y));
    if (band < 0.5) return 0.0;
    float cellX = floor(uv.x * cellsX + uTime * speed);
    float cellY = floor((uv.y - yMin) / (yMax - yMin) * 2.0);
    // Floor uTime a un tick rate específico → las celdas cambian en steps
    // discretos (lectura de ticker, no flujo continuo).
    float tick = floor(uTime * 6.0);
    float h = hash21(vec2(cellX + seed, cellY * 17.0 + tick * 0.37));
    return step(0.62, h) * band;
  }

  void main() {
    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));

    // ── Layer 1: Plasma POSTERIZADO — no es flujo continuo, es "campo de
    //    datos" cuantizado en 6 niveles. Borra el look orgánico del FBM puro.
    vec2 flowUv = vec2(vUv.x * 8.0 + uTime * 0.18, vUv.y * 3.0 - uTime * 0.10);
    float flow = fbm(flowUv);
    flow = floor(flow * 6.0) / 6.0;
    float plasma = 0.40 + flow * 0.55;

    // ── Layer 2: Scanlines en el tube (lectura CRT/display)
    float scanline = 0.5 + 0.5 * cos(vUv.y * 80.0);
    scanline = pow(scanline, 4.0) * 0.32;

    // ── Layer 3: Fresnel edge glow (ya existía, mantenido)
    float fres = 1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0);
    fres = pow(fres, 1.4);

    // ── Layer 4: Runas digitales (grid pixel-perfect, contrarrotando)
    vec2 runeUv = vec2(fract(vUv.x - uTime * 0.03), vUv.y);
    float runes = runeStampDigital(runeUv, 32.0);
    float runePulse = 0.55 + 0.45 * sin(uTime * 2.1);

    // ── Layer 5: Dos tiras de datos — binario/hex scrolling top + bottom.
    //    Direcciones opuestas para que se sienta como pipeline.
    vec2 dsUv = vec2(fract(vUv.x), vUv.y);
    float dataBottom = dataStrip(dsUv, 0.08, 0.16, 140.0, 2.2, 0.0);
    float dataTop = dataStrip(dsUv, 0.84, 0.92, 140.0, -1.8, 91.3);
    float dataS = (dataBottom + dataTop) * 0.75;

    // ── Layer 6: Radar sweep — un punto brillante circulando el anillo.
    //    Lectura: "algo está escaneando el portal".
    float sweepPos = fract(uTime * 0.09);
    float sweepD = abs(fract(vUv.x) - sweepPos);
    sweepD = min(sweepD, 1.0 - sweepD);
    float sweep = pow(1.0 - smoothstep(0.0, 0.06, sweepD), 2.0);

    // ── Layer 7: Glitch slice — banda horizontal que se ilumina ocasionalmente,
    //    como un bitflip/paquete corrupto. Trigger cada ~3s basado en hash de tiempo.
    float glitchTrigger = step(0.93, fract(sin(floor(uTime * 0.6)) * 78.233));
    float glitchPos = fract(sin(floor(uTime * 0.6) * 1.37) * 43758.5453);
    float glitchBand = step(0.94, 1.0 - abs(vUv.y - glitchPos) * 12.0) * glitchTrigger;

    // ── Composición ──
    // uDarkMode reduce las capas de "fill" (plasma + scanlines) dejando solo
    // los detalles (runas, data strips, sweep, glitch) visibles → anillo
    // antimateria con destellos rojos sobre negro.
    float fillMult = 1.0 - uDarkMode * 0.88;
    vec3 emit = baseCol * plasma * fillMult * (1.0 + fres * 1.3);
    emit += baseCol * scanline * fillMult;
    emit += baseCol * runes * 2.8 * runePulse;
    // Data strip con ligero matiz "terminal verde/ámbar" + base color — sugiere
    // que el anillo tiene circuitería atrás.
    emit += (baseCol * 0.6 + vec3(1.0, 0.95, 0.75) * 0.4) * dataS;
    emit += baseCol * sweep * 2.2;
    emit += baseCol * glitchBand * 3.5;
    // Aberración cromática en el borde
    emit += vec3(fres * 0.22, 0.0, fres * -0.10) * baseCol;

    // ── Posterize final: cuantiza color a 14 niveles por canal para reforzar
    //    la lectura "digital / low-bit display". Demasiado bajo se ve CGA,
    //    demasiado alto elimina el efecto — 14 es el sweet spot.
    emit = floor(emit * 14.0) / 14.0;

    emit *= uIntensity * uFlicker;

    gl_FragColor = vec4(emit, 1.0);
  }
`

// ── DISCO INTERIOR (Tier 2): vórtice que hace del portal una "ventana" ────
const DISC_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// ── Disco interior ALIEN TECH MINIMAL — anillos delgados, runa central
// glitcheada, marcadores orbitando, brackets angulares. Sin cuadros, sin
// cells, sin FBM. Lectura: "interfaz alienígena observando".
const DISC_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRuneSeed; // offset por-portal → glitch desincronizado
  uniform float uNameSeed; // seed de la letra ACTUAL del nombre de sección
                           // (driven desde JS, cambia cada ~1.2s ciclando el nombre)
  uniform float uDarkMode; // 0 normal, 1 antimateria (apaga plasma base)

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Marcador angular: arco corto centrado en baseAng, sobre la banda de r
  float angMark(float currentAng, float baseAng, float arcHalfWidth) {
    float d = abs(mod(currentAng - baseAng + 3.14159265, 6.28318531) - 3.14159265);
    return smoothstep(arcHalfWidth, arcHalfWidth * 0.7, d);
  }

  // Segmento SDF entre a y b con grosor w
  float segLine(vec2 uv, vec2 a, vec2 b, float w) {
    vec2 pa = uv - a;
    vec2 ba = b - a;
    float denom = max(dot(ba, ba), 0.0001);
    float t = clamp(dot(pa, ba) / denom, 0.0, 1.0);
    float d = length(pa - ba * t);
    return smoothstep(w + 0.015, w, d);
  }

  // Runa central procedural: 5 lineas SDF con endpoints snapped a un grid
  // 4x4 dentro del area local. El parametro seed controla que runa sale;
  // cada valor entero distinto produce un glifo distinto.
  float centerRune(vec2 localUv, float seed, float lineW) {
    float accum = 0.0;
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float x1 = floor(hash21(vec2(seed + fi * 3.13, 1.0)) * 4.0) / 3.0;
      float y1 = floor(hash21(vec2(seed + fi * 5.17, 2.0)) * 4.0) / 3.0;
      float x2 = floor(hash21(vec2(seed + fi * 7.11, 3.0)) * 4.0) / 3.0;
      float y2 = floor(hash21(vec2(seed + fi * 11.3, 4.0)) * 4.0) / 3.0;
      vec2 a = vec2(x1, y1);
      vec2 b = vec2(x2, y2);
      accum = max(accum, segLine(localUv, a, b, lineW));
    }
    return accum;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x);

    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));
    float activation = clamp(uMix, 0.0, 1.0);

    // Rotación global MUY lenta — todo el sistema gira como una pieza coherente
    float sysRot = uTime * 0.04;
    float angR = ang + sysRot;

    // ── Layer 1: ANILLOS CONCÉNTRICOS FINOS — 4 hoops delgados
    float ring1 = smoothstep(0.005, 0.0, abs(r - 0.30));
    float ring2 = smoothstep(0.004, 0.0, abs(r - 0.58));
    float ring3 = smoothstep(0.003, 0.0, abs(r - 0.84));
    float ring4 = smoothstep(0.005, 0.0, abs(r - 0.95)) * 1.3;
    float rings = ring1 * 0.9 + ring2 + ring3 + ring4;

    // ── Layer 2: RUNA CENTRAL GLITCHEADA — muta forma cada ~2s, con bursts
    //    de glitch ocasionales (offset UV + seed jitter + brightness flicker).
    //    Reemplaza el crosshair estático → lectura "glifo alien transmitiendo".
    float centerArea = step(length(p), 0.18); // área central donde vive la runa
    float runeBase = 0.0;
    if (centerArea > 0.5) {
      // Remap p ∈ [-0.15, 0.15] → [0, 1] para la función SDF
      vec2 rUv = (p + 0.15) / 0.30;

      // El seed base de la runa central viene de JS (uNameSeed) — JS cicla
      // por las letras del NOMBRE de la sección usando el alfabeto procedural.
      // Esto hace que el portal "escriba" su sección letra por letra.

      // Glitch: timing desfasado por uRuneSeed → cada portal glitchea en
      // momentos independientes.
      float gTick = floor(uTime * 0.9 + uRuneSeed * 11.1);
      float gRoll = hash21(vec2(gTick, 37.0 + uRuneSeed));
      float gPhase = fract(uTime * 0.9 + uRuneSeed * 11.1);
      float gActive = step(0.78, gRoll) * smoothstep(0.18, 0.0, gPhase);

      // Durante glitch: (a) offset horizontal de UV, (b) seed jitter, (c) flicker
      float gOff = (hash21(vec2(gTick, 51.0 + uRuneSeed)) - 0.5) * 0.12 * gActive;
      rUv.x += gOff;
      float seedJit = hash21(vec2(gTick, 73.0 + uRuneSeed)) * 6.0;
      float effectiveSeed = uNameSeed + gActive * seedJit;

      // Chromatic-like offset: muestreamos 2 veces con shift pequeño durante glitch
      float rA = centerRune(rUv, effectiveSeed, 0.042);
      float rB = centerRune(rUv + vec2(0.03 * gActive, 0.0), effectiveSeed, 0.042);
      runeBase = max(rA, rB * 0.6);

      // Flicker de brightness durante glitch
      float flicker = 1.0 - gActive * 0.55 * (1.0 - hash21(vec2(gTick * 1.7, 91.0 + uRuneSeed)));
      runeBase *= flicker;
    }
    float cross = runeBase * centerArea * 1.2;

    // ── Layer 3: 3 MARCADORES ORBITANDO en ring 0.58 (120° apart)
    float mRot = uTime * 0.08;
    float mBand = smoothstep(0.009, 0.0, abs(r - 0.58));
    float m1 = angMark(angR, mRot, 0.06);
    float m2 = angMark(angR, mRot + 2.0944, 0.06);
    float m3 = angMark(angR, mRot + 4.1888, 0.06);
    float markers = (m1 + m2 + m3) * mBand * 1.5;

    // ── Layer 4: 4 BRACKETS diagonales en ring 0.84 (alien targeting)
    float bRot = uTime * 0.035;
    float bBand = smoothstep(0.007, 0.0, abs(r - 0.84));
    float b1 = angMark(angR, 0.7854 + bRot, 0.07);
    float b2 = angMark(angR, 2.3562 + bRot, 0.07);
    float b3 = angMark(angR, 3.9270 + bRot, 0.07);
    float b4 = angMark(angR, 5.4978 + bRot, 0.07);
    float brackets = (b1 + b2 + b3 + b4) * bBand * 1.4;

    // ── Layer 5: POINTER RADIAL único — línea delgada del centro hacia ring 0.58
    float ptrAng = uTime * 0.11;
    float ptrDa = abs(mod(angR - ptrAng + 3.14159265, 6.28318531) - 3.14159265);
    float pointer = smoothstep(0.006, 0.0, ptrDa)
                    * smoothstep(0.04, 0.12, r)
                    * (1.0 - smoothstep(0.56, 0.60, r))
                    * 1.1;

    // ── Layer 6: 24 TICKS finos en ring 0.95 — subtle scale markers (detalle fino)
    float tickFrac = fract((angR + 0.5) * 24.0 / 6.28318 * 6.28318);
    // Simplified: use sin to mark every 15°
    float tickPhase = sin(angR * 24.0) * 0.5 + 0.5;
    float tickSharp = step(0.88, tickPhase);
    float tickBand = smoothstep(0.007, 0.0, abs(r - 0.95));
    float ticks = tickSharp * tickBand * 0.8;

    // ── Layer 7: EDGE RING brillante (borde del portal, dentro del torus)
    float edgeRing = smoothstep(0.97, 1.00, r) * (1.0 - smoothstep(1.00, 1.02, r)) * 1.4;

    // ── Composición minimalista
    float brightness = rings * 1.0
                     + cross * 0.65
                     + markers
                     + brackets
                     + pointer
                     + ticks
                     + edgeRing;

    // Fondo muy tenue — apenas un hint de presencia, lejos del blanco lechoso
    float bgHaze = 0.025 + activation * 0.05;

    float alpha = clamp(brightness + bgHaze * 0.3, 0.0, 1.0);
    vec3 emit = baseCol * (brightness * 1.5 + bgHaze);
    emit *= uIntensity;

    gl_FragColor = vec4(emit, alpha);
  }
`

// ── CÍRCULO MÁGICO DEL SUELO (Tier 3): rings + runas contrarrotantes ──────
const GROUND_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const GROUND_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  uniform float uIntensity;
  ${NOISE_GLSL}

  // Runas dispuestas angularmente en una banda radial.
  float angularRunes(float ang, float r, float slots, float bandC, float bandW, float speed, float seed) {
    float rotA = ang + uTime * speed;
    float raw = fract((rotA + 3.14159265) / 6.28318531) * slots;
    float slot = floor(raw);
    float frac = fract(raw);
    float h = hash21(vec2(slot + seed, 7.0));
    float lit = step(0.5, h);
    // Slot lleno solo en el 60% central para dejar aire entre runas
    float slotFill = smoothstep(0.18, 0.22, frac) * (1.0 - smoothstep(0.78, 0.82, frac));
    float band = smoothstep(bandC - bandW - 0.01, bandC - bandW, r) *
                 (1.0 - smoothstep(bandC + bandW, bandC + bandW + 0.01, r));
    return lit * slotFill * band;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x);

    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));

    // Tres anillos concéntricos delgados
    float ring1 = smoothstep(0.012, 0.004, abs(r - 0.96));
    float ring2 = smoothstep(0.010, 0.003, abs(r - 0.72));
    float ring3 = smoothstep(0.010, 0.003, abs(r - 0.42));

    // Runas en dos rings, contrarrotando
    float runes2 = angularRunes(ang, r, 18.0, 0.67, 0.025, 0.09, 3.0);
    float runes3 = angularRunes(ang, r, 12.0, 0.37, 0.022, -0.13, 9.0);

    // Marcas cardinales — destello en N/E/S/W
    float cardinal = smoothstep(0.12, 0.04, abs(sin(ang * 2.0)));
    float tickBand = smoothstep(0.84, 0.86, r) * (1.0 - smoothstep(0.90, 0.92, r));
    float tick = cardinal * tickBand * 0.9;

    float activation = clamp(uMix, 0.0, 1.0);
    float activation2 = activation * activation;

    // ── REACTIVE RAYS — 12 rayos radiales que se EXTIENDEN desde el centro
    //    hacia afuera cuando el player se acerca. Lectura: runas invocadas
    //    que se escriben en tiempo real al activarse el portal.
    float rayCount = 12.0;
    float rayFrac = fract((ang + uTime * 0.06) / 6.28318 * rayCount);
    float rayMask = step(0.46, rayFrac) * (1.0 - step(0.54, rayFrac));
    // Longitud del rayo: empieza a 0.12 en reposo, se extiende con activation
    float rayLength = 0.12 + activation * 0.82;
    // Trazo: visible solo dentro del rayLength, con fade al final del trazo
    float rayStroke = step(r, rayLength) *
                      smoothstep(0.04, 0.12, r) *
                      (1.0 - smoothstep(rayLength - 0.06, rayLength, r));
    float rays = rayMask * rayStroke * smoothstep(0.1, 0.5, activation);

    // ── OUTER RINGS EXPANDING — anillo extra que aparece cuando activation > 0.4
    //    Se expande periódicamente hacia afuera del ground circle, loop.
    float extraPeriod = 1.8;
    float extraPhase = fract(uTime / extraPeriod);
    float extraR = 0.3 + extraPhase * 0.7;
    float extra = smoothstep(0.015, 0.0, abs(r - extraR))
                  * (1.0 - extraPhase)
                  * smoothstep(0.4, 0.8, activation);

    // ── HEX DATA GRID interior — pixeles hex flipeando a rate fijo,
    //    visibilidad reactiva a activation (aparecen al acercarse).
    vec2 hexP = vec2(ang * 8.0, r * 30.0);
    vec2 hexCell = floor(hexP);
    float hexTick = floor(uTime * 3.0); // fijo
    float hexHash = hash21(hexCell + vec2(hexTick * 0.02, 0.0));
    float hexBand = step(0.15, r) * (1.0 - step(0.35, r));
    float hex = step(0.72, hexHash) * hexBand * smoothstep(0.25, 0.6, activation);

    // Brillo combinado — incluye las capas reactivas
    float brightness = ring1 + ring2 * 0.9 + ring3 * 0.8
                     + runes2 * 1.3 + runes3 * 1.3
                     + tick
                     + rays * 1.4
                     + extra * 1.8
                     + hex * 1.1;

    // Presencia base — siempre visible 35%, sube con activation
    float presence = 0.35 + 0.65 * smoothstep(0.0, 0.35, activation);

    float alpha = clamp(brightness * presence * uIntensity, 0.0, 1.0);
    vec3 emit = baseCol * (brightness * 0.85 + 0.12);
    // Posterize para consistencia con el lenguaje digital del resto
    emit = floor(emit * 14.0) / 14.0;

    gl_FragColor = vec4(emit, alpha);
  }
`

// ── BEAM VERTICAL (tech): columna de luz/datos saliendo del portal ────────
// Cilindro open-ended, bandas horizontales scrolleando hacia arriba — lee
// como "upload" o "transmisión" del portal. Fade por altura.
const BEAM_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`
const BEAM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  uniform float uIntensity;
  ${NOISE_GLSL}

  void main() {
    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));

    // Fade por altura — opaco abajo, transparente arriba
    float heightFade = pow(1.0 - smoothstep(0.0, 1.0, vUv.y), 1.4);

    // Fresnel para el cilindro — bordes más brillantes (sensación volumétrica)
    float fres = 1.0 - clamp(abs(dot(vWorldNormal, vViewDir)), 0.0, 1.0);
    fres = pow(fres, 1.2);

    // Bandas horizontales scrolleando hacia arriba (posterizadas)
    float bandRaw = fract(vUv.y * 14.0 - uTime * 0.55);
    float bands = step(0.62, bandRaw) * smoothstep(0.0, 0.05, 1.0 - bandRaw);
    // Bandas secundarias más finas y rápidas
    float band2 = step(0.88, fract(vUv.y * 48.0 - uTime * 1.3)) * 0.4;

    // Hexdata pixels en un grid — como datos subiendo por el beam
    vec2 dataUv = vec2(vUv.x * 32.0, vUv.y * 40.0 - uTime * 1.8);
    vec2 dataCell = floor(dataUv);
    float tick = floor(uTime * 8.0);
    float dataHash = hash21(dataCell + vec2(tick * 0.0, 0.0));
    float dataPix = step(0.86, dataHash) * 0.6;

    // Noise sutil para granularidad
    float grain = vnoise(vec2(vUv.x * 8.0, vUv.y * 20.0 - uTime * 0.4));

    // Composición
    float intensity = (0.35 + bands * 0.9 + band2 + dataPix) * (0.8 + fres * 0.6);
    intensity += grain * 0.15;
    float alpha = heightFade * clamp(intensity, 0.0, 1.2) * 0.85;

    vec3 emit = baseCol * (0.8 + bands * 1.4 + dataPix * 0.8 + fres * 0.5);
    // Posterize para mantener la lectura "digital"
    emit = floor(emit * 10.0) / 10.0;
    emit *= uIntensity;

    gl_FragColor = vec4(emit, alpha);
  }
`

// ── SONAR PINGS: anillos radiales expandiéndose desde el portal ───────────
// Un solo mesh (circle grande), el shader dibuja 3 anillos que nacen del
// centro y se expanden, desfasados en el tiempo → efecto sonar continuo.
const SONAR_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SONAR_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  uniform float uIntensity;

  // Anillo expandiéndose: phase ∈ [0..1]. Línea delgada continua.
  // El radio máximo escala con activation (proximidad del player):
  //   reposo → llegan al 0.55 del mesh
  //   parado en portal → llegan al 1.0 (borde completo)
  float ping(float r, float phase, float activation) {
    float thickness = 0.006;
    float maxR = mix(0.55, 1.0, activation);
    float effectiveR = phase * maxR;
    float d = abs(r - effectiveR);
    float lit = smoothstep(thickness, 0.0, d);
    // Fade: empieza y termina más tarde cuando está activado para que el
    // anillo pueda recorrer todo el radio expandido sin cortarse antes.
    float dieStart = mix(0.55, 0.88, activation);
    float dieEnd = mix(0.85, 1.02, activation);
    float earlyDie = smoothstep(dieEnd, dieStart, phase);
    return lit * (1.0 - phase * 0.85) * earlyDie;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));
    float activation = clamp(uMix, 0.0, 1.0);

    // 3 pings desfasados continuos
    float period = 4.0;
    float phase1 = fract(uTime / period);
    float phase2 = fract(uTime / period + 0.333);
    float phase3 = fract(uTime / period + 0.666);

    float total = ping(r, phase1, activation)
                + ping(r, phase2, activation)
                + ping(r, phase3, activation);

    float presence = 0.45 + 0.55 * smoothstep(0.0, 0.4, uMix);

    float alpha = clamp(total * presence * uIntensity, 0.0, 1.0);
    vec3 emit = baseCol * total * 1.8;

    gl_FragColor = vec4(emit, alpha);
  }
`

// ── GLYPH CARDS: points mesh con sprites que suben y orbitan el portal ────
// Cada punto es un billboard con una "tarjeta rúnica" pixel-perfect dibujada
// por shader. Orbitan lento, ascienden, loop al llegar arriba.
const GLYPHS_VERT = /* glsl */`
  precision highp float;
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vLife;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    float period = 5.5 + aSeed * 2.0;
    float life = fract(uTime / period + aSeed);
    vLife = life;

    float ang = aAngle + uTime * 0.08 + aSeed * 6.28;
    float radius = aRadius * (0.95 + 0.1 * sin(uTime * 0.6 + aSeed * 3.0));
    float y = life * 4.5 - 0.2;
    vec3 pos = vec3(cos(ang) * radius, y, sin(ang) * radius);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float visLife = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.7, 1.0, life));
    // Size: multiplier bajo (40 vs 220 original) + cap a 48px para que las
    // cards nunca ocupen la pantalla. Antes explotaban cerca del camera.
    float ps = aSize * visLife * (40.0 / max(1.0, -mvPos.z)) * uPixelRatio;
    gl_PointSize = min(ps, 48.0);
  }
`
const GLYPHS_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uTargetColor;
  uniform float uMix;
  uniform float uTime;
  varying float vLife;
  varying float vSeed;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // SDF de un segmento entre puntos a y b — devuelve alpha de la línea
  float segLine(vec2 uv, vec2 a, vec2 b, float w) {
    vec2 pa = uv - a;
    vec2 ba = b - a;
    float denom = max(dot(ba, ba), 0.0001);
    float t = clamp(dot(pa, ba) / denom, 0.0, 1.0);
    float d = length(pa - ba * t);
    return smoothstep(w + 0.04, w, d);
  }

  // Rune procedural: 4 segmentos con endpoints snapeados a un grid 3x3,
  // sembrados por (vSeed, seg_index). Cada card es única, lee como glifo.
  float runeFromSeed(vec2 uv, float seed, float timeTick) {
    float accum = 0.0;
    // Tick cuantizado para que las runas "cambien" cada cierto tiempo (como
    // mensajes en un panel de datos). En reposo la runa es fija.
    float tk = floor(timeTick);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      // Endpoints en grid 3x3 (valores 0, 0.5, 1)
      float x1 = floor(hash21(vec2(seed + tk * 0.1, fi * 3.13)) * 3.0) * 0.5;
      float y1 = floor(hash21(vec2(seed * 1.7 + tk * 0.1, fi * 5.17)) * 3.0) * 0.5;
      float x2 = floor(hash21(vec2(seed * 2.3 + tk * 0.1, fi * 7.11)) * 3.0) * 0.5;
      float y2 = floor(hash21(vec2(seed * 3.1 + tk * 0.1, fi * 11.3)) * 3.0) * 0.5;
      // Padding interno: el rune vive dentro de [0.15, 0.85]
      vec2 a = vec2(0.15 + x1 * 0.7, 0.15 + y1 * 0.7);
      vec2 b = vec2(0.15 + x2 * 0.7, 0.15 + y2 * 0.7);
      // Skip degenerate (a == b) — si son iguales el segmento es un punto,
      // la SDF se colapsa y el smoothstep lo descarta naturalmente.
      accum = max(accum, segLine(uv, a, b, 0.035));
    }
    return accum;
  }

  void main() {
    vec2 uv = gl_PointCoord;
    // Descarta fuera del cuadrante del sprite (sin dibujar borde visible).
    vec2 d = abs(uv - 0.5);
    if (max(d.x, d.y) > 0.48) discard;

    vec3 baseCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));

    // SOLO el rune — sin border, sin corner ticks. El glyph se lee "libre"
    // flotando, no encajonado.
    float timeTick = uTime * 0.6 + vSeed * 13.0;
    float rune = runeFromSeed(uv, vSeed, timeTick);

    float fade = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.7, 1.0, vLife));

    float alpha = clamp(rune, 0.0, 1.0) * fade;
    vec3 emit = baseCol * (0.9 + rune * 1.6);

    gl_FragColor = vec4(emit, alpha);
  }
`

export default function Portal({
  position = [0, 0, 0],
  color = '#8ecae6',
  targetColor = '#8ecae6',
  mix = 0,
  size = 2,
  flicker = false,
  flickerKey = null,
  // Nombre de la sección destino (EN/ES). Se cicla letra por letra en la
  // runa central del disco interior → cada portal "escribe" su nombre usando
  // el alfabeto procedural. Vacío = runa random (fallback).
  sectionName = '',
  // Portal antimateria (section6): apaga plasma base del torus → lectura
  // "agujero negro con destellos rojos tipo lava".
  antimatter = false,
}) {
  const groupRef = useRef()
  const torusRef = useRef()

  // Seeds de las letras del nombre (solo alpha A-Z). Si no hay letras, usa
  // [0] como fallback para no crashear el módulo.
  const nameSeeds = useMemo(() => {
    const clean = String(sectionName || '').toUpperCase().replace(/[^A-Z]/g, '')
    if (!clean) return [0]
    return Array.from(clean).map((c) => {
      const entry = ALPHABET_MAP[c]
      return entry ? entry.seed : c.charCodeAt(0)
    })
  }, [sectionName])

  // Uniforms compartidos entre los 3 shaders. Mantenemos UN solo set de refs
  // para uColor/uTargetColor/uMix/uTime y uniforms propios para flicker/intensity.
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uTargetColor: { value: new THREE.Color(targetColor) },
    uMix: { value: mix },
    uTime: { value: 0 },
    // uIntensity y uFlicker son DISTINTOS por capa → refs inline por mesh
  }), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Uniforms específicos por capa (distinta intensidad)
  const torusUniforms = useMemo(() => ({
    ...uniforms,
    uIntensity: { value: 3.2 },
    uFlicker: { value: 1.0 },
    uDarkMode: { value: antimatter ? 1.0 : 0.0 },
  }), [uniforms, antimatter])
  const discUniforms = useMemo(() => ({
    ...uniforms,
    uIntensity: { value: 1.4 },
    // Seed per-portal: cada instancia obtiene un offset aleatorio al montar
    // → los glitches se desincronizan entre portales.
    uRuneSeed: { value: Math.random() * 1000 },
    // uNameSeed driven cada frame desde JS — representa la LETRA actual
    // del nombre de sección ciclando.
    uNameSeed: { value: nameSeeds[0] || 0 },
    uDarkMode: { value: antimatter ? 1.0 : 0.0 },
  }), [uniforms, antimatter, nameSeeds])
  const groundUniforms = useMemo(() => ({
    ...uniforms,
    uIntensity: { value: 1.0 },
  }), [uniforms])
  const beamUniforms = useMemo(() => ({
    ...uniforms,
    uIntensity: { value: 1.6 },
  }), [uniforms])
  const sonarUniforms = useMemo(() => ({
    ...uniforms,
    uIntensity: { value: 1.3 },
  }), [uniforms])
  const glyphUniforms = useMemo(() => ({
    ...uniforms,
    uPixelRatio: { value: Math.min(typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1, 2) },
  }), [uniforms])

  // Atributos estáticos de glyph cards — 16 cards orbitando con radio/seed únicos
  const GLYPH_COUNT = 16
  const glyphGeom = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(GLYPH_COUNT * 3)
    const aAngle = new Float32Array(GLYPH_COUNT)
    const aRadius = new Float32Array(GLYPH_COUNT)
    const aSeed = new Float32Array(GLYPH_COUNT)
    const aSize = new Float32Array(GLYPH_COUNT)
    for (let i = 0; i < GLYPH_COUNT; i++) {
      aAngle[i] = (i / GLYPH_COUNT) * Math.PI * 2 + Math.random() * 0.3
      aRadius[i] = size * (1.15 + Math.random() * 0.55)
      aSeed[i] = Math.random()
      // Size pequeño — antes 14-24, se disparaba con el multiplier del vertex.
      // Ahora 3-5 con multiplier 40 → cards ~30-60px on screen a distancia
      // normal, 48px cap como safety net.
      aSize[i] = 3 + Math.random() * 2
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aAngle', new THREE.BufferAttribute(aAngle, 1))
    geo.setAttribute('aRadius', new THREE.BufferAttribute(aRadius, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), size * 3 + 5)
    return geo
  }, [size])

  // State machine para flicker — idéntica a la versión anterior (no romper UX)
  const flickerRef = useRef({ mode: 'stableOn', nextAt: 0, blinks: 0 })
  React.useEffect(() => {
    if (!flicker) return
    const st = flickerRef.current
    st.mode = 'burstOff'
    st.blinks = Math.floor(3 + Math.random() * 3)
    st.nextAt = -1
  }, [flickerKey, flicker])

  useFrame((state) => {
    const t = state?.clock ? state.clock.getElapsedTime() : 0
    // Avanza tiempo en uniforms
    uniforms.uTime.value = t
    // Actualiza colores del lerp (por si los props cambiaron sin remount)
    uniforms.uColor.value.set(color)
    uniforms.uTargetColor.value.set(targetColor)
    uniforms.uMix.value = THREE.MathUtils.clamp(mix, 0, 1)
    // Cicla la runa central por las letras del nombre. Período de 1.2s por
    // letra. El offset por-portal (uRuneSeed * 0.7) evita que 2 portales
    // muestren la misma letra a la vez aunque tengan la misma longitud.
    if (nameSeeds.length > 0) {
      const offset = discUniforms.uRuneSeed.value * 0.7
      const letterIdx = Math.floor(t / 1.2 + offset) % nameSeeds.length
      discUniforms.uNameSeed.value = nameSeeds[(letterIdx + nameSeeds.length) % nameSeeds.length]
    }

    // Rotación del torus con respiración (no-lineal → lectura "viva")
    if (torusRef.current) {
      torusRef.current.rotation.z += 0.008 + Math.sin(t * 0.3) * 0.0035
    }

    // Pulso de escala sutil — apenas perceptible pero rompe el look mecánico
    if (groupRef.current) {
      const s = 1 + Math.sin(t * 0.7) * 0.015
      groupRef.current.scale.setScalar(s)
    }

    // Flicker state machine → actualiza uFlicker del torus (las otras capas
    // mantienen intensidad estable para que el círculo mágico/disco sigan
    // presentes cuando el anillo parpadea)
    if (flicker) {
      const st = flickerRef.current
      const randStable = () => 0.6 + Math.random() * 1.0
      const randOffShort = () => 0.03 + Math.random() * 0.04
      const randOnShort = () => 0.06 + Math.random() * 0.06
      const randOffLong = () => 0.10 + Math.random() * 0.10
      if (!st.nextAt || st.nextAt === -1) {
        if (st.nextAt === -1 && st.mode === 'burstOff') {
          st.nextAt = t + (0.04 + Math.random() * 0.04)
        } else {
          st.mode = 'stableOn'
          st.nextAt = t + randStable()
          st.blinks = 0
        }
      }
      if (t >= st.nextAt) {
        if (st.mode === 'stableOn') {
          st.mode = 'burstOff'
          st.blinks = Math.floor(3 + Math.random() * 3)
          st.nextAt = t + (Math.random() < 0.2 ? randOffLong() : randOffShort())
        } else if (st.mode === 'burstOff') {
          st.mode = 'burstOn'
          st.nextAt = t + randOnShort()
        } else if (st.mode === 'burstOn') {
          st.blinks -= 1
          if (st.blinks > 0) {
            st.mode = 'burstOff'
            st.nextAt = t + randOffShort()
          } else {
            st.mode = 'stableOn'
            st.nextAt = t + randStable()
          }
        }
      }
      torusUniforms.uFlicker.value = (st.mode === 'stableOn' || st.mode === 'burstOn') ? 1.0 : 0.18
    } else {
      torusUniforms.uFlicker.value = 1.0
    }
  })

  // Orientaciones:
  //   - Torus: rotación original [PI/2, 0, 0] — anillo horizontal sobre el suelo
  //   - Disco interior: [-PI/2, 0, 0] → normal hacia +Y (visible desde arriba)
  //   - Círculo suelo: [-PI/2, 0, 0] con offset Y negativo para evitar Z-fighting
  return (
    <group ref={groupRef} position={position}>
      {/* Tier 3: Ground magic circle — debajo de todo, más grande */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} renderOrder={-5}>
        <circleGeometry args={[size * 1.85, 64]} />
        <shaderMaterial
          vertexShader={GROUND_VERT}
          fragmentShader={GROUND_FRAG}
          uniforms={groundUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Tier 2: Disco interior — vórtice dentro del anillo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} renderOrder={-4}>
        <circleGeometry args={[size * 0.92, 48]} />
        <shaderMaterial
          vertexShader={DISC_VERT}
          fragmentShader={DISC_FRAG}
          uniforms={discUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Black outline for the torus ring. A flat annulus hugging the outer
          edge — not an inverted hull, which on a torus only outlines the FAR
          rim (BackSide culls the near/bottom edge). Flat ring traces the full
          ellipse. Transparent + high renderOrder so it paints over the additive
          glow; depthWrite:false + depthTest so the character still occludes it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null} renderOrder={6}>
        <ringGeometry args={[size * 1.1, size * 1.12, 80]} />
        <meshBasicMaterial
          color={0x000000}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Same stroke on the INNER edge (torus hole, at major−tube = size*0.9). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null} renderOrder={6}>
        <ringGeometry args={[size * 0.88, size * 0.9, 80]} />
        <meshBasicMaterial
          color={0x000000}
          side={THREE.DoubleSide}
          transparent
          depthWrite={false}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>

      {/* Tier 1: Torus con plasma + runas */}
      <mesh ref={torusRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size, size * 0.1, 16, 48]} />
        <shaderMaterial
          vertexShader={TORUS_VERT}
          fragmentShader={TORUS_FRAG}
          uniforms={torusUniforms}
          transparent={false}
          toneMapped={true}
        />
      </mesh>

      {/* Sonar pings — ondas expansivas en el suelo alrededor del portal.
          Radio mayor que el ground circle para que se vean EXPANDIÉNDOSE
          hacia afuera del área arcana. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={-3}>
        <circleGeometry args={[size * 3.2, 96]} />
        <shaderMaterial
          vertexShader={SONAR_VERT}
          fragmentShader={SONAR_FRAG}
          uniforms={sonarUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glyph cards — tarjetas rúnicas pixel-perfect que orbitan el portal
          y ascienden. Cada una con patrón hasheado único, ticks de flip. */}
      <points frustumCulled={false} renderOrder={2} geometry={glyphGeom}>
        <shaderMaterial
          vertexShader={GLYPHS_VERT}
          fragmentShader={GLYPHS_FRAG}
          uniforms={glyphUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}
