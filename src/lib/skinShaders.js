// Skins animadas por SHADER para el personaje (Skulley).
//
// En vez de un GLB nuevo por skin (como la dorada), inyectamos un bloque
// procedural en el fragment shader que MODULA el albedo (`diffuseColor.rgb`)
// ANTES de la iluminación. Como el banding toon (toonBanding.js) cuantiza por
// luminancia y reescala el RGB conservando el tono, un albedo que cambia en el
// tiempo FLUYE a través del cel-shading sin romperlo (DESIGN.md §7.8 regla 5).
//
// Se compone con applyToonBanding encadenando onBeforeCompile (mismo patrón).
// Un solo programa contiene los 3 modos (oil/hologram/void) gateados por el
// uniform `uSkinMode` → cambiar de skin = escribir un uniform, SIN recompilar.
//
// El tiempo (`uSkinTime`) lo avanza un único rAF de módulo → funciona para los
// dos canvas (escena + retrato) con un solo reloj. Solo corre cuando hay un skin
// shader activo (currentMode > 0).

// Declaraciones + helpers (van antes de main en el fragment).
const GLSL_FRAG_HEAD = `
varying vec3 vSkinObjPos;
uniform float uSkinTime;
uniform float uSkinMode;
uniform float uSkinAmount;
uniform float uInPortrait; // 1 = retrato, 0 = escena (compensación de bloom/ACES)
uniform float uIsHair;     // 1 = material "Hair" (slime usa paleta morada en el pelo)
vec3 skinIriPal(float t){ return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0, 0.33, 0.67))); }
float skinHash31(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
// Lava de roca agrietada (referencia molten-lava): celdas Voronoi de roca con
// grietas incandescentes en los BORDES de celda. skinWorley devuelve F1/F2; la
// grieta vive donde F2-F1 ≈ 0 (frontera entre placas) → red de ríos poligonales.
vec3 skinHash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec2 skinWorley(vec3 p){
  vec3 ip = floor(p); vec3 fp = fract(p);
  float f1 = 9.9; float f2 = 9.9;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 r = g + skinHash33(ip + g) - fp;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return vec2(sqrt(f1), sqrt(f2));
}
// Value noise 3D trilinear (mottling orgánico del gel slime).
float skinVN(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  float a = skinHash31(i+vec3(0.,0.,0.)), b = skinHash31(i+vec3(1.,0.,0.));
  float c = skinHash31(i+vec3(0.,1.,0.)), d = skinHash31(i+vec3(1.,1.,0.));
  float e = skinHash31(i+vec3(0.,0.,1.)), g = skinHash31(i+vec3(1.,0.,1.));
  float h = skinHash31(i+vec3(0.,1.,1.)), k = skinHash31(i+vec3(1.,1.,1.));
  return mix(mix(mix(a,b,f.x), mix(c,d,f.x), f.y), mix(mix(e,g,f.x), mix(h,k,f.x), f.y), f.z);
}
// Glow procedural (lava/slime): color block → emissive block (1 sola eval).
vec3 _skinEmissive = vec3(0.0);
void skinLava(vec3 p, float t, out vec3 albedo, out vec3 glow){
  vec3 q = p*1.6 + vec3(0.0, -t*0.28, t*0.05); // celdas más grandes → menos cracks
  vec2 w = skinWorley(q);
  float edgeD = w.y - w.x;                          // ~0 en los bordes de celda (grietas)
  float lava = 1.0 - smoothstep(0.0, 0.26, edgeD);  // río de lava (con halo)
  float core = 1.0 - smoothstep(0.0, 0.09, edgeD);  // núcleo más caliente
  float pulse = 0.85 + 0.15*sin(t*4.0 + w.x*14.0);
  // NARANJA dominante: rojo oscuro (borde) → rojo-naranja → naranja brillante.
  // El amarillo queda solo en el corazón absoluto (pow alto) → no domina.
  vec3 edge = vec3(0.55, 0.02, 0.0);
  vec3 mid  = vec3(1.0, 0.22, 0.0);
  vec3 coreC = vec3(1.0, 0.50, 0.05);
  vec3 hot = mix(edge, mid, smoothstep(0.0, 0.5, lava));
  hot = mix(hot, coreC, core);
  hot += vec3(0.0, 0.28, 0.04) * pow(core, 4.0);    // toque de amarillo solo en lo más caliente
  hot *= pulse;
  // Corteza: carbón casi negro con embers rojos dispersos.
  float ember = step(0.93, fract(w.x * 27.0 + 0.5)) * (0.5 + 0.5*sin(t*3.0 + w.x*40.0));
  vec3 crust = vec3(0.035, 0.012, 0.008) + vec3(0.22, 0.03, 0.0) * ember;
  albedo = mix(crust, hot, lava);
  glow = hot * lava * (0.4 + 0.6*core);             // glow más fuerte en el núcleo
}
// Sparkle de 4 picos AFILADOS sobre un plano 2D (se usa en triplanar para el oro
// → estrellas limpias en cualquier orientación de la malla, sin deformarse).
// Una por celda, sparsas, con centro jittered cerca del centro de celda (la
// estrella no cruza bordes) y titileo de fase random.
float skinSparkle(vec2 uv, float time){
  vec2 cell = floor(uv);
  vec3 r = skinHash33(vec3(cell, 11.0));
  if (r.z < 0.74) return 0.0;                       // sparsos (~26% de celdas)
  vec2 ctr = vec2(0.5) + (r.xy - 0.5) * 0.5;        // jitter suave (no toca bordes)
  vec2 d = abs(fract(uv) - ctr) / 0.34;             // 0.34 = largo del rayo (chico)
  float tw = pow(0.5 + 0.5*sin(time*3.0 + r.z*6.2832), 3.0);
  float rayH = max(0.0, 1.0 - (d.x + d.y*7.0));     // rayo horizontal afilado
  float rayV = max(0.0, 1.0 - (d.y + d.x*7.0));     // rayo vertical afilado
  return (rayH + rayV) * tw;
}
`

