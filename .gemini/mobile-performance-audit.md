# 📱 Auditoría de Rendimiento Móvil — SkulleyRad Website

> **Fecha:** 2026-02-14  
> **Alcance:** Android + iOS — Dispositivos gama baja/media  
> **Síntomas reportados:** Personaje no carga, pantalla negra tras preloader, flickering, comportamiento extraño del personaje

---

## 📊 Resumen Ejecutivo

| Área | Severidad | Impacto |
|------|-----------|---------|
| **Assets (GLB/HDR)** | 🔴 Crítico | ~16.43 MB en modelos 3D + HDR cargados |
| **Grass Instancing** | 🔴 Crítico | 180,000 instancias sin frustum culling |
| **PostFX Pipeline** | 🟠 Alto | 8+ efectos activos simultáneamente |
| **useFrame Hooks** | 🟠 Alto | 21+ archivos con useFrame (loops per-frame) |
| **Audio Assets** | 🟡 Medio | ~40+ MB en archivos de audio |
| **Detección lowPerf** | 🟡 Medio | Gaps en la detección de dispositivos |
| **App.jsx Monolítico** | 🟡 Medio | 206KB / 4602 líneas en un solo archivo |
| **Canvas DPR** | 🟢 Bajo | Bien configurado (1.0 en lowPerf) |

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. FakeGrass — 180,000 Instancias

**Archivo:** `src/components/FakeGrass.jsx`  
**Línea:** 2643 en `App.jsx` → `count={180000}`

```jsx
// App.jsx:2643 — Se pasan 180,000 hojas de pasto
<FakeGrass
  count={180000}
  frustumCulled={false}  // ← NO hay culling
  bladeHeight={0.42}
  bladeWidth={0.032}
/>
```

**Problema:**
- En `lowPerf`, se reduce a `35%` → **63,000 instancias** (sigue siendo MUY alto para móvil)
- El shader custom con `onBeforeCompile` inyecta cálculos de distancia POR VÉRTICE
- `frustumCulled={false}` = se renderizan TODAS las instancias cada frame
- Cada instancia = 2-3 segmentos Y × 2 segmentos X = ~12-18 vértices por hoja
- **Total estimado: ~756,000+ vértices solo en pasto**

**Solución propuesta:**
```jsx
// Reducir drásticamente en móvil
const finalCount = isMobilePerf 
  ? Math.max(200, Math.floor(count * 0.05))  // 9,000 max
  : lowPerf 
    ? Math.max(600, Math.floor(count * 0.15)) // 27,000
    : count                                     // 180,000
```

### 2. Assets 3D Pesados (Sin Compresión Draco/KTX2)

**Inventario de modelos:**

| Archivo | Tamaño | Uso | Prioridad |
|---------|--------|-----|-----------|
| `character.glb` | 2.25 MB | Principal (crítico) | Alta |
| `character_1.glb` | 5.12 MB | ¿Backup/antiguo? | ❓ Posiblemente eliminar |
| `characterStone.glb` | 4.71 MB | Easter egg | Baja (lazy) |
| `housebird.glb` | 0.91 MB | Decorativo | Baja (lazy) |
| `housebirdPink.glb` | 0.91 MB | Decorativo | Baja (lazy) |
| `housebirdWhite.glb` | 0.91 MB | Decorativo | Baja (lazy) |
| `light.hdr` | 1.62 MB | IBL Lighting | Media |
| **Total** | **~16.43 MB** | | |

**Problemas:**
- `character.glb` (2.25 MB) se carga como **requisito de preload** (bloquea la entrada)
- `character_1.glb` (5.12 MB) existe pero no se referencia → **dead asset?**
- `light.hdr` (1.62 MB) se carga incluso en móvil
- No hay evidencia de compresión Draco en los GLBs
- Los 3 housebird son idénticos en tamaño (colores probablemente bakeados en texturas = redundancia)

**Soluciones propuestas:**
1. Aplicar **Draco compression** → reducción típica del 60-80%
2. Convertir texturas a **KTX2/Basis** (ya hay soporte parcial: `extendGLTFLoaderKTX2`)
3. Eliminar `character_1.glb` si no se usa
4. En móvil: usar una versión LOD (low-poly) del character
5. En móvil: sustituir `light.hdr` por luces estáticas (ya se hace en warm-up stage 0, pero se reemplaza)

### 3. PostFX — Pipeline Excesivo para Móvil

**Archivo:** `src/components/PostFX.jsx`  
**En móvil (`lowPerf=true`), aún se renderizan:**