// Bloque que reescribe diffuseColor.rgb según el modo. _fres = thin-film por
// ángulo de vista; vSkinObjPos = posición local (rest pose) → el patrón "vive"
// sobre la superficie y fluye con el tiempo siguiendo al esqueleto/pelo.
const GLSL_FRAG_BLOCK = `
if (uSkinMode > 0.5) {
  vec3 _sN = normalize(vNormal);
  vec3 _sV = normalize(vViewPosition);
  float _fres = 1.0 - max(dot(_sN, _sV), 0.0);
  vec3 _p = vSkinObjPos;
  vec3 _skinCol = diffuseColor.rgb;
  if (uSkinMode < 1.5) {
    // OIL SLICK — aceite iridiscente que se desplaza sobre la superficie.
    float _flow = sin(_p.y*7.0 + uSkinTime*1.1)*0.5
                + sin(_p.x*5.0 - uSkinTime*0.8)*0.3
                + sin((_p.x+_p.y+_p.z)*4.0 + uSkinTime*0.6)*0.2;
    float _t = _fres*0.75 + _flow*0.22 + uSkinTime*0.03;
    _skinCol = skinIriPal(_t);
  } else if (uSkinMode < 2.5) {
    // HOLOGRAM — iridiscente cian con scanlines y flicker (lenguaje CRT).
    float _scan = 0.55 + 0.45*sin(_p.y*130.0 - uSkinTime*7.0);
    vec3 _holo = skinIriPal(_fres*0.4 + 0.55 + uSkinTime*0.04);
    _skinCol = _holo * (0.55 + 0.45*_scan) + _fres*0.3;
  } else if (uSkinMode < 3.5) {
    // VOID — negro profundo con estrellas que se desplazan (cosmos interior).
    vec3 _cell = floor(_p*42.0 + vec3(0.0, uSkinTime*0.6, uSkinTime*0.15));
    float _star = step(0.987, skinHash31(_cell));
    float _twk = 0.6 + 0.4*sin(uSkinTime*3.0 + skinHash31(_cell)*30.0);
    _skinCol = vec3(0.015,0.0,0.04) + _star*_twk*vec3(0.7,0.85,1.0);
    _skinCol += skinIriPal(_fres*1.2 + uSkinTime*0.02)*0.12*_fres;
  } else if (uSkinMode < 4.5) {
    // LAVA — corteza con grietas incandescentes. Guardamos el glow en el global
    // para sumarlo al emissive sin re-evaluar Worley.
    vec3 _lavaAlb; vec3 _lavaGlow;
    skinLava(_p, uSkinTime, _lavaAlb, _lavaGlow);
    _skinCol = _lavaAlb;
    _skinEmissive = _lavaGlow;
  } else if (uSkinMode < 5.5) {
    // GREEN SLIME — gel verde translúcido glossy. Fresnel: centro blanco-hueso
    // (se ve "a través" del gel), bordes verde saturado + rim neón. Mottling
    // animado = superficie de gel viva. El rim/glow va al emissive (bloom neón).
    // Movimiento VIVO: domain warp (ruido que deforma al ruido en el tiempo) →
    // el gel "hierve"/se retuerce orgánicamente en vez de solo desplazarse.
    vec2 _w = vec2(
      skinVN(_p*1.7 + vec3(uSkinTime*0.5, 0.0, 0.0)),
      skinVN(_p*1.7 + vec3(0.0, uSkinTime*0.45, 9.0))
    ) - 0.5;
    vec3 _flow = vec3(_w * 1.5, 0.0);
    float _mott = skinVN((_p + _flow)*5.0 + vec3(0.0, uSkinTime*0.4, 0.0));
    // Paleta de gel SATURADA. Cuerpo = verde; pelo (uIsHair) = morado. Highlight
    // donde la luz "pasa" por el gel; rim neón en los bordes; glow al emissive.
    vec3 _base, _hi, _rimC, _emC;
    if (uIsHair > 0.5) {
      _base = vec3(0.42, 0.03, 0.80);   // morado saturado
      _hi   = vec3(0.82, 0.40, 1.0);    // highlight lavanda
      _rimC = vec3(0.70, 0.15, 1.0);    // rim magenta
      _emC  = vec3(0.40, 0.06, 0.70);   // glow morado
    } else {
      _base = vec3(0.05, 0.82, 0.03);   // verde slime saturado
      _hi   = vec3(0.55, 1.0, 0.28);    // highlight lima
      _rimC = vec3(0.30, 1.0, 0.15);    // rim neón verde
      _emC  = vec3(0.14, 0.72, 0.08);   // glow verde
    }
    float _lightZone = clamp(_mott*0.65 + (1.0 - _fres)*0.35, 0.0, 1.0);
    vec3 _col = mix(_base, _hi, _lightZone*0.6);
    // Detalle gooey: manchas OSCURAS (profundidad interna del gel) con un ruido
    // más grande → el efecto slime se lee mucho mejor.
    float _blob = skinVN((_p + _flow*1.4)*3.2 + vec3(0.0, uSkinTime*0.22, 5.0));
    float _dark = smoothstep(0.58, 0.16, _blob);
    _col = mix(_col, _base * 0.28, _dark * 0.7);
    // BURBUJAS: spots brillantes que SUBEN y aparecen/explotan (pop) → gel vivo.
    float _bub = skinVN((_p + _flow*0.6)*7.0 + vec3(0.0, -uSkinTime*0.7, 20.0));
    float _bubMask = smoothstep(0.70, 0.93, _bub) * (0.45 + 0.55*sin(uSkinTime*3.2 + _bub*40.0));
    _col += _hi * max(_bubMask, 0.0) * 1.2;
    float _rim = pow(_fres, 2.5);
    _col += _rimC * _rim * 0.9;                       // rim neón
    // Escena LINEAR (como el retrato) → compensación mínima (solo gap de bloom).
    float _emK = 1.0;
    if (uInPortrait < 0.5) {
      float _lum = dot(_col, vec3(0.299, 0.587, 0.114));
      _col = mix(vec3(_lum), _col, 1.10);            // saturación leve
      _emK = 1.3;                                     // glow leve
    }
    _skinCol = _col;
    // Glow saturado (R/B o R/G bajos evitan el blanco al florecer con el bloom).
    vec3 _emBase = (uIsHair > 0.5) ? vec3(0.06, 0.01, 0.13) : vec3(0.02, 0.26, 0.015);
    _skinEmissive = (_emBase * (0.5 + 0.5*_mott) + _emC * _rim) * _emK;
  } else {
    // GOLD (Legendary) — oro pulido toon sobre el MISMO modelo (sin GLB aparte).
    // Albedo dorado con fresnel (centro cálido, bordes claros) + una banda
    // especular que recorre la superficie (shimmer vivo). No metálico → conserva
    // el cel-shading; el brillo es procedural y florece levemente con el bloom.
    vec3 _gDeep = vec3(0.24, 0.12, 0.015);  // bronce profundo (sombra) → no "vainilla"
    vec3 _gBase = vec3(0.74, 0.48, 0.045);  // oro ámbar saturado rico (cuerpo)
    vec3 _gHi   = vec3(1.0, 0.79, 0.26);    // highlight dorado (NO crema)
    float _shine = pow(0.5 + 0.5*sin(_p.y*7.0 - uSkinTime*1.8 + _fres*5.0), 10.0);
    float _micro = 0.5 + 0.5*sin(_p.x*40.0 + _p.y*40.0 + uSkinTime*0.5);
    // Cuerpo: oscuro en los bordes/sombra → oro saturado al centro/luz.
    vec3 _g = mix(_gDeep, _gBase, smoothstep(0.0, 0.7, 1.0 - _fres));
    // Highlight SOLO en la banda animada del shimmer (+ micro sutil) → el cuerpo
    // se mantiene oro rico/oscuro en vez de lavarse a crema.
    _g = mix(_g, _gHi, clamp(_shine*0.85 + _micro*0.05, 0.0, 1.0));
    // SPARKLES de 4 picos (estrellitas coquetas) que titilan sobre el oro.
    // TRIPLANAR: mezcla el sparkle de los 3 planos según la normal → cada cara
    // usa el plano más alineado y la estrella NO se deforma/estira en superficies
    // anguladas (antes se veían como rectángulos al usar un solo plano).
    vec3 _wn = abs(_sN);
    _wn /= (_wn.x + _wn.y + _wn.z + 1e-4);
    float _spark = skinSparkle(_p.xy * 9.5, uSkinTime) * _wn.z
                 + skinSparkle(_p.yz * 9.5, uSkinTime) * _wn.x
                 + skinSparkle(_p.xz * 9.5, uSkinTime) * _wn.y;
    _g += vec3(1.0, 0.96, 0.78) * _spark * 1.3;
    _skinCol = _g;
    _skinEmissive = _gHi * _shine * 0.32 + vec3(1.0, 0.92, 0.65) * _spark * 0.9;
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, _skinCol, uSkinAmount);
}
`