| Efecto | Estado en lowPerf | GPU Cost |
|--------|-------------------|----------|
| Bloom | ✅ Activo (reducido) | Alto |
| DotScreen | ✅ Activo | Medio |
| Vignette | ✅ Activo | Bajo |
| Noise | ⚠️ Blending shader | Bajo |
| ChromaticAberration | ✅ Condicional | Bajo |
| LiquidDistortion | ✅ Custom shader | Medio |
| Outline (character) | ✅ Activo | Alto |
| EffectComposer | ✅ Siempre montado | Alto (overhead base) |

**Problema:**
- El `EffectComposer` **en sí mismo** tiene un overhead significativo: crea render targets intermedios
- En `lowPerf`, `resolutionScale` no se reduce (debería ser 0.5 o menor)
- Bloom + Outline juntos requieren **múltiples render passes**  
- En móvil con GPU Adreno 300-500 o Mali-G52: esto puede causar **WebGL Context Lost**

**Solución propuesta:**
```jsx
// En móvil, desactivar EffectComposer completamente
if (isMobilePerf) return null

// O mínimo absoluto:
<EffectComposer resolutionScale={0.5} multisampling={0}>
  <Vignette /> {/* Único efecto: casi gratis */}
</EffectComposer>
```

---

## 🟠 PROBLEMAS DE ALTO IMPACTO

### 4. MeshReflectorMaterial en Environment

**Archivo:** `src/components/Environment.jsx:96-114`

```jsx
<MeshReflectorMaterial
  blur={[50, 20]}
  resolution={128}
  mixBlur={0.35}
  mixStrength={0.28}
  // ...
/>
```

**Problema:**
- Aunque se desactiva en `lowPerf` (usa `MeshStandardMaterial`), la resolución del reflector (128) ya es baja
- El switch entre reflector y material estándar ocurre **en render time**, no en mount
- ✅ **Esto ya está parcialmente resuelto** — pero el `lowPerf` no siempre se propaga correctamente

### 5. 21+ Componentes con useFrame (Per-Frame Loops)

**Archivos con `useFrame`:**

```
App.jsx, Player.jsx, CharacterPortrait.jsx, CharacterPortraitHero.jsx,
CameraController.jsx, FakeGrass.jsx, FloatingExclamation.jsx,
FloatingHousebirds.jsx, FrustumCulledGroup.jsx, HomeOrbs.jsx,
ImageMaskTransitionOverlay.jsx, ImageRevealMaskOverlay.jsx,
NoiseTransitionOverlay.jsx, PauseFrameloop.jsx, Portal.jsx,
PortalParticles.jsx, PostFX.jsx, SkyStars.jsx, SpeechBubble3D.jsx,
UnifiedTransitionOverlay.jsx, DragShaderOverlay.jsx
```

**Problema:**
- Cada `useFrame` es un callback que se ejecuta CADA FRAME (60x/s)
- `Player.jsx` tiene **múltiples `useFrame`** hooks con lógica pesada:
  - Fixed-timestep simulation
  - Voxel shatter animation (620 instancias)
  - Orb physics + spark particles
  - Footstep detection
  - Opacity animation traversals (`scene.traverse()` cada frame)
- `HomeOrbs.jsx`: N² sphere-to-sphere collision detection + particle system

**Solución propuesta:**
- En móvil, reducir `useFrame` a 30fps usando frame skipping
- Desactivar componentes no críticos (`FloatingExclamation`, `SpeechBubble3D`, etc.)
- El easter egg voxel (620 instancias) debería desactivarse completamente:
  - `DISASSEMBLE_ENABLED = false` ← ya está desactivado, ✅
  - Pero el `instancedMesh` y toda la lógica siguen montados

### 6. HomeOrbs — Física N² + 1200 Partículas

**Archivo:** `src/components/HomeOrbs.jsx`

```jsx
const PART_CAP = 1200     // Pool de partículas
const POPUP_CAP = 8       // Popups 3D
const PARTICLES_PER_EXPLOSION = 24
```

**Problema:**
- Colisión sphere-to-sphere es O(N²): con 10 orbs = 45 comparaciones/frame (aceptable)
- Pero el particle system tiene 1200 slots que se actualizan cada frame
- Cada explosión crea 24 partículas con física propia
- En móvil: reduce a `120 PortalParticles` por portal (×4 portales = 480) + 1200 particles pool

**Solución propuesta:**
```jsx
// En móvil
const PART_CAP = isMobilePerf ? 300 : 1200
const PARTICLES_PER_EXPLOSION = isMobilePerf ? 8 : 24
```

### 7. PortalParticles — Redundancia en Múltiples Instancias

**Archivo:** `App.jsx:2797-2806`

```jsx
<PortalParticles
  count={isMobilePerf ? 120 : 220}  // ×4 portales
  // ...
/>
```