// ── Estado de módulo ────────────────────────────────────────────────
// Set de objetos `uniforms` de los shaders compilados (escena + retrato).
const liveUniforms = new Set()
let currentMode = 0
let currentAmount = 1
let rafId = null
let startMs = 0

// Color del stroke (outline inverted-hull) + ink lines de la skin activa.
// Por default negro; el void lo pone blanco. Se MUTA en sitio (identidad
// estable) para que EdgeInkEffect, que lee su prop `color` cada frame, lo
// recoja sin re-render. El evento notifica a quien necesite update inmediato
// (el outline material en Player/retrato).
export const skinLineColor = [0, 0, 0]
export const SKIN_LINE_COLOR_EVENT = 'character-skin-line-color'

// Colores forzados por la skin activa (ej. void → ojos/orb blancos, no
// editables). null = sin forzar (el usuario manda). Lo leen los effects de
// color de Player/retrato al re-aplicar tras un cambio de skin.
let skinForcedColors = null
export function getSkinForcedColors() { return skinForcedColors }

// Modo del shader de skin activo (0 ninguno, 1 oil, 2 hologram, 3 void, 4 lava).
// Lo lee LavaDrips para emitir gotas solo con la skin lava.
export function getCurrentSkinMode() { return currentMode }

function tick() {
  rafId = null
  if (currentMode <= 0 || liveUniforms.size === 0) return
  const t = (now() - startMs) / 1000
  liveUniforms.forEach((u) => { if (u.uSkinTime) u.uSkinTime.value = t })
  rafId = requestAnimationFrame(tick)
}

function now() {
  try { return performance.now() } catch { return Date.now() }
}

function ensureTicker() {
  if (rafId == null && currentMode > 0 && liveUniforms.size > 0) {
    if (!startMs) startMs = now()
    rafId = requestAnimationFrame(tick)
  }
}

// Activa un skin shader globalmente (todos los materiales del personaje).
// mode: 0 = ninguno (base/gold), 1 = oil, 2 = hologram, 3 = void.
// lineColor: color del outline + ink lines (void = blanco, resto = negro).
// forcedColors: { eyes, orb } forzados por la skin (void) o null.
export function setActiveSkinShader(mode = 0, amount = 1, lineColor = [0, 0, 0], forcedColors = null) {
  currentMode = mode | 0
  currentAmount = amount
  liveUniforms.forEach((u) => {
    if (u.uSkinMode) u.uSkinMode.value = currentMode
    if (u.uSkinAmount) u.uSkinAmount.value = currentAmount
  })
  if (currentMode > 0) ensureTicker()

  // Stroke + ink color (mutación en sitio) y colores forzados.
  skinLineColor[0] = lineColor[0]
  skinLineColor[1] = lineColor[1]
  skinLineColor[2] = lineColor[2]
  skinForcedColors = forcedColors || null
  // Evento de cambio de skin: el outline (Player) toma el lineColor; los effects
  // de color (Player/retrato) re-aplican (incl. los forcedColors). Se dispara
  // siempre — un cambio de skin es poco frecuente y los listeners son baratos.
  try {
    window.dispatchEvent(new CustomEvent(SKIN_LINE_COLOR_EVENT, { detail: { color: [skinLineColor[0], skinLineColor[1], skinLineColor[2]] } }))
  } catch { }
}