**Problema:**
- 4 portales × 120 partículas = **480 partículas con useFrame individual**
- Cada `PortalParticles` tiene su propio `useFrame` loop
- Deberían fusionarse en un solo `InstancedMesh` compartido

---

## 🟡 PROBLEMAS DE IMPACTO MEDIO

### 8. Detección `isMobilePerf` — Gaps

**Archivo:** `App.jsx` ≈ línea 126

**Gaps identificados:**
1. **`navigator.deviceMemory <= 4`** marca como lowPerf → esto incluye muchos laptops decentes con 4GB
2. **`navigator.hardwareConcurrency <= 4`** → incluye iPads con 4 cores que rinden bien
3. **`window.devicePixelRatio > 2`** → iPhone 14 Pro (3x) se marca como lowPerf aunque su GPU es potente
4. **`'apple gpu'`** en la lista de GPUs integradas → **TODAS las GPUs Apple** se marcan como lowPerf, incluyendo M1/M2/A15+ que son extremadamente potentes
5. **`'adreno'`** genérico → incluye Adreno 730/740 que son GPUs de gama alta

**Solución propuesta:**
```jsx
// Más granular:
const isWeakGPU = (
  renderer.includes('mali-g5') || // Mali G51/G52 (gama baja)
  renderer.includes('mali-g3') || // Mali G31 (gama muy baja)
  renderer.includes('adreno 3') || // Adreno 305-330 (gama baja)
  renderer.includes('adreno 4') || // Adreno 405-430 (gama media-baja)
  renderer.includes('adreno 5') || // Adreno 505-530 (gama media)
  renderer.includes('powervr') ||
  renderer.includes('swiftshader') ||
  renderer.includes('llvmpipe') ||
  renderer.includes('mesa')
)
// Intel solo si es HD Graphics (no Iris Pro/Arc)
const isWeakIntel = renderer.includes('intel') && !renderer.includes('iris')
```

### 9. Audio — ~40 MB en Canciones

**Inventario:**

| Archivo | Tamaño |
|---------|--------|
| 9 canciones MP3 | ~35 MB total |
| 8 SFX WAV | ~1.5 MB total |
| punch.mp3 | 0.03 MB |

**Problema:**
- Los SFX se precargan en el preloader (`preloadSfx`)
- Las canciones son lazy pero pueden descargarse en paralelo
- WAV es sin comprensión → convertir a OGG/MP3 para ahorro

**Solución:**
- Convertir SFX WAV → OGG (reducción ~70%)
- Las canciones ya son MP3, pero algunas son muy grandes (Station Tokyo = 7.87 MB)
- En móvil: considerar calidad reducida (128kbps vs 320kbps)

### 10. CharacterPortrait — Canvas Secundario

**Archivo:** `src/components/CharacterPortrait.jsx`

**Problema:**
- Crea un **segundo Canvas WebGL** para el retrato del personaje
- Tiene su propio `EffectComposer` con Bloom, DotScreen, ChromaticAberration
- En móvil: dos contextos WebGL simultáneos = **riesgo de Context Lost**
- iOS Safari limita a ~4 contextos WebGL activos

**Solución:**
- En móvil: renderizar el portrait como imagen estática (capturar 1 frame y usar CSS)
- O: desmontar el portrait cuando no está visible (ya se hace parcialmente con `paused`)

### 11. App.jsx — Archivo Monolítico (206KB)

**Archivo:** `src/App.jsx` — 4602 líneas

**Problema:**
- El parse/compile de este archivo consume tiempo signficativo
- Contiene ~30 funciones de callback, ~50 estados, ~20 refs
- No se beneficia de tree-shaking
- Si JavaScript se parsea a ~1MB/s en móvil → ~200ms solo para parsear este archivo

**Solución:**
- Extraer lógica en hooks custom (`useTransitions`, `usePreloader`, `useMobileDetection`)
- No es urgente para runtime performance, pero mejora Time-to-Interactive

---

## 🟢 ASPECTOS BIEN IMPLEMENTADOS

✅ **Canvas DPR limitado:** `dpr={[1, isMobilePerf ? 1.0 : 1.1]}` — correcto  
✅ **PauseFrameloop:** La escena se pausa cuando el preloader está visible o la página oculta  
✅ **Warm-up stages:** El montaje se hace progresivo (stage 0 → 1 → 2)  
✅ **degradedMode = true por defecto:** Todos empiezan en modo degradado  
✅ **WebGL Context Loss handling:** Hay manejo robusto de pérdida de contexto  
✅ **`shadows={false}`:** Sombras reales desactivadas  
✅ **FrustumCulledGroup:** Los portales usan culling por distancia  
✅ **Lazy loading de secciones:** `import()` dinámico para Section2-5  
✅ **Material clonación:** Evita cross-contamination entre Player y Portrait  
✅ **Object pooling en HomeOrbs:** Ring buffer para partículas  
✅ **`antialias: false`:** MSAA desactivado → ahorro significativo  
✅ **`stencil: false`:** Buffer de stencil desactivado  
✅ **`preserveDrawingBuffer: false`:** Reduce uso de VRAM  