// Inyecta el shader de skins en un material (idempotente). Llamar SOLO en los
// materiales que deben recibir skin (Head/Hair) y ANTES de applyToonBanding.
export function applyCharacterSkinShader(material) {
  if (!material || !material.isMaterial) return material
  if (material.userData && material.userData.__skinShaded) return material

  const prev = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    try { if (typeof prev === 'function') prev(shader, renderer) } catch { }
    shader.uniforms.uSkinTime = { value: 0 }
    shader.uniforms.uSkinMode = { value: currentMode }
    shader.uniforms.uSkinAmount = { value: currentAmount }
    // El retrato setea __portraitMaterial antes de aplicar el skin shader. Lo
    // usamos para compensar el bloom débil + ACES de la escena (el slime emite
    // más en escena para que su rim florezca, igual que en el retrato).
    shader.uniforms.uInPortrait = { value: (material.userData && material.userData.__portraitMaterial) ? 1.0 : 0.0 }
    shader.uniforms.uIsHair = { value: (material.name && /^Hair$/i.test(material.name)) ? 1.0 : 0.0 }
    // Vertex: varying de posición local (rest pose).
    shader.vertexShader = 'varying vec3 vSkinObjPos;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n\tvSkinObjPos = position;'
    )
    // Fragment: modula el albedo justo después de resolverlo.
    shader.fragmentShader = GLSL_FRAG_HEAD + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' + GLSL_FRAG_BLOCK
    )
    // Metalness por skin: lava MATE (roughness 1, sin reflejo dorado del HDRI),
    // slime GLOSSY/mojado (roughness baja → highlight húmedo). Ambos metalness 0.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      if (uSkinMode > 3.5) {
        metalnessFactor = 0.0;
        if (uSkinMode > 5.5) {
          // GOLD: glossy en el RETRATO (lighting controlado → bandas toon nítidas),
          // pero más SATIN en la ESCENA. Con el HDRI fuerte, un gold muy glossy
          // refleja tanto que el especular LAVA las bandas negras del toon; subir
          // la roughness deja que el difuso/banding domine y las bandas vuelvan.
          roughnessFactor = (uInPortrait > 0.5) ? 0.22 : 0.55;
        } else {
          roughnessFactor = (uSkinMode > 4.5) ? 0.18 : 1.0; // slime glossy / lava mate
        }
      }`
    )
    // Emissive: lava/slime suman su glow a totalEmissiveRadiance → grietas / rim
    // brillan (bloom las recoge). Otros modos dejan _skinEmissive en 0.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += _skinEmissive * (uSkinMode > 4.5 ? 0.85 : 1.4);`
    )
    liveUniforms.add(shader.uniforms)
    material.userData.__skinUniforms = shader.uniforms
    ensureTicker()
  }

  const prevKey = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey.bind(material)
    : null
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|skinShader'

  material.needsUpdate = true
  if (!material.userData) material.userData = {}
  material.userData.__skinShaded = true
  return material
}

// Nombres de material del GLB que reciben skin (esqueleto/cuerpo + pelo).
// Excluye Eyes/Pupils/Emisive para conservar el brillo de ojos y el negro plano.
export function materialTakesSkin(material) {
  return !!(material && material.name && /^(Head|Hair)$/i.test(material.name))
}