---

## 🛠️ PLAN DE ACCIÓN POR PRIORIDAD

### Fase 1: Impacto Inmediato (Quick Wins)
1. **Reducir FakeGrass a 5,000-9,000 instancias en móvil** 
2. **Desactivar EffectComposer completamente en móvil** (o solo Vignette)
3. **Reducir PART_CAP de HomeOrbs a 300 en móvil**
4. **No cargar `light.hdr` en móvil** — usar luces estáticas (ya hay fallback en stage 0)

### Fase 2: Optimización de Assets
5. **Comprimir GLBs con Draco** (especialmente `character.glb`)
6. **Convertir texturas a KTX2/Basis**
7. **Eliminar `character_1.glb`** si no se usa
8. **Fusionar los 3 housebird** en un solo GLB con variantes de color por uniform
9. **Convertir SFX WAV → OGG**

### Fase 3: Optimización de Código
10. **Mejorar detección `isMobilePerf`** — más granular por GPU
11. **Desmontar CharacterPortrait Canvas en móvil** (usar imagen estática)
12. **Frame-skip useFrame en móvil** (30fps para componentes no críticos)
13. **Refactorizar App.jsx** en módulos más pequeños

### Fase 4: Optimización Avanzada
14. **LOD system para character.glb** (versión low-poly para móvil)
15. **Instanced PortalParticles** (fusionar 4 componentes en 1)
16. **WebWorker para física de orbs** (offload colisiones del thread principal)

---

## ⚡ Diagnóstico de Síntomas Específicos

### "El personaje no carga"
**Causa probable:** `character.glb` (2.25 MB) + `light.hdr` (1.62 MB) = ~4 MB de assets críticos.
En conexiones lentas (3G ~400KB/s), esto toma >10 segundos. Si hay timeout o error de red, el preloader nunca completa.
- **Fix:** Preload timeout con fallback + reducir tamaño con Draco

### "Pantalla negra tras el preloader"
**Causa probable:** Cuando `showPreloaderOverlay` pasa a `false`, el Canvas intenta renderizar pero:
1. El EffectComposer está compilando shaders (PostFX.jsx)
2. El Environment carga el HDR
3. FakeGrass inicializa 63,000+ instancias
4. Todo esto en 1-2 frames = GPU stall = pantalla negra transitoria

- **Fix:** Extender warm-up stages + no montar PostFX hasta stage 3 en móvil

### "Flickering"
**Causa probable:**
1. El `degradedMode` toggle puede causar re-mount del EffectComposer
2. El DPR fluctúa con `AdaptiveDpr` → re-crea render targets
3. `el.style.background = '#000'` en canvas, pero el scene background es `#204580` → flash negro durante transiciones
4. Blackout overlay tiene un failsafe timeout de 1.5s que puede ser insuficiente

- **Fix:** Eliminar `AdaptiveDpr` en móvil + freeze DPR a 1.0

### "Comportamiento extraño del personaje"
**Causa probable:**
1. Frame drops causan `dt` spikes en Player.jsx → el fixed-timestep accumulator se satura
2. `simAccRef` acumula tiempo y ejecuta múltiples pasos en un frame → el personaje "salta"
3. Las animaciones del mixer se congelan (`mixer.timeScale = 0`) y se avanzan manualmente, pero si hay un spike el avance puede ser inconsistente

- **Fix:** Clamp máximo de pasos de simulación por frame (ya hay clamping parcial)

---

## 📱 Recomendación de Perfil Móvil Agresivo

```jsx
// Perfil "Ultra Low" para móviles de gama baja
const MOBILE_ULTRA_LOW = {
  grass: { count: 3000, segY: 1, sway: 0 },
  postfx: false,  // Sin EffectComposer
  particles: { portalCount: 40, orbPool: 100, perExplosion: 4 },
  portrait: 'static',  // Imagen estática
  hdr: false,  // Solo luces estáticas
  orbs: { num: 5 },
  dpr: 1.0,
  frameSkip: true,  // 30fps para no-críticos
  audio: { sfx: true, music: false },  // Sin música de fondo automática
}
```

---

*Este reporte cubre la auditoría completa del frontend. Las optimizaciones de Fase 1 deberían resolver los problemas más visibles (pantalla negra, flickering, no-carga) en la mayoría de dispositivos móviles.*
