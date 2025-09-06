const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/Section2-BPEedqqC.js","assets/vendor-kJyMmUE3.js","assets/Section3-iAd3N-7Y.js","assets/Section4-BQqydh3B.js"])))=>i.map(i=>d[i]);
import { u as useThree, r as reactExports, C as Color, a as jsxRuntimeExports, E as Environment$1, M as MeshReflectorMaterial, b as useGLTF, c as useAnimations, V as Vector3, R as React, B as Box3, L as LoopRepeat, d as useFrame, e as MathUtils, f as BufferAttribute, A as AdditiveBlending, K as KTX2Loader, Q as Quaternion, g as Euler, O as OrbitControls, s as shaderMaterial, h as extend, i as gsapWithCSS, F as ForwardRef, k as Canvas, l as dt, m as Rt, n as BlendFunction, y as yt, U as Ut, G as GlitchMode, o as clone, p as Raycaster, P as Plane, q as Matrix4, t as Lt, w as wt, X as Xt, T as ToneMappingMode, v as ce, x as qt, z as Ct, D as At, H as FrontSide, I as TransformControls, J as ForwardRef$1, N as ForwardRef$2, S as ForwardRef$3, W as ForwardRef$4, Y as ForwardRef$5, _ as __vitePreload, Z as Frustum, $ as Sphere, a0 as PCFSoftShadowMap, a1 as AdaptiveDpr, a2 as ForwardRef$6, a3 as ForwardRef$7, a4 as Object3D, a5 as ReactDOM } from "./vendor-kJyMmUE3.js";
(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) return;
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") continue;
      for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep) return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
function Environment({ overrideColor, lowPerf = false, noAmbient = false }) {
  const bg = overrideColor || "#204580";
  const { scene } = useThree();
  const reflectRef = reactExports.useRef();
  reactExports.useEffect(() => {
    if (scene) {
      scene.background = new Color(bg);
    }
  }, [scene, bg]);
  reactExports.useEffect(() => {
    const mat = reflectRef.current;
    if (!mat) return;
    mat.onBeforeCompile = (shader) => {
      try {
        const targetLine = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
        const replacement = `
          vec3 _out = outgoingLight;
          float _lum = dot(_out, vec3(0.2126, 0.7152, 0.0722));
          // Clamp only very hot highlights
          float _k = smoothstep(0.92, 1.2, _lum);
          vec3 _tgt = _out * (0.85 / max(_lum, 1e-3));
          _out = mix(_out, _tgt, _k);
          gl_FragColor = vec4(_out, diffuseColor.a );
        `;
        if (shader.fragmentShader.includes(targetLine)) {
          shader.fragmentShader = shader.fragmentShader.replace(targetLine, replacement);
        }
      } catch {
      }
    };
    mat.needsUpdate = true;
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Environment$1,
      {
        files: `${"/development/"}light.hdr`,
        background: false,
        frames: lowPerf ? 1 : 40,
        environmentIntensity: 0.45
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("color", { attach: "background", args: [bg] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("fog", { attach: "fog", args: [bg, 25, 120] }),
    !noAmbient && /* @__PURE__ */ jsxRuntimeExports.jsx("ambientLight", { intensity: 0.4 }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { rotation: [-Math.PI / 2, 0, 0], receiveShadow: true, renderOrder: -20, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("planeGeometry", { args: [1e3, 1e3] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        MeshReflectorMaterial,
        {
          ref: reflectRef,
          blur: lowPerf ? [80, 24] : [140, 40],
          resolution: lowPerf ? 256 : 512,
          mixBlur: 0.6,
          mixStrength: 0.85,
          roughness: 0.94,
          metalness: 0,
          mirror: 0.08,
          depthScale: 0.55,
          minDepthThreshold: 0.5,
          maxDepthThreshold: 1.05,
          mixContrast: 0.85,
          dithering: true,
          color: bg,
          depthWrite: true
        }
      )
    ] })
  ] });
}
function PauseFrameloop({ paused = false }) {
  const { setFrameloop, invalidate } = useThree();
  reactExports.useEffect(() => {
    try {
      setFrameloop(paused ? "never" : "always");
      if (!paused) invalidate();
    } catch {
    }
  }, [paused, setFrameloop, invalidate]);
  return null;
}
function useKeyboard() {
  const [keys, setKeys] = reactExports.useState({
    forward: false,
    backward: false,
    left: false,
    right: false
  });
  reactExports.useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      setKeys((state) => {
        switch (key) {
          case "w":
          case "arrowup":
            return { ...state, forward: true };
          case "s":
          case "arrowdown":
            return { ...state, backward: true };
          case "a":
          case "arrowleft":
            return { ...state, left: true };
          case "d":
          case "arrowright":
            return { ...state, right: true };
          default:
            return state;
        }
      });
    };
    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      setKeys((state) => {
        switch (key) {
          case "w":
          case "arrowup":
            return { ...state, forward: false };
          case "s":
          case "arrowdown":
            return { ...state, backward: false };
          case "a":
          case "arrowleft":
            return { ...state, left: false };
          case "d":
          case "arrowright":
            return { ...state, right: false };
          default:
            return state;
        }
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
  return keys;
}
const __vite_import_meta_env__ = { "BASE_URL": "/development/", "DEV": false, "MODE": "production", "PROD": true, "SSR": false };
const cache = /* @__PURE__ */ new Map();
let masterVolume = 0.5;
function resolveUrl(name) {
  const base = import.meta && __vite_import_meta_env__ && "/development/" || "/";
  const candidates = [
    `${base}fx/${name}.wav`,
    `${base}${name}.wav`
  ];
  return candidates;
}
async function ensurePreloaded(name) {
  if (cache.has(name)) return cache.get(name);
  const urls = resolveUrl(name);
  for (const url of urls) {
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      await new Promise((resolve, reject) => {
        const onCanPlay = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("audio error"));
        };
        const cleanup = () => {
          audio.removeEventListener("canplaythrough", onCanPlay);
          audio.removeEventListener("error", onError);
        };
        audio.addEventListener("canplaythrough", onCanPlay, { once: true });
        audio.addEventListener("error", onError, { once: true });
        setTimeout(() => {
          cleanup();
          resolve();
        }, 400);
      });
      cache.set(name, url);
      return url;
    } catch {
    }
  }
  const fallback = urls[0];
  cache.set(name, fallback);
  return fallback;
}
async function playSfx(name, opts = {}) {
  const { volume = 1 } = opts;
  try {
    const url = await ensurePreloaded(name);
    const a = new Audio(url);
    a.volume = Math.max(0, Math.min(1, volume * masterVolume));
    a.play().catch(() => {
    });
  } catch {
  }
}
function preloadSfx(names = []) {
  names.forEach((n) => {
    ensurePreloaded(n).catch(() => {
    });
  });
}
function getSfxMasterVolume() {
  return masterVolume;
}
function lerpAngleWrapped(current, target, t) {
  const TAU = Math.PI * 2;
  let delta = (target - current + Math.PI) % TAU - Math.PI;
  return current + delta * t;
}
function Player({ playerRef, portals = [], onPortalEnter, onProximityChange, onPortalsProximityChange, onNearPortalChange, navigateToPortalId = null, onReachedPortal, onOrbStateChange, onHomeSplash, onHomeFallStart, onCharacterReady, sceneColor }) {
  const { gl } = useThree();
  const { scene, animations } = useGLTF(
    `${"/development/"}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader();
        ktx2.setTranscoderPath("https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/");
        if (gl) ktx2.detectSupport(gl);
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2);
      } catch {
      }
    }
  );
  const { actions, mixer } = useAnimations(animations, scene);
  const walkDurationRef = reactExports.useRef(1);
  const idleDurationRef = reactExports.useRef(1);
  const { camera } = useThree();
  const orbActiveRef = reactExports.useRef(false);
  const [orbActive, setOrbActive] = reactExports.useState(false);
  const orbTargetPosRef = reactExports.useRef(new Vector3());
  const orbTrailRef = reactExports.useRef([]);
  const lastPosRef = reactExports.useRef(new Vector3());
  const sparksRef = reactExports.useRef([]);
  const explosionBoostRef = reactExports.useRef(0);
  const explosionQueueRef = reactExports.useRef({ sphere: 0, ring: 0, splash: 0, pos: new Vector3() });
  const MAX_SPARKS = 1800;
  const dtSmoothRef = reactExports.useRef(1 / 60);
  const dtMoveRef = reactExports.useRef(1 / 60);
  const ORB_SPEED = 22;
  const PORTAL_STOP_DIST = 0.9;
  const ORB_HEIGHT = 1;
  const ORB_RADIUS = 0.6;
  const FALL_STOP_Y = ORB_RADIUS - ORB_HEIGHT;
  const HOME_FALL_HEIGHT = 22;
  const WOBBLE_BASE = 1.5;
  const WOBBLE_FREQ1 = 2.1;
  const WOBBLE_FREQ2 = 1.7;
  const ARRIVAL_NEAR_DIST = 1.4;
  const orbOriginOffsetRef = reactExports.useRef(new Vector3(0, 0.8, 0));
  const orbMatRef = reactExports.useRef(null);
  const orbLightRef = reactExports.useRef(null);
  const orbBaseColorRef = reactExports.useRef(new Color("#aee2ff"));
  const orbTargetColorRef = reactExports.useRef(new Color("#9ec6ff"));
  const orbStartDistRef = reactExports.useRef(1);
  const fallFromAboveRef = reactExports.useRef(false);
  const fallStartTimeRef = reactExports.useRef(0);
  reactExports.useRef(0);
  const wobblePhaseRef = reactExports.useRef(Math.random() * Math.PI * 2);
  const wobblePhase2Ref = reactExports.useRef(Math.random() * Math.PI * 2);
  const nearTimerRef = reactExports.useRef(0);
  const lastDistRef = reactExports.useRef(Infinity);
  const hasExplodedRef = reactExports.useRef(false);
  const prevWalkNormRef = reactExports.useRef(0);
  const nextIsRightRef = reactExports.useRef(true);
  const footCooldownSRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    preloadSfx(["magiaInicia", "sparkleBom", "sparkleFall", "stepone", "steptwo"]);
  }, []);
  const fadeOutTRef = reactExports.useRef(0);
  const fadeInTRef = reactExports.useRef(0);
  const showOrbRef = reactExports.useRef(false);
  const FADE_IN = 0.06;
  const applyModelOpacity = (opacity) => {
    try {
      scene.traverse((obj) => {
        if (obj.material) {
          const m = obj.material;
          if (Array.isArray(m)) {
            m.forEach((mm) => {
              mm.transparent = opacity < 1;
              mm.opacity = opacity;
              mm.depthWrite = opacity >= 1;
              try {
                if (mm.emissive) {
                  mm.emissive = new Color("#ffd480");
                  mm.emissiveIntensity = 1.6;
                }
              } catch {
              }
            });
          } else {
            m.transparent = opacity < 1;
            m.opacity = opacity;
            m.depthWrite = opacity >= 1;
            try {
              if (m.emissive) {
                m.emissive = new Color("#ffd480");
                m.emissiveIntensity = 1.6;
              }
            } catch {
            }
          }
        }
      });
    } catch {
    }
  };
  reactExports.useEffect(() => {
    if (!scene) return;
    try {
      scene.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          try {
            if (m && m.emissive) {
              m.emissive = new Color("#ffd480");
              m.emissiveIntensity = 1.6;
            }
          } catch {
          }
        });
      });
    } catch {
    }
  }, [scene]);
  const readyOnceRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (!scene) return;
    if (readyOnceRef.current) return;
    readyOnceRef.current = true;
    if (typeof onCharacterReady === "function") {
      try {
        onCharacterReady();
      } catch {
      }
    }
  }, [scene, onCharacterReady]);
  reactExports.useEffect(() => {
    if (!navigateToPortalId || !playerRef.current) return;
    if (orbActiveRef.current) return;
    let portal = portals.find((p) => p.id === navigateToPortalId);
    if (!portal && navigateToPortalId === "home") {
      orbTargetPosRef.current.set(0, 0, 0);
      try {
        playerRef.current.position.set(0, HOME_FALL_HEIGHT, 0);
      } catch {
      }
      fallFromAboveRef.current = true;
      try {
        fallStartTimeRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      } catch {
        fallStartTimeRef.current = Date.now();
      }
      if (typeof onHomeFallStart === "function") {
        try {
          onHomeFallStart();
        } catch {
        }
      }
    } else if (portal) {
      orbTargetPosRef.current.fromArray(portal.position);
      fallFromAboveRef.current = false;
    } else {
      return;
    }
    orbTargetPosRef.current.y = playerRef.current.position.y;
    fadeOutTRef.current = 0;
    fadeInTRef.current = 0;
    showOrbRef.current = true;
    try {
      applyModelOpacity(0);
    } catch {
    }
    orbActiveRef.current = true;
    setOrbActive(true);
    if (typeof onOrbStateChange === "function") onOrbStateChange(true);
    if (fallFromAboveRef.current) {
      playSfx("sparkleFall", { volume: 0.9 });
    } else {
      playSfx("magiaInicia", { volume: 0.9 });
    }
    try {
      const startPos2 = new Vector3();
      playerRef.current.getWorldPosition(startPos2);
      startPos2.add(new Vector3(0, ORB_HEIGHT, 0));
      const groundY = playerRef.current ? playerRef.current.position.y : 0;
      const initialSplash = fallFromAboveRef.current ? 80 : 140;
      for (let i = 0; i < initialSplash; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.22;
        const dirXZ = new Vector3(Math.cos(a), 0, Math.sin(a));
        const speedXZ = (fallFromAboveRef.current ? 7 : 9) + Math.random() * (fallFromAboveRef.current ? 7 : 9);
        const velXZ = dirXZ.multiplyScalar(speedXZ);
        const p = startPos2.clone();
        p.y = groundY + 0.06;
        p.x += Math.cos(a) * r;
        p.z += Math.sin(a) * r;
        const s = { pos: p, vel: velXZ, life: 2 + Math.random() * 2.6, _life0: 2, _grounded: true, _groundT: 0 };
        s.vel.x += (Math.random() - 0.5) * 1.8;
        s.vel.z += (Math.random() - 0.5) * 1.8;
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s);
      }
      explosionBoostRef.current = Math.max(explosionBoostRef.current, 1.25);
      explosionQueueRef.current.splash += 80;
      explosionQueueRef.current.sphere += 40;
      explosionQueueRef.current.ring += 30;
      const immediateSphere = 30;
      const immediateRing = 20;
      for (let i = 0; i < immediateSphere; i++) {
        const u = Math.random() * 2 - 1;
        const phi = Math.random() * Math.PI * 2;
        const sqrt1u2 = Math.sqrt(1 - u * u);
        const dirExp = new Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi));
        const speedExp = 6 + Math.random() * 10;
        const velExp = dirExp.multiplyScalar(speedExp);
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: startPos2.clone().setY(groundY + 0.06), vel: velExp, life: 1.6 + Math.random() * 2, _life0: 1.6 });
      }
      for (let i = 0; i < immediateRing; i++) {
        const a = Math.random() * Math.PI * 2;
        const dirRing = new Vector3(Math.cos(a), 0, Math.sin(a));
        const velRing = dirRing.multiplyScalar(9 + Math.random() * 8).add(new Vector3(0, (Math.random() - 0.5) * 1.2, 0));
        if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: startPos2.clone().setY(groundY + 0.06), vel: velRing, life: 1.4 + Math.random() * 1.8, _life0: 1.4 });
      }
      playSfx("sparkleBom", { volume: 0.85 });
    } catch {
    }
    wobblePhaseRef.current = Math.random() * Math.PI * 2;
    wobblePhase2Ref.current = Math.random() * Math.PI * 2;
    nearTimerRef.current = 0;
    lastDistRef.current = Infinity;
    hasExplodedRef.current = false;
    setCharacterShadowEnabled(false);
    orbTrailRef.current = [];
    sparksRef.current = [];
    lastPosRef.current.copy(playerRef.current.position);
    try {
      if (portal?.color) orbTargetColorRef.current = new Color(portal.color);
      else orbTargetColorRef.current = new Color("#9ec6ff");
    } catch {
    }
    const startPos = playerRef.current.position.clone();
    const groundTarget = orbTargetPosRef.current.clone();
    orbStartDistRef.current = Math.max(1e-3, groundTarget.distanceTo(startPos));
  }, [navigateToPortalId, portals, playerRef, onHomeFallStart]);
  reactExports.useEffect(() => {
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = false;
      }
    } catch {
    }
  }, []);
  reactExports.useEffect(() => {
    try {
      const box = new Box3().setFromObject(scene);
      const center = new Vector3();
      box.getCenter(center);
      orbOriginOffsetRef.current.copy(center);
    } catch {
    }
  }, [scene]);
  const keyboard = useKeyboard();
  reactExports.useEffect(() => {
    if (!animations || !actions) return;
  }, [animations, actions]);
  const setCharacterShadowEnabled = React.useCallback((enabled) => {
    if (!scene) return;
    try {
      scene.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!enabled;
          o.receiveShadow = false;
        }
      });
    } catch {
    }
  }, [scene]);
  reactExports.useEffect(() => {
    setCharacterShadowEnabled(true);
  }, [setCharacterShadowEnabled]);
  const [idleName, walkName] = reactExports.useMemo(() => {
    const names = actions ? Object.keys(actions) : [];
    const explicitIdle = "root|root|Iddle";
    const explicitWalk = "root|root|Walking";
    const idle = names.includes(explicitIdle) ? explicitIdle : names.find((n) => n.toLowerCase().includes("idle")) || names[0];
    const walk = names.includes(explicitWalk) ? explicitWalk : names.find((n) => n.toLowerCase().includes("walk")) || names[1];
    if (names.length) {
      console.log("[Player] Using idle clip:", idle);
      console.log("[Player] Using walk clip:", walk);
    }
    return [idle, walk];
  }, [actions]);
  const walkWeightRef = reactExports.useRef(0);
  const IDLE_TIMESCALE = 1.65;
  const WALK_TIMESCALE_MULT = 1.2;
  reactExports.useEffect(() => {
    if (!actions) return;
    const idleAction = idleName && actions[idleName];
    const walkAction = walkName && actions[walkName];
    if (idleAction) {
      idleAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(IDLE_TIMESCALE).play();
      idleAction.setLoop(LoopRepeat, Infinity);
      idleAction.clampWhenFinished = false;
      try {
        idleDurationRef.current = idleAction.getClip()?.duration || idleDurationRef.current;
      } catch {
      }
    }
    if (walkAction) {
      const baseWalkScale = Math.max(1, SPEED / BASE_SPEED * WALK_TIMESCALE_MULT);
      walkAction.reset().setEffectiveWeight(0).setEffectiveTimeScale(baseWalkScale).play();
      walkAction.setLoop(LoopRepeat, Infinity);
      walkAction.clampWhenFinished = false;
      try {
        walkDurationRef.current = walkAction.getClip()?.duration || walkDurationRef.current;
      } catch {
      }
    }
  }, [actions, idleName, walkName]);
  const BASE_SPEED = 5;
  const SPEED = 8;
  const threshold = 3;
  const EXIT_THRESHOLD = 4;
  const PROXIMITY_RADIUS = 12;
  const insideMapRef = reactExports.useRef({});
  const cooldownRef = reactExports.useRef({ portalId: null, untilS: 0 });
  const NEAR_INNER = 1.6;
  const NEAR_OUTER = 9;
  const smoothstep = (edge0, edge1, x) => {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  useFrame((state, delta) => {
    if (!playerRef.current) return;
    const dtRaw = Math.min(delta, 1 / 15);
    const dtClamped = MathUtils.clamp(dtRaw, 1 / 120, 1 / 30);
    dtSmoothRef.current = MathUtils.lerp(dtSmoothRef.current, dtClamped, 0.18);
    dtMoveRef.current = dtRaw;
    const dt2 = dtSmoothRef.current;
    if (mixer) mixer.timeScale = 1;
    footCooldownSRef.current = Math.max(0, footCooldownSRef.current - dt2);
    try {
      if (orbLightRef.current && orbLightRef.current.shadow) {
        orbLightRef.current.shadow.autoUpdate = !!orbActiveRef.current;
      }
    } catch {
    }
    if (orbActiveRef.current) {
      applyModelOpacity(0);
    }
    if (!orbActiveRef.current && showOrbRef.current) {
      applyModelOpacity(0);
    } else if (!orbActiveRef.current && !showOrbRef.current && fadeInTRef.current < 1) {
      fadeInTRef.current = Math.min(1, fadeInTRef.current + dt2 / FADE_IN);
      applyModelOpacity(fadeInTRef.current);
      if (fadeInTRef.current >= 1) {
        if (typeof onOrbStateChange === "function") onOrbStateChange(false);
        setCharacterShadowEnabled(true);
      }
    }
    if (orbActiveRef.current) {
      const pos = playerRef.current.position;
      orbTrailRef.current.push(pos.clone());
      if (orbTrailRef.current.length > 120) orbTrailRef.current.shift();
      const dir = new Vector3().subVectors(orbTargetPosRef.current, pos);
      let dist = dir.length();
      let crossedIn = false;
      if (fallFromAboveRef.current) {
        const fallSpeed = 16;
        pos.y = pos.y - fallSpeed * (dtMoveRef.current || dt2);
        const k = 1 - Math.pow(1e-3, dtMoveRef.current || dt2);
        pos.x = MathUtils.lerp(pos.x, 0, k);
        pos.z = MathUtils.lerp(pos.z, 0, k);
      } else {
        let steerDir = dir.clone();
        if (dist > 1e-6) {
          const tNow = state.clock.getElapsedTime();
          const progress = MathUtils.clamp(1 - dist / Math.max(1e-3, orbStartDistRef.current), 0, 1);
          const farFactor = MathUtils.smoothstep(dist, 0, PORTAL_STOP_DIST * 2.5);
          const amplitude = WOBBLE_BASE * 0.6 * Math.pow(1 - progress, 1.2) * farFactor;
          const up2 = Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
          const side1 = new Vector3().crossVectors(dir, up2).normalize();
          const side2 = new Vector3().crossVectors(dir, side1).normalize();
          const wobble = side1.multiplyScalar(Math.sin(tNow * WOBBLE_FREQ1 + wobblePhaseRef.current) * amplitude).add(side2.multiplyScalar(Math.cos(tNow * WOBBLE_FREQ2 + wobblePhase2Ref.current) * amplitude * 0.85));
          steerDir.add(wobble);
          steerDir.normalize();
        } else {
          steerDir.set(0, 0, 0);
        }
        const step = Math.min(dist, ORB_SPEED * (dtMoveRef.current || dt2));
        pos.addScaledVector(steerDir, step);
        const distAfter = orbTargetPosRef.current.distanceTo(pos);
        crossedIn = lastDistRef.current > PORTAL_STOP_DIST && distAfter <= PORTAL_STOP_DIST;
        lastDistRef.current = distAfter;
        if (distAfter < ARRIVAL_NEAR_DIST) nearTimerRef.current += dtMoveRef.current || dt2;
        else nearTimerRef.current = Math.max(0, nearTimerRef.current - (dtMoveRef.current || dt2) * 0.5);
        dir.copy(steerDir);
        if (distAfter <= 0.02) {
          pos.copy(orbTargetPosRef.current);
        }
        dist = distAfter;
      }
      if (orbMatRef.current) {
        const distNow = orbTargetPosRef.current.distanceTo(pos);
        const k = MathUtils.clamp(1 - distNow / orbStartDistRef.current, 0, 1);
        const col = orbBaseColorRef.current.clone().lerp(orbTargetColorRef.current, k);
        orbMatRef.current.emissive.copy(col);
        orbMatRef.current.color.copy(col.clone().multiplyScalar(0.9));
        orbMatRef.current.emissiveIntensity = 5 + 2 * k;
        orbMatRef.current.needsUpdate = true;
        if (orbLightRef.current) {
          orbLightRef.current.color.copy(col);
          orbLightRef.current.intensity = 6 + 6 * k;
          orbLightRef.current.distance = 12;
          orbLightRef.current.decay = 1.6;
          if (orbLightRef.current.shadow) {
            orbLightRef.current.shadow.autoUpdate = true;
          }
        }
      }
      const worldPos = new Vector3();
      playerRef.current.getWorldPosition(worldPos);
      worldPos.add(new Vector3(0, ORB_HEIGHT, 0));
      const moveVec = new Vector3().subVectors(worldPos, lastPosRef.current);
      const speed = moveVec.length() / Math.max(dtMoveRef.current || dt2, 1e-4);
      const forward = moveVec.lengthSq() > 1e-8 ? moveVec.clone().normalize() : dir.clone();
      const backDir = forward.clone().multiplyScalar(-1);
      const up = Math.abs(backDir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const t1 = new Vector3().crossVectors(backDir, up).normalize();
      const t2 = new Vector3().crossVectors(backDir, t1).normalize();
      const diskRadius = 0.5;
      const backOffset = 0.28;
      const count = 8;
      for (let i = 0; i < count; i++) {
        const r = diskRadius * Math.sqrt(Math.random());
        const a = Math.random() * Math.PI * 2;
        const offset = t1.clone().multiplyScalar(r * Math.cos(a)).add(t2.clone().multiplyScalar(r * Math.sin(a)));
        const basePos = worldPos.clone().addScaledVector(backDir, backOffset).add(offset);
        const spread = 1.6;
        const vel = backDir.clone().multiplyScalar(Math.min(5, 0.22 * speed) + Math.random() * 0.6).add(t1.clone().multiplyScalar((Math.random() - 0.5) * spread)).add(t2.clone().multiplyScalar((Math.random() - 0.5) * spread)).add(new Vector3(0, Math.random() * 0.6, 0));
        sparksRef.current.push({ pos: basePos, vel, life: 0.4 + Math.random() * 0.6, kOverride: MathUtils.clamp(1 - orbTargetPosRef.current.distanceTo(pos) / orbStartDistRef.current, 0, 1), t: "trail" });
      }
      lastPosRef.current.copy(worldPos);
      if (!fallFromAboveRef.current) {
        const targetAngle = Math.atan2(dir.x, dir.z);
        const smoothing = 1 - Math.pow(1e-4, dt2);
        playerRef.current.rotation.y = lerpAngleWrapped(playerRef.current.rotation.y, targetAngle, smoothing);
      }
      const arrivedPortal = !fallFromAboveRef.current && (dist <= PORTAL_STOP_DIST || nearTimerRef.current > 0.06 || crossedIn);
      const arrivedFall = fallFromAboveRef.current && pos.y <= FALL_STOP_Y;
      if (arrivedPortal || arrivedFall) {
        if (hasExplodedRef.current) return;
        hasExplodedRef.current = true;
        const explodePos = explosionQueueRef.current.pos;
        playerRef.current.getWorldPosition(explodePos);
        explodePos.add(new Vector3(0, ORB_HEIGHT, 0));
        explosionQueueRef.current.sphere = 200;
        explosionQueueRef.current.ring = 100;
        explosionQueueRef.current.splash = 120;
        try {
          const immediateSphere = 140;
          const immediateRing = 70;
          const immediateSplash = 90;
          for (let i = 0; i < immediateSphere; i++) {
            const u = Math.random() * 2 - 1;
            const phi = Math.random() * Math.PI * 2;
            const sqrt1u2 = Math.sqrt(1 - u * u);
            const dirExp = new Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi));
            const speedExp = 8 + Math.random() * 14;
            const velExp = dirExp.multiplyScalar(speedExp);
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velExp, life: 2.2 + Math.random() * 2.4, _life0: 2.2 });
          }
          explosionQueueRef.current.sphere = Math.max(0, explosionQueueRef.current.sphere - immediateSphere);
          for (let i = 0; i < immediateRing; i++) {
            const a = Math.random() * Math.PI * 2;
            const dirRing = new Vector3(Math.cos(a), 0, Math.sin(a));
            const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new Vector3(0, (Math.random() - 0.5) * 2, 0));
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explodePos.clone(), vel: velRing, life: 2 + Math.random() * 2, _life0: 2 });
          }
          explosionQueueRef.current.ring = Math.max(0, explosionQueueRef.current.ring - immediateRing);
          const GROUND_Y = 0;
          for (let i = 0; i < immediateSplash; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 0.25;
            const dirXZ = new Vector3(Math.cos(a), 0, Math.sin(a));
            const speedXZ = 8 + Math.random() * 10;
            const velXZ = dirXZ.multiplyScalar(speedXZ);
            const p = explodePos.clone();
            p.y = GROUND_Y + 0.06;
            p.x += Math.cos(a) * r;
            p.z += Math.sin(a) * r;
            const s = { pos: p, vel: velXZ, life: 2.2 + Math.random() * 2.8, _life0: 2.2, _grounded: true, _groundT: 0 };
            s.vel.x += (Math.random() - 0.5) * 2;
            s.vel.z += (Math.random() - 0.5) * 2;
            if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s);
          }
          explosionQueueRef.current.splash = Math.max(0, explosionQueueRef.current.splash - immediateSplash);
        } catch {
        }
        explosionBoostRef.current = 1.6;
        playSfx("sparkleBom", { volume: 1 });
        try {
          const arr = sparksRef.current;
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] && arr[i].t === "trail") arr.splice(i, 1);
          }
        } catch {
        }
        playerRef.current.position.y = 0;
        fallFromAboveRef.current = false;
        showOrbRef.current = false;
        fadeInTRef.current = 0;
        orbTrailRef.current = [];
        if (typeof onReachedPortal === "function") onReachedPortal(navigateToPortalId);
        if (arrivedFall && typeof onHomeSplash === "function") {
          try {
            onHomeSplash();
          } catch {
          }
        }
        orbActiveRef.current = false;
        setOrbActive(false);
      }
      return;
    }
    const xInput = (keyboard.left ? -1 : 0) + (keyboard.right ? 1 : 0);
    const zInput = (keyboard.forward ? 1 : 0) + (keyboard.backward ? -1 : 0);
    const inputMag = Math.min(1, Math.abs(xInput) + Math.abs(zInput));
    const camForward = new Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    if (camForward.lengthSq() > 0) camForward.normalize();
    const camRight = new Vector3().crossVectors(camForward, new Vector3(0, 1, 0)).normalize();
    const direction = new Vector3().addScaledVector(camForward, zInput).addScaledVector(camRight, xInput);
    const hasInput = direction.lengthSq() > 1e-6;
    if (hasInput) {
      direction.normalize();
      const targetAngle = Math.atan2(direction.x, direction.z);
      const smoothing = 1 - Math.pow(1e-3, dt2);
      playerRef.current.rotation.y = lerpAngleWrapped(
        playerRef.current.rotation.y,
        targetAngle,
        smoothing
      );
      const accel = MathUtils.lerp(1, 1.25, inputMag);
      const velocity = direction.clone().multiplyScalar(SPEED * accel * (dtMoveRef.current || dt2));
      playerRef.current.position.add(velocity);
    }
    if (actions) {
      const idleAction = idleName && actions[idleName];
      const walkAction = walkName && actions[walkName];
      if (idleAction && walkAction) {
        if (idleAction.loop !== LoopRepeat) idleAction.setLoop(LoopRepeat, Infinity);
        if (walkAction.loop !== LoopRepeat) walkAction.setLoop(LoopRepeat, Infinity);
        idleAction.clampWhenFinished = false;
        walkAction.clampWhenFinished = false;
        const target = hasInput ? 1 : 0;
        const smoothing = 1 - Math.exp(-22 * dt2);
        walkWeightRef.current = MathUtils.clamp(
          MathUtils.lerp(walkWeightRef.current, target, smoothing),
          0,
          1
        );
        const walkW = walkWeightRef.current;
        const idleW = 1 - walkW;
        walkAction.enabled = true;
        idleAction.enabled = true;
        walkAction.setEffectiveWeight(walkW);
        idleAction.setEffectiveWeight(idleW);
        const baseWalkScale = Math.max(1, SPEED / BASE_SPEED * WALK_TIMESCALE_MULT);
        const animScale = MathUtils.lerp(1, baseWalkScale, walkW);
        walkAction.setEffectiveTimeScale(animScale);
        idleAction.setEffectiveTimeScale(IDLE_TIMESCALE);
        try {
          const d = Math.max(1e-3, walkDurationRef.current);
          const t = walkAction.time % d;
          const eps = 1e-3;
          if (t < eps) walkAction.time = eps;
          else if (d - t < eps) walkAction.time = d - eps;
        } catch {
        }
        try {
          const hasInputNow = hasInput;
          const walkWeight = walkWeightRef.current;
          if (hasInputNow && walkWeight > 0.5) {
            const d = Math.max(1e-3, walkDurationRef.current);
            const t = (walkAction?.time || 0) % d;
            const tNorm = t / d;
            const prev = prevWalkNormRef.current;
            const beats = [0.18, 0.68];
            const crossed = (a, b, p) => a <= b ? a < p && b >= p : a < p || b >= p;
            const hit = beats.some((p) => crossed(prev, tNorm, p));
            if (hit && footCooldownSRef.current <= 0) {
              const vol = 0.4 / Math.max(1e-4, getSfxMasterVolume());
              if (nextIsRightRef.current) playSfx("stepone", { volume: vol });
              else playSfx("steptwo", { volume: vol });
              nextIsRightRef.current = !nextIsRightRef.current;
              footCooldownSRef.current = 0.12;
            }
            prevWalkNormRef.current = tNorm;
          } else {
            const d = Math.max(1e-3, walkDurationRef.current);
            const t = (walkAction?.time || 0) % d;
            prevWalkNormRef.current = t / d;
          }
        } catch {
        }
      }
    }
    let minDistance = Infinity;
    const perPortal = {};
    const nowS = state.clock.getElapsedTime();
    let nearestId = null;
    let nearestDist = Infinity;
    portals.forEach((portal) => {
      const portalPos = new Vector3().fromArray(portal.position);
      const distance = portalPos.distanceTo(playerRef.current.position);
      if (distance < minDistance) minDistance = distance;
      if (distance < nearestDist) {
        nearestDist = distance;
        nearestId = portal.id;
      }
      const wasInside = !!insideMapRef.current[portal.id];
      const isInside = distance < threshold;
      const isOutside = distance > EXIT_THRESHOLD;
      if (isOutside) insideMapRef.current[portal.id] = false;
      if (!wasInside && isInside) {
        const blocked = cooldownRef.current.portalId === portal.id && nowS < cooldownRef.current.untilS;
        if (!blocked) {
          insideMapRef.current[portal.id] = true;
        }
      }
      const nearFactor = smoothstep(NEAR_OUTER, NEAR_INNER, distance);
      perPortal[portal.id] = MathUtils.clamp(nearFactor, 0, 1);
    });
    if (onProximityChange && isFinite(minDistance)) {
      const factor = MathUtils.clamp(1 - minDistance / PROXIMITY_RADIUS, 0, 1);
      onProximityChange(factor);
    }
    if (onPortalsProximityChange) {
      onPortalsProximityChange(perPortal);
    }
    if (onNearPortalChange) {
      const showId = nearestDist < threshold ? nearestId : null;
      onNearPortalChange(showId, nearestDist);
    }
  });
  const TrailSparks = () => {
    const geoRef = reactExports.useRef();
    const CAP = 3e3;
    const positionsRef = reactExports.useRef(new Float32Array(CAP * 3));
    const uniformsRef = reactExports.useRef({
      uBaseColor: { value: orbBaseColorRef.current.clone() },
      uTargetColor: { value: orbTargetColorRef.current.clone() },
      uMix: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uSize: { value: 0.28 },
      uOpacity: { value: 0.2 }
    });
    reactExports.useEffect(() => {
      if (!geoRef.current) return;
      const geo = geoRef.current;
      if (!geo.getAttribute("position")) {
        geo.setAttribute("position", new BufferAttribute(positionsRef.current, 3));
      }
      geo.setDrawRange(0, 0);
    }, []);
    useFrame((state, delta) => {
      const arr = sparksRef.current;
      if (!arr.length) {
        if (geoRef.current) {
          geoRef.current.setDrawRange(0, 0);
        }
        uniformsRef.current.uMix.value = 0;
        uniformsRef.current.uBaseColor.value.copy(orbBaseColorRef.current);
        uniformsRef.current.uTargetColor.value.copy(orbTargetColorRef.current);
        return;
      }
      const BATCH = 60;
      if (explosionQueueRef.current.sphere > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.sphere);
        for (let i = 0; i < n; i++) {
          const u = Math.random() * 2 - 1;
          const phi = Math.random() * Math.PI * 2;
          const sqrt1u2 = Math.sqrt(1 - u * u);
          const dirExp = new Vector3(sqrt1u2 * Math.cos(phi), u, sqrt1u2 * Math.sin(phi));
          const speedExp = 8 + Math.random() * 14;
          const velExp = dirExp.multiplyScalar(speedExp);
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel: velExp, life: 2.2 + Math.random() * 2.4, _life0: 2.2 });
        }
        explosionQueueRef.current.sphere -= n;
      }
      if (explosionQueueRef.current.ring > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.ring);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const dirRing = new Vector3(Math.cos(a), 0, Math.sin(a));
          const velRing = dirRing.multiplyScalar(12 + Math.random() * 10).add(new Vector3(0, (Math.random() - 0.5) * 2, 0));
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push({ pos: explosionQueueRef.current.pos.clone(), vel: velRing, life: 2 + Math.random() * 2, _life0: 2 });
        }
        explosionQueueRef.current.ring -= n;
      }
      if (explosionQueueRef.current.splash > 0) {
        const n = Math.min(BATCH, explosionQueueRef.current.splash);
        const GROUND_Y2 = 0;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.25;
          const dirXZ = new Vector3(Math.cos(a), 0, Math.sin(a));
          const speedXZ = 8 + Math.random() * 10;
          const velXZ = dirXZ.multiplyScalar(speedXZ);
          const p = explosionQueueRef.current.pos.clone();
          p.y = GROUND_Y2 + 0.06;
          p.x += Math.cos(a) * r;
          p.z += Math.sin(a) * r;
          const s = { pos: p, vel: velXZ, life: 2.2 + Math.random() * 2.8, _life0: 2.2, _grounded: true, _groundT: 0 };
          s.vel.x += (Math.random() - 0.5) * 2;
          s.vel.z += (Math.random() - 0.5) * 2;
          if (sparksRef.current.length < MAX_SPARKS) sparksRef.current.push(s);
        }
        explosionQueueRef.current.splash -= n;
      }
      const GRAVITY = 9.8 * 1;
      const GROUND_Y = playerRef.current ? playerRef.current.position.y : 0;
      const RESTITUTION = 0.38;
      const FRICTION = 0.94;
      const dt2 = dtSmoothRef.current ?? Math.min(delta, 1 / 60);
      for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        s.vel.y -= GRAVITY * dt2;
        s.pos.addScaledVector(s.vel, dt2);
        if (s.pos.y <= GROUND_Y) {
          s.pos.y = GROUND_Y;
          s.vel.y = Math.abs(s.vel.y) * RESTITUTION;
          s._grounded = true;
          s._groundT = (s._groundT || 0) + dt2;
          s.vel.x *= FRICTION;
          s.vel.z *= FRICTION;
          if (s._groundT > 1.2) s.life -= dt2 * 0.18;
        }
        if (!s._grounded) {
          s.vel.x *= 0.9985;
          s.vel.z *= 0.9985;
          s.life -= dt2 * 0.04;
        } else {
          s.life -= dt2 * 0.03;
        }
        if (s.life <= 0) arr.splice(i, 1);
      }
      if (arr.length > MAX_SPARKS) {
        arr.splice(0, arr.length - MAX_SPARKS);
      }
      const len = Math.min(arr.length, CAP);
      const buf = positionsRef.current;
      for (let i = 0; i < len; i++) {
        buf[i * 3 + 0] = arr[i].pos.x;
        buf[i * 3 + 1] = arr[i].pos.y;
        buf[i * 3 + 2] = arr[i].pos.z;
      }
      if (geoRef.current) {
        const geo = geoRef.current;
        if (!geo.getAttribute("position")) {
          geo.setAttribute("position", new BufferAttribute(positionsRef.current, 3));
        }
        geo.setDrawRange(0, len);
        const attr = geo.attributes?.position;
        if (attr) attr.needsUpdate = true;
      }
      const pos = playerRef.current?.position || new Vector3();
      const distNow = orbTargetPosRef.current.distanceTo(pos);
      const kDist = MathUtils.clamp(1 - distNow / Math.max(1e-3, orbStartDistRef.current), 0, 1);
      const sceneCol = new Color(sceneColor || "#ffffff");
      const baseCol = orbBaseColorRef.current.clone().lerp(sceneCol, 0.3);
      uniformsRef.current.uBaseColor.value.copy(baseCol);
      uniformsRef.current.uTargetColor.value.copy(orbTargetColorRef.current);
      uniformsRef.current.uMix.value = kDist;
      if (explosionBoostRef.current > 0) {
        explosionBoostRef.current = Math.max(0, explosionBoostRef.current - dt2 * 0.6);
      }
      const boost = explosionBoostRef.current;
      uniformsRef.current.uSize.value = 0.28 + 0.9 * boost;
      uniformsRef.current.uOpacity.value = 0.2 + 0.06 * boost;
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("points", { frustumCulled: false, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("bufferGeometry", { ref: geoRef }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "shaderMaterial",
        {
          transparent: true,
          depthWrite: false,
          depthTest: true,
          blending: AdditiveBlending,
          uniforms: uniformsRef.current,
          vertexShader: `
            uniform float uPixelRatio;
            uniform float uSize;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = uSize * (180.0 / max(1.0, -mvPosition.z)) * uPixelRatio;
            }
          `,
          fragmentShader: `
            precision highp float;
            uniform vec3 uBaseColor;
            uniform vec3 uTargetColor;
            uniform float uMix;
            uniform float uOpacity;
            void main() {
              vec2 uv = gl_PointCoord * 2.0 - 1.0;
              float d = length(uv);
              if (d > 1.0) discard;
              float core = pow(1.0 - d, 5.0);
              float halo = pow(1.0 - d, 2.0) * 0.2;
              float alpha = clamp(core + halo, 0.0, 1.0) * uOpacity;
              vec3 col = mix(uBaseColor, uTargetColor, clamp(uMix, 0.0, 1.0)) * 0.6;
              gl_FragColor = vec4(col, alpha);
            }
          `
        }
      )
    ] });
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { ref: playerRef, position: [0, 0, 0], children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { object: scene, scale: 1.5 }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { position: [0, ORB_HEIGHT, 0], children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("pointLight", { ref: orbLightRef, intensity: showOrbRef.current ? 6 : 0, distance: 12, decay: 1.6, castShadow: true, "shadow-mapSize-width": 512, "shadow-mapSize-height": 512, "shadow-bias": -6e-5, "shadow-normalBias": 0.02, "shadow-radius": 8 }),
        showOrbRef.current && /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("sphereGeometry", { args: [0.6, 24, 24] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("meshStandardMaterial", { ref: orbMatRef, emissive: new Color("#aee2ff"), emissiveIntensity: 6.5, color: new Color("#f5fbff"), transparent: true, opacity: 0.9 })
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(TrailSparks, {})
  ] });
}
useGLTF.preload(`${"/development/"}character.glb`);
function Portal({ position = [0, 0, 0], color = "#8ecae6", targetColor = "#8ecae6", mix = 0, size = 2 }) {
  const ref = reactExports.useRef();
  const matRef = reactExports.useRef();
  useFrame(() => {
    if (ref.current) {
      ref.current.rotation.z += 0.01;
    }
    if (matRef.current) {
      const base = new Color(color);
      const tgt = new Color(targetColor);
      const out = base.clone().lerp(tgt, MathUtils.clamp(mix, 0, 1));
      matRef.current.color.copy(out);
      matRef.current.emissive.copy(out);
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { ref, position, rotation: [Math.PI / 2, 0, 0], castShadow: true, receiveShadow: true, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("torusGeometry", { args: [size, size * 0.1, 16, 32] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("meshStandardMaterial", { ref: matRef, color, emissive: color, emissiveIntensity: 3.2 })
  ] });
}
function CameraController({
  playerRef,
  controlsRefExternal,
  shakeActive = false,
  shakeAmplitude = 0.12,
  shakeFrequencyX = 18,
  shakeFrequencyY = 15,
  shakeYMultiplier = 0.9,
  enabled = true,
  followBehind = false
}) {
  const { camera } = useThree();
  const controlsRef = reactExports.useRef();
  const followOffset = reactExports.useMemo(() => new Vector3(0, 2.4, -5.2), []);
  const targetOffset = reactExports.useMemo(() => new Vector3(0, 1.6, 0), []);
  reactExports.useEffect(() => {
    if (controlsRefExternal) {
      controlsRefExternal.current = controlsRef.current;
    }
  }, [controlsRefExternal]);
  reactExports.useEffect(() => {
    if (!playerRef.current) return;
    const yaw = playerRef.current.rotation.y;
    const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
    const rotatedOffset = followOffset.clone().applyQuaternion(q);
    const base = playerRef.current.position;
    const target = base.clone().add(targetOffset);
    camera.position.copy(base).add(rotatedOffset);
    camera.lookAt(target);
  }, [camera, playerRef, followOffset, targetOffset]);
  useFrame((state) => {
    if (!playerRef.current || !controlsRef.current) return;
    if (!enabled) return;
    const target = playerRef.current.position.clone().add(targetOffset);
    if (followBehind) {
      const yaw = playerRef.current.rotation.y;
      const q = new Quaternion().setFromEuler(new Euler(0, yaw, 0));
      const desired = playerRef.current.position.clone().add(followOffset.clone().applyQuaternion(q));
      const k = 0.12;
      camera.position.lerp(desired, k);
      camera.lookAt(target);
    }
    if (shakeActive) {
      const t = state.clock.getElapsedTime();
      const amp = shakeAmplitude;
      target.x += Math.sin(t * shakeFrequencyX) * amp;
      target.y += Math.cos(t * shakeFrequencyY) * amp * shakeYMultiplier;
    }
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    OrbitControls,
    {
      ref: controlsRef,
      enabled,
      enablePan: false,
      enableDamping: true,
      dampingFactor: 0.12,
      rotateSpeed: 0.8,
      minDistance: 2.2,
      maxDistance: 8,
      minPolarAngle: Math.PI * 0.2,
      maxPolarAngle: Math.PI * 0.49
    }
  );
}
const TransitionMaterial = shaderMaterial(
  {
    uFrom: new Color(),
    uTo: new Color(),
    uProgress: 0,
    uOpacity: 1
  },
  // Vertex shader: pass the UV coordinates to the fragment shader and
  // position the plane in clip space.  We scale by 2 because the plane
  // geometry uses UV range [0,1], while clip space expects [-1,1].
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  // Fragment shader: smoothly interpolate between two colours as
  // uProgress goes from 0 to 1.  Use smoothstep to ease the transition.
  `
    uniform vec3 uFrom;
    uniform vec3 uTo;
    uniform float uProgress;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      float t = smoothstep(0.0, 1.0, uProgress);
      vec3 color = mix(uFrom, uTo, t);
      gl_FragColor = vec4(color, t * uOpacity);
    }
  `
);
extend({ TransitionMaterial });
function TransitionOverlay({ active, fromColor, toColor, duration = 1, onComplete, forceOnceKey, maxOpacity = 1 }) {
  const materialRef = reactExports.useRef();
  const tweenRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    let t = null;
    try {
      const dummy = { v: 0 };
      t = gsapWithCSS.fromTo(dummy, { v: 0 }, { v: 1, duration: 0.01 });
    } catch {
    }
    return () => {
      if (t) t.kill();
    };
  }, []);
  reactExports.useEffect(() => {
    if (!materialRef.current) return;
    if (tweenRef.current) {
      tweenRef.current.kill();
      tweenRef.current = null;
    }
    if (!active) {
      materialRef.current.uniforms.uProgress.value = 0;
      return;
    }
    materialRef.current.uniforms.uFrom.value = new Color(fromColor);
    materialRef.current.uniforms.uTo.value = new Color(toColor);
    materialRef.current.uniforms.uOpacity.value = maxOpacity;
    tweenRef.current = gsapWithCSS.fromTo(
      materialRef.current.uniforms.uProgress,
      { value: 0 },
      {
        value: 1,
        duration,
        ease: "power2.inOut",
        onComplete: () => {
          if (materialRef.current) materialRef.current.uniforms.uProgress.value = 0;
          if (typeof onComplete === "function") onComplete();
        }
      }
    );
  }, [active, fromColor, toColor, duration, onComplete, maxOpacity]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { renderOrder: 1e3, frustumCulled: false, position: [0, 0, 0], children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("planeGeometry", { args: [2, 2] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("transitionMaterial", { ref: materialRef, transparent: true })
  ] }, forceOnceKey);
}
function CharacterModel({ modelRef, glowVersion = 0 }) {
  const { scene, animations } = useGLTF(
    `${"/development/"}character.glb`,
    true,
    true,
    (loader) => {
      try {
        const ktx2 = new KTX2Loader();
        ktx2.setTranscoderPath("https://unpkg.com/three@0.179.1/examples/jsm/libs/basis/");
        if (loader.setKTX2Loader) loader.setKTX2Loader(ktx2);
      } catch {
      }
    }
  );
  const cloned = reactExports.useMemo(() => clone(scene), [scene]);
  reactExports.useEffect(() => {
    if (!cloned) return;
    try {
      cloned.traverse((obj) => {
        if (obj && obj.isMesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => {
              const mm = m?.isMaterial ? m.clone() : m;
              if (mm && mm.isMaterial) {
                mm.transparent = false;
                mm.opacity = 1;
                mm.depthWrite = true;
                mm.userData = { ...mm.userData || {}, __portraitMaterial: true };
              }
              return mm;
            });
          } else if (obj.material.isMaterial) {
            const mm = obj.material.clone();
            mm.transparent = false;
            mm.opacity = 1;
            mm.depthWrite = true;
            mm.userData = { ...mm.userData || {}, __portraitMaterial: true };
            obj.material = mm;
          }
        }
      });
    } catch {
    }
  }, [cloned]);
  const { actions } = useAnimations(animations, cloned);
  const matUniformsRef = reactExports.useRef(/* @__PURE__ */ new Map());
  const materialsRef = reactExports.useRef(/* @__PURE__ */ new Set());
  const emissiveBaseRef = reactExports.useRef(/* @__PURE__ */ new Map());
  const glowColorRef = reactExports.useRef(new Color("#ffd480"));
  const glowAmountRef = reactExports.useRef(0);
  const prevGlowVRef = reactExports.useRef(glowVersion);
  const idleName = reactExports.useMemo(() => {
    const names = actions ? Object.keys(actions) : [];
    const explicitIdle = "root|root|Iddle";
    if (names.includes(explicitIdle)) return explicitIdle;
    return names.find((n) => n.toLowerCase().includes("idle")) || names[0];
  }, [actions]);
  reactExports.useEffect(() => {
    if (!actions || !idleName) return;
    Object.values(actions).forEach((a) => a.stop());
    const idle = actions[idleName];
    if (idle) idle.reset().fadeIn(0.1).play();
  }, [actions, idleName]);
  reactExports.useEffect(() => {
    if (!cloned) return;
    matUniformsRef.current.clear();
    materialsRef.current.clear();
    try {
      cloned.traverse((obj) => {
        if (!obj || !obj.isMesh || !obj.material) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mm) => {
          if (!mm || !mm.isMaterial) return;
          materialsRef.current.add(mm);
          try {
            if (mm.emissive) {
              emissiveBaseRef.current.set(mm, { color: mm.emissive.clone(), intensity: typeof mm.emissiveIntensity === "number" ? mm.emissiveIntensity : 1 });
            }
          } catch {
          }
          const original = mm.onBeforeCompile;
          mm.onBeforeCompile = (shader) => {
            try {
              shader.uniforms.uGlow = { value: 0 };
              shader.uniforms.uGlowColor = { value: new Color("#ffe9b0") };
              const target = "gl_FragColor = vec4( outgoingLight, diffuseColor.a );";
              const repl = `
                vec3 _outGlow = outgoingLight + uGlowColor * (uGlow * 3.0);
                gl_FragColor = vec4(_outGlow, diffuseColor.a );
              `;
              if (shader.fragmentShader.includes(target)) {
                shader.fragmentShader = shader.fragmentShader.replace(target, repl);
              }
              matUniformsRef.current.set(mm, shader.uniforms);
            } catch {
            }
            if (typeof original === "function") try {
              original(shader);
            } catch {
            }
          };
          mm.needsUpdate = true;
        });
      });
    } catch {
    }
  }, [cloned]);
  reactExports.useEffect(() => {
    if (glowVersion !== prevGlowVRef.current) {
      prevGlowVRef.current = glowVersion;
      glowAmountRef.current = 1;
    }
  }, [glowVersion]);
  useFrame((_, delta) => {
    const val = 1;
    matUniformsRef.current.forEach((u) => {
      if (u && u.uGlow) u.uGlow.value = val;
    });
    materialsRef.current.forEach((mm) => {
      try {
        const base = emissiveBaseRef.current.get(mm);
        if (!base || !mm.emissive) return;
        mm.emissive.copy(glowColorRef.current);
        mm.emissiveIntensity = Math.max(0, (base.intensity || 1) + 8 * val);
      } catch {
      }
    });
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("group", { position: [0, -1.45, 0], children: /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { ref: modelRef, object: cloned, scale: 1.65 }) });
}
function CameraAim({ modelRef, getPortraitCenter, getPortraitRect }) {
  const { camera } = useThree();
  const headObjRef = reactExports.useRef(null);
  const tmp = reactExports.useRef({ target: new Vector3(), size: new Vector3(), box: new Box3() });
  const mouseRef = reactExports.useRef({ x: 0, y: 0 });
  const headScreenRef = reactExports.useRef(new Vector3());
  const yawBiasRef = reactExports.useRef(0);
  const pitchBiasRef = reactExports.useRef(0);
  const baseRotRef = reactExports.useRef({ x: null, y: null });
  const rayRef = reactExports.useRef(new Raycaster());
  const planeRef = reactExports.useRef(new Plane());
  const pWorldRef = reactExports.useRef(new Vector3());
  const camDirRef = reactExports.useRef(new Vector3());
  const invParentRef = reactExports.useRef(new Matrix4());
  const localHeadRef = reactExports.useRef(new Vector3());
  const localHitRef = reactExports.useRef(new Vector3());
  const lastInputTsRef = reactExports.useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const recenterNowRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    if (!modelRef.current) return;
    let found = null;
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o;
    });
    headObjRef.current = found;
    const onMove = (e) => {
      mouseRef.current = { x: e.clientX || 0, y: e.clientY || 0 };
      lastInputTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    };
    const onTouch = (e) => {
      try {
        const t = e.touches?.[0];
        if (t) {
          mouseRef.current = { x: t.clientX, y: t.clientY };
          lastInputTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
        }
      } catch {
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    const rebaseTimer = setTimeout(() => {
      try {
        if (headObjRef.current) baseRotRef.current = { x: headObjRef.current.rotation.x, y: headObjRef.current.rotation.y };
      } catch {
      }
    }, 300);
    const onInput = () => {
      lastInputTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    };
    window.addEventListener("pointerdown", onInput, { passive: true });
    window.addEventListener("touchstart", onInput, { passive: true });
    const onExit = () => {
      recenterNowRef.current = true;
      yawBiasRef.current = 0;
      pitchBiasRef.current = 0;
      lastInputTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    };
    const onRecenter = () => {
      recenterNowRef.current = true;
      lastInputTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    };
    window.addEventListener("exit-section", onExit);
    window.addEventListener("portrait-recenter", onRecenter);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("pointerdown", onInput);
      window.removeEventListener("touchstart", onInput);
      window.removeEventListener("exit-section", onExit);
      window.removeEventListener("portrait-recenter", onRecenter);
      clearTimeout(rebaseTimer);
    };
  }, [modelRef]);
  useFrame(() => {
    if (!modelRef.current) return;
    const { target, size, box } = tmp.current;
    if (headObjRef.current) {
      try {
        const head = headObjRef.current;
        const headPos = new Vector3();
        head.getWorldPosition(headPos);
        const viewportW = typeof window !== "undefined" ? window.innerWidth : 1920;
        const viewportH = typeof window !== "undefined" ? window.innerHeight : 1080;
        const nx = mouseRef.current.x / viewportW * 2 - 1;
        const ny = 1 - mouseRef.current.y / viewportH * 2;
        camDirRef.current.set(0, 0, -1);
        camera.getWorldDirection(camDirRef.current);
        const headForward = new Vector3(0, 0, -1).applyQuaternion(head.getWorldQuaternion(new Quaternion()));
        const mixedNormal = headForward.clone().lerp(camDirRef.current.clone().negate(), 0.35).normalize();
        planeRef.current.setFromNormalAndCoplanarPoint(mixedNormal, headPos);
        rayRef.current.setFromCamera({ x: nx, y: ny }, camera);
        const hit = rayRef.current.ray.intersectPlane(planeRef.current, pWorldRef.current);
        const parent = head.parent || modelRef.current;
        invParentRef.current.copy(parent.matrixWorld).invert();
        localHeadRef.current.copy(headPos).applyMatrix4(invParentRef.current);
        if (hit) localHitRef.current.copy(hit).applyMatrix4(invParentRef.current);
        else localHitRef.current.copy(localHeadRef.current).add(new Vector3(0, 0, -1));
        const dir = localHitRef.current.clone().sub(localHeadRef.current);
        const yawRaw = Math.atan2(dir.x, -dir.z);
        const pitchRaw = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
        headScreenRef.current.copy(headPos).project(camera);
        const dxScr = nx - headScreenRef.current.x;
        const dyScr = ny - headScreenRef.current.y;
        const ax = Math.tanh(dxScr * 1);
        const ay = Math.tanh(dyScr * 1);
        const maxYaw = 0.75;
        const maxPitch = 0.6;
        const yawScale = 1 - 0.45 * Math.pow(Math.min(1, Math.abs(ay)), 1.15);
        const pitchScale = 1 - 0.2 * Math.pow(Math.min(1, Math.abs(ax)), 1.1);
        let yawTarget = MathUtils.clamp(yawRaw * 0.85 * yawScale + yawBiasRef.current, -maxYaw, maxYaw);
        let pitchTarget = MathUtils.clamp(pitchRaw * 0.7 * pitchScale + pitchBiasRef.current, -maxPitch, maxPitch);
        if (baseRotRef.current.x === null || baseRotRef.current.y === null) {
          baseRotRef.current = { x: head.rotation.x, y: head.rotation.y };
        }
        let proximity = 0;
        let insideRect = false;
        let heroProx = 0;
        try {
          if (typeof getPortraitCenter === "function") {
            const c = getPortraitCenter();
            if (c && typeof c.x === "number" && typeof c.y === "number") {
              const vw = typeof window !== "undefined" ? window.innerWidth : 1920;
              const vh = typeof window !== "undefined" ? window.innerHeight : 1080;
              const dxP = mouseRef.current.x - c.x;
              const dyP = mouseRef.current.y - c.y;
              const dist = Math.hypot(dxP, dyP);
              const radius = Math.min(vw, vh) * 0.3;
              proximity = Math.max(0, Math.min(1, 1 - dist / Math.max(60, radius)));
              const heroX = vw * 0.5;
              const heroY = vh * 0.62;
              const dxH = (mouseRef.current.x - heroX) / (vw * 0.22);
              const dyH = (mouseRef.current.y - heroY) / (vh * 0.28);
              const dH = Math.sqrt(dxH * dxH + dyH * dyH);
              heroProx = Math.max(0, Math.min(1, 1 - dH));
            }
          }
          if (typeof getPortraitRect === "function") {
            const r = getPortraitRect();
            if (r) {
              const m = 18;
              const x = mouseRef.current.x;
              const y = mouseRef.current.y;
              insideRect = x >= r.left - m && x <= r.right + m && y >= r.top - m && y <= r.bottom + m;
            }
          }
        } catch {
        }
        const proxCombined = Math.max(proximity, heroProx);
        const ampScale = 1 - 0.65 * proxCombined;
        yawTarget *= ampScale;
        pitchTarget *= ampScale;
        let inner = Math.max(0, Math.min(1, (proxCombined - 0.6) / 0.4));
        if (insideRect) inner = 1;
        const innerEase = inner * inner * (3 - 2 * inner);
        yawTarget *= 1 - innerEase;
        pitchTarget *= 1 - innerEase;
        if (recenterNowRef.current) {
          const k = recenterNowRef.current ? 0.35 : 0.22;
          const ty = baseRotRef.current.y != null ? baseRotRef.current.y : head.rotation.y;
          const tx = baseRotRef.current.x != null ? baseRotRef.current.x : head.rotation.x;
          head.rotation.y += (ty - head.rotation.y) * k;
          head.rotation.x += (tx - head.rotation.x) * k;
          if (recenterNowRef.current && Math.abs(head.rotation.y - ty) < 1e-3 && Math.abs(head.rotation.x - tx) < 1e-3) recenterNowRef.current = false;
        } else {
          const lerp = Math.max(0.045, 0.15 * (1 - 0.6 * proxCombined) * (1 - 0.6 * innerEase));
          const targetYaw = (baseRotRef.current.y != null ? baseRotRef.current.y : head.rotation.y) + yawTarget;
          const targetPitch = (baseRotRef.current.x != null ? baseRotRef.current.x : head.rotation.x) + -pitchTarget;
          head.rotation.y += (targetYaw - head.rotation.y) * lerp;
          head.rotation.x += (targetPitch - head.rotation.x) * lerp;
        }
        target.copy(headPos);
      } catch {
        headObjRef.current.getWorldPosition(target);
      }
    } else {
      box.setFromObject(modelRef.current);
      box.getCenter(target);
      box.getSize(size);
      target.y = box.max.y - size.y * 0.1;
    }
  });
  return null;
}
function SyncOrthoCamera({ y, zoom }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!camera) return;
    camera.position.set(0, y, 10);
    camera.rotation.set(0, 0, 0);
    if (typeof camera.zoom === "number") camera.zoom = zoom;
    camera.updateProjectionMatrix();
  });
  return null;
}
function PinBackLight({ modelRef, intensity, angle, penumbra, posY, posZ, color }) {
  const lightRef = reactExports.useRef(null);
  const targetRef = reactExports.useRef(null);
  const headObjRef = reactExports.useRef(null);
  const tmp = reactExports.useRef({ target: new Vector3(), size: new Vector3(), box: new Box3() });
  reactExports.useEffect(() => {
    if (!modelRef.current) return;
    let found = null;
    modelRef.current.traverse((o) => {
      if (!found && o.name && /head/i.test(o.name)) found = o;
    });
    headObjRef.current = found;
  }, [modelRef]);
  useFrame(() => {
    if (!lightRef.current || !targetRef.current || !modelRef.current) return;
    const { target, size, box } = tmp.current;
    if (headObjRef.current) {
      headObjRef.current.getWorldPosition(target);
    } else {
      box.setFromObject(modelRef.current);
      box.getCenter(target);
      box.getSize(size);
      target.y = box.max.y - size.y * 0.1;
    }
    targetRef.current.position.copy(target);
    lightRef.current.target = targetRef.current;
    lightRef.current.target.updateMatrixWorld();
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "spotLight",
      {
        ref: lightRef,
        position: [0, posY, posZ],
        angle,
        penumbra,
        intensity,
        color
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("object3D", { ref: targetRef })
  ] });
}
function HeadNudge({ modelRef, version }) {
  React.useRef({});
  React.useEffect(() => {
    if (!modelRef.current) return;
    let head = null;
    modelRef.current.traverse((o) => {
      if (!head && o.name && /head/i.test(o.name)) head = o;
    });
    if (!head) return;
    const baseX = head.rotation.x;
    const baseY = head.rotation.y;
    const baseZ = head.rotation.z;
    const kickX = Math.random() * 0.7 - 0.35;
    const kickY = Math.random() * 1.4 - 0.7;
    const kickZ = Math.random() * 0.7 - 0.35;
    let vx = 0, vy = 0, vz = 0;
    let x = head.rotation.x + kickX;
    let y = head.rotation.y + kickY;
    let z = head.rotation.z + kickZ;
    const stiffness = 28;
    const damping = 1.8;
    let last = typeof performance !== "undefined" ? performance.now() : Date.now();
    let anim = true;
    const loop = () => {
      if (!anim) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const dt2 = Math.min(0.05, (now - last) / 1e3);
      last = now;
      vx += (-(x - baseX) * stiffness - vx * damping) * dt2;
      vy += (-(y - baseY) * stiffness - vy * damping) * dt2;
      vz += (-(z - baseZ) * stiffness - vz * damping) * dt2;
      x += vx * dt2;
      y += vy * dt2;
      z += vz * dt2;
      head.rotation.x = x;
      head.rotation.y = y;
      head.rotation.z = z;
      if (Math.abs(x - baseX) + Math.abs(y - baseY) + Math.abs(z - baseZ) < 4e-3 && Math.abs(vx) + Math.abs(vy) + Math.abs(vz) < 6e-3) {
        anim = false;
        head.rotation.x = baseX;
        head.rotation.y = baseY;
        head.rotation.z = baseZ;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [modelRef, version]);
  return null;
}
function CharacterPortrait({
  dotEnabled = true,
  dotScale = 1,
  dotAngle = Math.PI / 4,
  dotCenterX = 0.38,
  dotCenterY = 0.44,
  dotOpacity = 0.04,
  dotBlend = "screen",
  showUI = true,
  onEggActiveChange,
  glowVersion = 0,
  zIndex = 600,
  showExit = false
}) {
  const modelRef = reactExports.useRef();
  const containerRef = reactExports.useRef(null);
  const portraitRef = reactExports.useRef(null);
  const CAM_Y_MAX = 0.8;
  const CAM_Y_MIN = -1;
  const ZOOM_MAX = 160;
  const ZOOM_MIN = 15;
  const clickShakeUntilRef = reactExports.useRef(0);
  const isLowPerf = React.useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer:coarse)").matches;
    const saveData = navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType));
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2;
    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR);
  }, []);
  const [lightIntensity, setLightIntensity] = reactExports.useState(20);
  const [lightAngle, setLightAngle] = reactExports.useState(1);
  const [lightPenumbra, setLightPenumbra] = reactExports.useState(0.28);
  const [lightPosY, setLightPosY] = reactExports.useState(2.7);
  const [lightPosZ, setLightPosZ] = reactExports.useState(-0.2);
  const [lightColor, setLightColor] = reactExports.useState("#ffffff");
  const [copied, setCopied] = reactExports.useState(false);
  const [cursorVisible, setCursorVisible] = reactExports.useState(false);
  const [cursorPos, setCursorPos] = reactExports.useState({ x: 0, y: 0 });
  const [cursorScale, setCursorScale] = reactExports.useState(1);
  const [camY, setCamY] = reactExports.useState(CAM_Y_MAX);
  const [camZoom, setCamZoom] = reactExports.useState(ZOOM_MAX);
  const draggingRef = reactExports.useRef(false);
  const dragStartRef = reactExports.useRef({ y: 0, camY: CAM_Y_MAX });
  const [headNudgeV, setHeadNudgeV] = reactExports.useState(0);
  const clickAudioPoolRef = reactExports.useRef([]);
  const clickAudioIdxRef = reactExports.useRef(0);
  const audioCtxRef = reactExports.useRef(null);
  const audioBufferRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const POOL_SIZE = 8;
    const pool = new Array(POOL_SIZE).fill(null).map(() => {
      const a = new Audio(`${"/development/"}punch.mp3`);
      a.preload = "auto";
      a.volume = 0.5;
      try {
        a.load();
      } catch {
      }
      return a;
    });
    clickAudioPoolRef.current = pool;
    return () => {
      clickAudioPoolRef.current = [];
    };
  }, []);
  reactExports.useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${"/development/"}punch.mp3`, { cache: "force-cache" });
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        if (!cancelled) audioBufferRef.current = buf;
      } catch {
      }
    })();
    return () => {
      cancelled = true;
      try {
        ctx.close();
      } catch {
      }
    };
  }, []);
  const eggPhrases = reactExports.useMemo(
    () => [
      "Even after life, you poke my very soul to make your logo bigger? Let me rest…",
      "Yeah, a graphic designer's job is also to entertain you, right?",
      "Fuck off, I'm tired of you…",
      "Did you know that this is considered bullying, right?",
      "Everything OK at home?",
      "So this is what it feels like not being registered in social security?",
      "“Let me rest… go away, dude!”",
      "If you keep poking my soul, I will not make your logo bigger.",
      "I'm sending you an invoice for this, OK?",
      "I will report you for using pirate software.",
      "¡Deja de chingar! …That's what my uncle says when he's mad."
    ],
    []
  );
  const [eggActive, setEggActive] = reactExports.useState(false);
  const [eggPhrase, setEggPhrase] = reactExports.useState("");
  const eggTimerRef = reactExports.useRef(null);
  const eggStyleTimerRef = reactExports.useRef(null);
  const clickCountRef = reactExports.useRef(0);
  const lastClickTsRef = reactExports.useRef(0);
  const eggActiveRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    eggActiveRef.current = eggActive;
  }, [eggActive]);
  async function handlePortraitClick() {
    const nowTs = typeof performance !== "undefined" ? performance.now() : Date.now();
    clickShakeUntilRef.current = nowTs + 480;
    setCursorScale(1.9);
    window.setTimeout(() => setCursorScale(0.96), 110);
    window.setTimeout(() => setCursorScale(1.08), 200);
    window.setTimeout(() => setCursorScale(1), 280);
    let played = false;
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer) {
      try {
        if (ctx.state !== "running") await ctx.resume();
      } catch {
      }
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.9;
        src.connect(gain).connect(ctx.destination);
        src.start(0);
        played = true;
      } catch {
      }
    }
    if (!played) {
      const pool = clickAudioPoolRef.current;
      if (pool && pool.length) {
        const i = clickAudioIdxRef.current % pool.length;
        clickAudioIdxRef.current += 1;
        const a = pool[i];
        try {
          a.currentTime = 0;
        } catch {
        }
        try {
          a.play();
        } catch {
        }
      }
    }
    setHeadNudgeV((v) => v + 1);
    try {
      window.dispatchEvent(new CustomEvent("portrait-recenter"));
    } catch {
    }
    const now = Date.now();
    const delta = now - lastClickTsRef.current;
    if (delta > 600) {
      clickCountRef.current = 0;
    }
    lastClickTsRef.current = now;
    clickCountRef.current += 1;
    if (clickCountRef.current > 3 && !eggActive) {
      const phrase = eggPhrases[Math.floor(Math.random() * eggPhrases.length)];
      setEggPhrase(phrase);
      setEggActive(true);
      if (typeof onEggActiveChange === "function") onEggActiveChange(true);
      setBubbleText(phrase);
      setShowBubble(true);
      setBubbleTheme("egg");
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      requestAnimationFrame(() => {
        const contEl = containerRef.current;
        const bubbleEl = bubbleRef.current;
        if (contEl && bubbleEl) {
          const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
          const c = contEl.getBoundingClientRect();
          const b = bubbleEl.getBoundingClientRect();
          const marginRight = -18;
          const marginTop = -18;
          let rightTop = clamp(c.top + c.height * 0.25 - b.height * 0.3, 8, window.innerHeight - b.height - 8);
          let rightLeft = c.right + marginRight;
          const fitsRight = rightLeft + b.width <= window.innerWidth - 8;
          let topTop = c.top - b.height - marginTop;
          let topLeft = clamp(c.left + c.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8);
          const fitsTop = topTop >= 8;
          let placedTop = 0;
          let placedLeft = 0;
          if (fitsRight) {
            setBubbleSide("right");
            placedTop = rightTop;
            placedLeft = rightLeft;
          } else if (fitsTop) {
            setBubbleSide("top");
            placedTop = topTop;
            placedLeft = topLeft;
          } else {
            setBubbleSide("right");
            rightLeft = clamp(rightLeft, 8, window.innerWidth - b.width - 8);
            placedTop = rightTop;
            placedLeft = rightLeft;
          }
          try {
            const JOY_RADIUS = 52;
            const JOY_BOTTOM = 40;
            const pad = 16;
            const joyCenterX = window.innerWidth / 2;
            const joyCenterY = window.innerHeight - (JOY_BOTTOM + JOY_RADIUS);
            const joyRect = {
              left: joyCenterX - JOY_RADIUS - pad,
              right: joyCenterX + JOY_RADIUS + pad,
              top: joyCenterY - JOY_RADIUS - pad,
              bottom: joyCenterY + JOY_RADIUS + pad
            };
            const bubbleRect = { left: placedLeft, top: placedTop, right: placedLeft + b.width, bottom: placedTop + b.height };
            const intersects = !(bubbleRect.right < joyRect.left || bubbleRect.left > joyRect.right || bubbleRect.bottom < joyRect.top || bubbleRect.top > joyRect.bottom);
            if (intersects) {
              if (fitsTop) {
                setBubbleSide("top");
                placedTop = topTop;
                placedLeft = topLeft;
              } else {
                placedTop = Math.max(8, joyRect.top - b.height - 8);
                placedLeft = clamp(placedLeft, 8, window.innerWidth - b.width - 8);
              }
            }
          } catch {
          }
          setBubblePos({ top: placedTop, left: placedLeft });
          const bCenterX = placedLeft + b.width / 2;
          const bCenterY = placedTop + b.height / 2;
          const targetX = c.left + c.width * 0.1;
          const targetY = c.top + c.height * 0.35;
          const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX);
          const padEdge = 10;
          const rx = Math.max(8, b.width / 2 - padEdge);
          const ry = Math.max(8, b.height / 2 - padEdge);
          const axLocal = b.width / 2 + Math.cos(ang) * rx;
          const ayLocal = b.height / 2 + Math.sin(ang) * ry;
          const pushOut = 12;
          const cx = axLocal + Math.cos(ang) * pushOut;
          const cy = ayLocal + Math.sin(ang) * pushOut;
          setTail({ x: axLocal, y: ayLocal, cx, cy, angleDeg: ang * 180 / Math.PI });
        }
      });
      const EGG_MS = 7e3;
      if (eggStyleTimerRef.current) window.clearTimeout(eggStyleTimerRef.current);
      eggStyleTimerRef.current = window.setTimeout(() => {
        setBubbleTheme("normal");
      }, EGG_MS);
      clickCountRef.current = 0;
      if (eggTimerRef.current) window.clearTimeout(eggTimerRef.current);
      eggTimerRef.current = window.setTimeout(() => {
        setShowBubble(false);
        setEggActive(false);
        setEggPhrase("");
        setBubbleTheme("normal");
        if (typeof onEggActiveChange === "function") onEggActiveChange(false);
        const delayBack = 800;
        window.setTimeout(() => {
          if (!eggActiveRef.current) scheduleNextRef.current();
        }, delayBack);
      }, EGG_MS);
    }
  }
  function handleMouseEnter() {
    setCursorVisible(true);
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "running") {
      ctx.resume().catch(() => {
      });
    }
  }
  function handleMouseLeave() {
    setCursorVisible(false);
    draggingRef.current = false;
  }
  function handleMouseMove(e) {
    const el = portraitRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCursorPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    if (draggingRef.current) {
      const dy = e.clientY - dragStartRef.current.y;
      const next = dragStartRef.current.camY - dy * 0.01;
      setCamY(Math.max(CAM_Y_MIN, Math.min(CAM_Y_MAX, next)));
    }
  }
  function handleMouseDown(e) {
    draggingRef.current = true;
    dragStartRef.current = { y: e.clientY, camY };
  }
  function handleMouseUp() {
    draggingRef.current = false;
  }
  function handleWheel(e) {
    const next = camZoom - e.deltaY * 0.06;
    setCamZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next)));
  }
  const phrases = reactExports.useMemo(
    () => [
      // Frase larga adicional
      `Yeah, well, AI killed graphic designers and here i am, fucking entertaining you...`,
      // Primer bloque de 30
      `I didn’t starve, I was just doing intermittent fasting… forever.`,
      `Turns out my portfolio wasn’t compatible with ChatGPT.`,
      `I asked MidJourney for food, it gave me a moodboard.`,
      `AI ate my job, so I ate… nothing.`,
      `They said design feeds the soul. Pity it doesn’t feed the stomach.`,
      `At least my hunger pangs come in a nice minimalist grid.`,
      `I died in Helvetica Bold, not Comic Sans.`,
      `Clients still ghosted me… now permanently.`,
      `AI doesn’t sleep, but apparently I don’t eat.`,
      `At my funeral, please kerning the flowers properly.`,
      `I asked DALL·E for bread… it gave me a surrealist painting of toast.`,
      `Even my gravestone has better alignment than my old invoices.`,
      `AI doesn’t get paid, but neither did I.`,
      `Starving for art was supposed to be metaphorical.`,
      `At least my hunger made me pixel-perfect thin.`,
      `My last meal was RGB soup with a side of CMYK crumbs.`,
      `No one wanted to pay for logos, but hey, I died branded.`,
      `AI makes logos in 5 seconds. I made one in 5 days… then died.`,
      `My obituary will be in Arial, because I wasn’t worth a typeface license.`,
      `I thought I was irreplaceable. AI thought otherwise.`,
      `Hungry, but at least my color palette was vibrant.`,
      `They asked for unlimited revisions. I gave them unlimited silence.`,
      `I went from freelancing to free starving.`,
      `AI doesn’t complain about exposure. I just died from it.`,
      `Design used to keep me alive. Now it’s just keeping my Behance alive.`,
      `I tried to barter my Photoshop skills for tacos. Didn’t work.`,
      `The only thing left aligned in my life was my coffin.`,
      `I asked for a client brief. Life gave me a death brief.`,
      `AI makes mistakes too… but at least it doesn’t need lunch.`,
      `I’m not gone, I’m just on the ultimate creative break.`,
      // Segundo bloque de 30
      `I used to design posters. Now I’m the poster child of unemployment.`,
      `My diet? Strictly vector-based.`,
      `Clients said: ‘Can you make it pop?’ — my stomach did.`,
      `I always wanted to be timeless. Death helped.`,
      `I finally reached negative space: my fridge.`,
      `I exported myself… as a ghost.`,
      `They paid me in exposure. Turns out exposure kills.`,
      `At least AI can’t feel hunger… lucky bastard.`,
      `I designed my own tombstone. Minimalist. No budget.`,
      `I was 99% caffeine, 1% hope.`,
      `Starved, but hey—my resume is still responsive.`,
      `I left life on draft mode.`,
      `They said design is forever. Guess rent isn’t.`,
      `No more clients asking for ‘one last change’… finally.`,
      `My life was low budget, but high resolution.`,
      `I aligned everything… except my destiny.`,
      `AI took my clients. Hunger took my soul.`,
      `I’m trending now… in the obituary section.`,
      `I wanted to go viral. Ended up going vital… signs flat.`,
      `I kerning-ed myself into the grave.`,
      `The only thing scalable now is my skeleton.`,
      `I asked life for balance. It gave me imbalance and starvation.`,
      `They’ll miss me when AI starts using Comic Sans.`,
      `I worked for peanuts… wish I had actual peanuts.`,
      `Dead, but at least I’m vector — infinitely scalable.`,
      `They automated design. Can they automate tacos too?`,
      `Death was my final deadline.`,
      `AI makes perfect gradients. Mine was starvation to extinction.`,
      `I asked the universe for feedback. It replied: ‘Looks good, but you’re gone.’`,
      `I didn’t lose my job. I just Ctrl+Z’d out of existence.`
    ],
    []
  );
  const [showBubble, setShowBubble] = reactExports.useState(false);
  const [bubbleText, setBubbleText] = reactExports.useState("");
  const bubbleRef = reactExports.useRef(null);
  const [bubblePos, setBubblePos] = reactExports.useState({ top: -9999, left: -9999 });
  const [bubbleSide, setBubbleSide] = reactExports.useState("right");
  const [tail, setTail] = reactExports.useState({ x: 0, y: 0, cx: 0, cy: 0, angleDeg: 0 });
  const [posReady, setPosReady] = reactExports.useState(false);
  const [bubbleTheme, setBubbleTheme] = reactExports.useState("normal");
  const showTimerRef = reactExports.useRef(null);
  const hideTimerRef = reactExports.useRef(null);
  const scheduleNextRef = reactExports.useRef(() => {
  });
  reactExports.useEffect(() => {
    function clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    }
    function scheduleNext() {
      const delay = 4e3 + Math.random() * 5e3;
      showTimerRef.current = window.setTimeout(() => {
        if (eggActiveRef.current) {
          scheduleNext();
          return;
        }
        const next = phrases[Math.floor(Math.random() * phrases.length)];
        setBubbleText(next);
        setShowBubble(true);
        setPosReady(false);
        requestAnimationFrame(() => {
          const contEl = containerRef.current;
          const bubbleEl = bubbleRef.current;
          if (!contEl || !bubbleEl) return;
          const c = contEl.getBoundingClientRect();
          const b = bubbleEl.getBoundingClientRect();
          const marginRight = -18;
          const marginTop = -18;
          let rightTop = clamp(c.top + c.height * 0.25 - b.height * 0.3, 8, window.innerHeight - b.height - 8);
          let rightLeft = c.right + marginRight;
          const fitsRight = rightLeft + b.width <= window.innerWidth - 8;
          let topTop = c.top - b.height - marginTop;
          let topLeft = clamp(c.left + c.width / 2 - b.width / 2, 8, window.innerWidth - b.width - 8);
          const fitsTop = topTop >= 8;
          let placedTop = 0;
          let placedLeft = 0;
          if (fitsRight) {
            setBubbleSide("right");
            placedTop = rightTop;
            placedLeft = rightLeft;
          } else if (fitsTop) {
            setBubbleSide("top");
            placedTop = topTop;
            placedLeft = topLeft;
          } else {
            setBubbleSide("right");
            rightLeft = clamp(rightLeft, 8, window.innerWidth - b.width - 8);
            placedTop = rightTop;
            placedLeft = rightLeft;
          }
          try {
            const JOY_RADIUS = 52;
            const JOY_BOTTOM = 40;
            const pad = 16;
            const cx2 = window.innerWidth / 2;
            const cy2 = window.innerHeight - (JOY_BOTTOM + JOY_RADIUS);
            const joyRect = { left: cx2 - JOY_RADIUS - pad, right: cx2 + JOY_RADIUS + pad, top: cy2 - JOY_RADIUS - pad, bottom: cy2 + JOY_RADIUS + pad };
            const bubbleRect = { left: placedLeft, top: placedTop, right: placedLeft + b.width, bottom: placedTop + b.height };
            const intersects = !(bubbleRect.right < joyRect.left || bubbleRect.left > joyRect.right || bubbleRect.bottom < joyRect.top || bubbleRect.top > joyRect.bottom);
            if (intersects) {
              if (fitsTop) {
                setBubbleSide("top");
                placedTop = topTop;
                placedLeft = topLeft;
              } else {
                placedTop = Math.max(8, joyRect.top - b.height - 8);
                placedLeft = clamp(placedLeft, 8, window.innerWidth - b.width - 8);
              }
            }
          } catch {
          }
          setBubblePos({ top: placedTop, left: placedLeft });
          const bCenterX = placedLeft + b.width / 2;
          const bCenterY = placedTop + b.height / 2;
          const targetX = c.left + c.width * 0.1;
          const targetY = c.top + c.height * 0.35;
          const ang = Math.atan2(targetY - bCenterY, targetX - bCenterX);
          const padEdge = 10;
          const rx = Math.max(8, b.width / 2 - padEdge);
          const ry = Math.max(8, b.height / 2 - padEdge);
          const axLocal = b.width / 2 + Math.cos(ang) * rx;
          const ayLocal = b.height / 2 + Math.sin(ang) * ry;
          const pushOut = 12;
          const cx = axLocal + Math.cos(ang) * pushOut;
          const cy = ayLocal + Math.sin(ang) * pushOut;
          setTail({ x: axLocal, y: ayLocal, cx, cy, angleDeg: ang * 180 / Math.PI });
          setPosReady(true);
        });
        const visibleFor = 6500 + Math.random() * 3e3;
        hideTimerRef.current = window.setTimeout(() => {
          setShowBubble(false);
          setBubbleTheme("normal");
          scheduleNext();
        }, visibleFor);
      }, delay);
    }
    scheduleNextRef.current = scheduleNext;
    scheduleNext();
    return () => {
      if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      scheduleNextRef.current = () => {
      };
    };
  }, [phrases]);
  const handleCopy = async () => {
    const snippet = `{
  "intensity": ${lightIntensity},
  "angle": ${lightAngle},
  "penumbra": ${lightPenumbra},
  "posY": ${lightPosY},
  "posZ": ${lightPosZ},
  "color": "${lightColor}"
}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
      } else {
        const ta = document.createElement("textarea");
        ta.value = snippet;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      console.warn("No se pudo copiar al portapapeles", e);
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: containerRef, className: "fixed left-4 bottom-4 sm:left-10 sm:bottom-10 flex gap-3 items-end", style: { zIndex }, children: [
    showBubble && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: bubbleRef,
        className: `pointer-events-none fixed z-50 max-w-56 px-3 py-2.5 rounded-[18px] border-[3px] text-[15px] leading-snug shadow-[6px_6px_0_#000] rotate-[-1.5deg] ${bubbleTheme === "egg" ? "bg-black border-black text-white" : "bg-white border-black text-black"}`,
        style: { top: bubblePos.top, left: bubblePos.left },
        children: [
          bubbleTheme === "normal" && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: "pointer-events-none absolute inset-0 opacity-10 mix-blend-multiply rounded-[16px]",
              style: {
                backgroundImage: "radial-gradient(currentColor 1px, transparent 1px), radial-gradient(currentColor 1px, transparent 1px)",
                backgroundSize: "10px 10px, 10px 10px",
                backgroundPosition: "0 0, 5px 5px",
                color: "#111"
              }
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 rounded-[16px] border border-black/20 pointer-events-none" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: bubbleTheme === "egg" ? "text-white" : "text-black", style: { fontSize: "16px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(TypingText, { text: bubbleText }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-[9rem] h-[13rem] sm:w-[12rem] sm:h-[18rem]", children: [
      typeof window !== "undefined" && showExit && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          },
          onClick: (e) => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            e.stopPropagation();
            try {
              window.dispatchEvent(new CustomEvent("exit-section"));
            } catch {
            }
          },
          className: "absolute -top-[56px] left-1/2 -translate-x-1/2 h-11 w-11 rounded-full bg-white text-black grid place-items-center shadow-md z-[5]",
          "aria-label": "Cerrar sección",
          title: "Cerrar sección",
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef, { className: "w-6 h-6" })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          ref: portraitRef,
          className: `pointer-events-auto cursor-pointer absolute inset-0 rounded-full overflow-hidden border-[5px] border-white shadow-lg transform-gpu will-change-transform transition-transform duration-200 ease-out hover:scale-105 ${eggActive ? "bg-red-600" : "bg-[#06061D]"}`,
          onClick: handlePortraitClick,
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
          onMouseMove: handleMouseMove,
          onMouseDown: handleMouseDown,
          onMouseUp: handleMouseUp,
          onWheel: handleWheel,
          "aria-label": "Retrato personaje",
          title: "",
          style: { cursor: "none" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Canvas,
              {
                dpr: [1, isLowPerf ? 1.2 : 1.5],
                orthographic: true,
                camera: { position: [0, camY, 10], zoom: camZoom, near: -100, far: 100 },
                gl: { antialias: false, powerPreference: "high-performance", alpha: true, stencil: false },
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(SyncOrthoCamera, { y: camY, zoom: camZoom }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("ambientLight", { intensity: 0.8 }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("directionalLight", { intensity: 0.7, position: [2, 3, 3] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(CharacterModel, { modelRef, glowVersion }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    CameraAim,
                    {
                      modelRef,
                      getPortraitCenter: () => {
                        try {
                          const el = portraitRef.current;
                          if (!el) return null;
                          const r = el.getBoundingClientRect();
                          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                        } catch {
                          return null;
                        }
                      },
                      getPortraitRect: () => {
                        try {
                          const el = portraitRef.current;
                          if (!el) return null;
                          return el.getBoundingClientRect();
                        } catch {
                          return null;
                        }
                      }
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(HeadNudge, { modelRef, version: headNudgeV }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("group", { position: [0, 0, 0] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                    PinBackLight,
                    {
                      modelRef,
                      intensity: lightIntensity,
                      angle: lightAngle,
                      penumbra: lightPenumbra,
                      posY: lightPosY,
                      posZ: lightPosZ,
                      color: lightColor
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(dt, { multisampling: 0, disableNormalPass: true, children: [
                    dotEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Rt,
                      {
                        blendFunction: {
                          normal: BlendFunction.NORMAL,
                          multiply: BlendFunction.MULTIPLY,
                          screen: BlendFunction.SCREEN,
                          overlay: BlendFunction.OVERLAY,
                          softlight: BlendFunction.SOFT_LIGHT,
                          add: BlendFunction.ADD,
                          darken: BlendFunction.DARKEN,
                          lighten: BlendFunction.LIGHTEN
                        }[(dotBlend || "normal").toLowerCase()] || BlendFunction.NORMAL,
                        angle: dotAngle,
                        scale: dotScale,
                        center: [dotCenterX, dotCenterY],
                        opacity: dotOpacity
                      }
                    ),
                    eggActive && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(yt, { offset: [0.012, 9e-3] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Ut,
                        {
                          delay: [0.02, 0.06],
                          duration: [0.6, 1.4],
                          strength: [1, 1.8],
                          mode: GlitchMode.CONSTANT,
                          active: true,
                          columns: 6e-3
                        }
                      )
                    ] })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "img",
              {
                src: `${"/development/"}slap.svg`,
                alt: "slap",
                draggable: "false",
                className: "pointer-events-none select-none absolute",
                style: {
                  left: `${cursorPos.x}px`,
                  top: `${cursorPos.y}px`,
                  width: "80px",
                  height: "80px",
                  transform: `translate(-50%, -50%) scale(${cursorScale})`,
                  opacity: cursorVisible ? 1 : 0,
                  transition: "transform 90ms ease-out, opacity 120ms ease-out"
                }
              }
            )
          ]
        }
      )
    ] }),
    showUI && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-auto select-none p-2 rounded-md bg-black/50 text-white w-52 space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs font-semibold opacity-90", children: "UI de retrato" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] font-medium opacity-80 mt-1", children: "Cámara" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Altura Y: ",
        camY.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "w-full",
            type: "range",
            min: CAM_Y_MIN,
            max: CAM_Y_MAX,
            step: "0.01",
            value: camY,
            onChange: (e) => setCamY(parseFloat(e.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Zoom: ",
        Math.round(camZoom),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "w-full",
            type: "range",
            min: ZOOM_MIN,
            max: ZOOM_MAX,
            step: "1",
            value: camZoom,
            onChange: (e) => setCamZoom(parseFloat(e.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors",
          onClick: async () => {
            const preset = JSON.stringify({ camY: parseFloat(camY.toFixed(2)), camZoom: Math.round(camZoom) }, null, 2);
            try {
              await navigator.clipboard.writeText(preset);
            } catch {
              const ta = document.createElement("textarea");
              ta.value = preset;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
          },
          children: "Copiar preset Cámara"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-px bg-white/10 my-1" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] font-medium opacity-80", children: "Luz" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Intensidad: ",
        lightIntensity.toFixed(1),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "w-full",
            type: "range",
            min: "0",
            max: "20",
            step: "0.1",
            value: lightIntensity,
            onChange: (e) => setLightIntensity(parseFloat(e.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Ángulo: ",
        lightAngle.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "w-full",
            type: "range",
            min: "0.1",
            max: "1.0",
            step: "0.01",
            value: lightAngle,
            onChange: (e) => setLightAngle(parseFloat(e.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Penumbra: ",
        lightPenumbra.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            className: "w-full",
            type: "range",
            min: "0",
            max: "1",
            step: "0.01",
            value: lightPenumbra,
            onChange: (e) => setLightPenumbra(parseFloat(e.target.value))
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex-1 block text-[11px] opacity-80", children: [
          "Altura Y",
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "w-full",
              type: "range",
              min: "1.0",
              max: "3.5",
              step: "0.05",
              value: lightPosY,
              onChange: (e) => setLightPosY(parseFloat(e.target.value))
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex-1 block text-[11px] opacity-80", children: [
          "Dist Z",
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              className: "w-full",
              type: "range",
              min: "-3.0",
              max: "-0.2",
              step: "0.02",
              value: lightPosZ,
              onChange: (e) => setLightPosZ(parseFloat(e.target.value))
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Color" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "color",
            value: lightColor,
            onChange: (e) => setLightColor(e.target.value),
            className: "h-6 w-10 bg-transparent border-0 outline-none cursor-pointer"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: handleCopy,
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors",
          children: copied ? "¡Copiado!" : "Copiar valores"
        }
      )
    ] })
  ] });
}
useGLTF.preload(`${"/development/"}character.glb`);
function TypingText({ text }) {
  const [display, setDisplay] = reactExports.useState("");
  const [dots, setDots] = reactExports.useState(0);
  const idxRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    setDisplay("");
    idxRef.current = 0;
    const speed = 14;
    const t = setInterval(() => {
      idxRef.current += 1;
      setDisplay(text.slice(0, idxRef.current));
      if (idxRef.current >= text.length) {
        clearInterval(t);
      }
    }, Math.max(10, 1e3 / speed));
    return () => clearInterval(t);
  }, [text]);
  reactExports.useEffect(() => {
    const anim = setInterval(() => setDots((d) => (d + 1) % 3), 800);
    return () => clearInterval(anim);
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative font-marquee tracking-wide px-2 text-center uppercase text-[14px] sm:text-[15px]", children: [
    display,
    display.length < text.length && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block w-[0.9em] text-center animate-[bubbleDotPulse_1.4s_ease-in-out_infinite]", children: "•" })
  ] });
}
function PostFX({
  lowPerf = false,
  eggActiveGlobal = false,
  bloom = 0.25,
  vignette = 0.7,
  noise = 0.08,
  dotEnabled = true,
  dotScale = 1,
  dotAngle = Math.PI / 4,
  dotCenterX = 0.5,
  dotCenterY = 0.5,
  dotOpacity = 1,
  dotBlend = "normal",
  godEnabled = false,
  godSun = null,
  godDensity = 0.9,
  godDecay = 0.95,
  godWeight = 0.6,
  godExposure = 0.3,
  godClampMax = 1,
  godSamples = 60,
  dofEnabled = false,
  dofProgressive = true,
  dofFocusDistance = 0.2,
  dofFocalLength = 0.02,
  dofBokehScale = 3,
  dofFocusSpeed = 0.08,
  dofTargetRef = null
}) {
  const blendMap = reactExports.useMemo(
    () => ({
      normal: BlendFunction.NORMAL,
      multiply: BlendFunction.MULTIPLY,
      screen: BlendFunction.SCREEN,
      overlay: BlendFunction.OVERLAY,
      softlight: BlendFunction.SOFT_LIGHT,
      add: BlendFunction.ADD,
      darken: BlendFunction.DARKEN,
      lighten: BlendFunction.LIGHTEN
    }),
    []
  );
  const dotBlendFn = blendMap[(dotBlend || "normal").toLowerCase()] ?? BlendFunction.NORMAL;
  const { camera } = useThree();
  const focusDistRef = reactExports.useRef(dofFocusDistance);
  useFrame(() => {
    if (!dofEnabled || !dofProgressive || !dofTargetRef?.current) return;
    const world = new Vector3();
    dofTargetRef.current.getWorldPosition(world);
    world.applyMatrix4(camera.matrixWorldInverse);
    const zView = -world.z;
    const t = MathUtils.clamp((zView - camera.near) / (camera.far - camera.near), 0, 1);
    focusDistRef.current = MathUtils.lerp(focusDistRef.current, t, dofFocusSpeed);
  });
  const godKey = reactExports.useMemo(
    () => `gr:${godEnabled ? 1 : 0}:${godDensity.toFixed(3)}:${godDecay.toFixed(3)}:${godWeight.toFixed(3)}:${godExposure.toFixed(3)}:${godClampMax.toFixed(3)}:${godSamples}`,
    [godEnabled, godDensity, godDecay, godWeight, godExposure, godClampMax, godSamples]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(dt, { multisampling: 0, disableNormalPass: true, children: [
    !lowPerf && /* @__PURE__ */ jsxRuntimeExports.jsx(Lt, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(wt, { mipmapBlur: true, intensity: bloom, luminanceThreshold: 0.86, luminanceSmoothing: 0.18 }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Xt, { mode: ToneMappingMode.ACES_FILMIC }),
    !lowPerf && dofEnabled && /* @__PURE__ */ jsxRuntimeExports.jsx(
      ce,
      {
        focusDistance: dofProgressive ? focusDistRef.current : dofFocusDistance,
        focalLength: dofFocalLength,
        bokehScale: dofBokehScale
      }
    ),
    !eggActiveGlobal && /* @__PURE__ */ jsxRuntimeExports.jsx(qt, { eskil: false, offset: 0.15, darkness: vignette }),
    !lowPerf && godEnabled && godSun?.current && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Ct,
      {
        sun: godSun.current,
        density: godDensity,
        decay: godDecay,
        weight: godWeight,
        exposure: godExposure,
        clampMax: godClampMax,
        samples: godSamples,
        blendFunction: BlendFunction.SCREEN
      },
      godKey
    ),
    dotEnabled && !lowPerf && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Rt,
      {
        blendFunction: dotBlendFn,
        angle: dotAngle,
        scale: dotScale,
        center: [dotCenterX, dotCenterY],
        opacity: dotOpacity
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(At, { premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT, opacity: lowPerf ? Math.min(noise, 0.04) : noise }),
    eggActiveGlobal && !lowPerf && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(yt, { offset: [0.01, 8e-3] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Ut,
        {
          delay: [0.02, 0.08],
          duration: [0.5, 1.2],
          strength: [0.9, 1.6],
          mode: GlitchMode.CONSTANT,
          active: true,
          columns: 5e-3
        }
      )
    ] })
  ] }) });
}
const PLACEHOLDER_ITEMS = Array.from({ length: 6 }).map((_, i) => ({
  id: `item-${i}`,
  title: `Proyecto ${i + 1}`,
  image: `${"/development/"}Etherean.jpg`
}));
function getWorkImageUrls() {
  try {
    return [`${"/development/"}Etherean.jpg`];
  } catch {
    return [];
  }
}
function Section1$1({ scrollerRef, scrollbarOffsetRight = 0 }) {
  const [items] = React.useState(PLACEHOLDER_ITEMS);
  const [hover, setHover] = React.useState({ active: false, title: "", x: 0, y: 0 });
  const listRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const lastUpdateRef = React.useRef(0);
  React.useRef({ el: null, rx: 0, ry: 0 });
  const invalidateRef = React.useRef(null);
  const [overlayKey, setOverlayKey] = React.useState(0);
  const degradedRef = React.useRef(false);
  const onEnter = (e, it) => setHover({ active: true, title: it.title, x: e.clientX, y: e.clientY });
  const onMove = (e) => setHover((h) => ({ ...h, x: e.clientX, y: e.clientY }));
  const onLeave = () => setHover({ active: false, title: "", x: 0, y: 0 });
  const renderItems = React.useMemo(() => {
    const REPEATS = 12;
    const out = [];
    for (let r = 0; r < REPEATS; r++) {
      for (let i = 0; i < items.length; i++) {
        out.push({ key: `r${r}-i${i}`, i, r, item: items[i] });
      }
    }
    return out;
  }, [items]);
  React.useEffect(() => {
    const scroller = scrollerRef?.current;
    const container = listRef.current;
    if (!scroller || !container) return;
    let scheduled = false;
    const update = () => {
      scheduled = false;
      lastUpdateRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const sRect = scroller.getBoundingClientRect();
        const viewCenterY = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2;
        const half = (scroller.clientHeight || 1) / 2;
        const cards = container.querySelectorAll("[data-work-card]");
        cards.forEach((el) => {
          const r = el.getBoundingClientRect();
          const center = (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2;
          const dy = Math.abs(center - viewCenterY);
          const t = Math.max(0, Math.min(1, dy / half));
          const ease = (x) => 1 - Math.pow(1 - x, 2);
          const scale = 0.88 + 0.18 * (1 - ease(t));
          const boost = dy < 14 ? 0.04 : 0;
          const fade = 0.55 + 0.45 * (1 - ease(t));
          el.__scale = scale + boost;
          el.style.opacity = fade.toFixed(3);
          el.style.transform = `perspective(1200px) scale(${(el.__scale || 1).toFixed(3)})`;
        });
      } catch {
      }
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      rafRef.current = requestAnimationFrame(update);
      try {
        if (typeof invalidateRef.current === "function") invalidateRef.current();
      } catch {
      }
    };
    const onResize = () => {
      onScroll();
      try {
        if (typeof invalidateRef.current === "function") invalidateRef.current();
      } catch {
      }
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollerRef]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-auto select-none relative", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollForwarder, { scrollerRef }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-[0]", "aria-hidden": true, style: { right: `${scrollbarOffsetRight}px`, pointerEvents: "none" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Canvas,
      {
        className: "w-full h-full block",
        orthographic: true,
        frameloop: "always",
        dpr: [1, 1],
        gl: { alpha: true, antialias: false, powerPreference: "high-performance" },
        camera: { position: [0, 0, 10] },
        events: void 0,
        onCreated: (state) => {
          try {
            state.gl.domElement.style.pointerEvents = "none";
          } catch {
          }
          try {
            invalidateRef.current = state.invalidate;
          } catch {
          }
          try {
            const canvas = state.gl.domElement;
            const onLost = (e) => {
              try {
                e.preventDefault();
              } catch {
              }
              ;
              try {
                degradedRef.current = true;
              } catch {
              }
              ;
              try {
                setOverlayKey((k) => k + 1);
              } catch {
              }
            };
            const onRestored = () => {
              try {
                setOverlayKey((k) => k + 1);
              } catch {
              }
            };
            canvas.addEventListener("webglcontextlost", onLost, { passive: false });
            canvas.addEventListener("webglcontextrestored", onRestored);
          } catch {
          }
        },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ScreenOrthoCamera, {}),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(React.Suspense, { fallback: null, children: [
            !degradedRef.current && /* @__PURE__ */ jsxRuntimeExports.jsx(Environment$1, { files: `${"/development/"}light.hdr`, background: false }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ambientLight", { intensity: 0.6 }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("directionalLight", { intensity: 0.4, position: [0.5, 0.5, 1] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ParallaxBirds, { scrollerRef })
          ] })
        ]
      },
      overlayKey
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: listRef, className: "relative z-[12010] space-y-12 w-full min-h-screen flex flex-col items-center justify-start px-10 py-10", children: [
      false,
      renderItems.map((it) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "py-4 will-change-transform", "data-work-card": true, "data-work-card-i": it.i, style: { transform: "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(0.96)", transition: "transform 220ms ease" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Card, { item: it.item, onEnter, onMove, onLeave }) }, it.key))
    ] }),
    hover.active && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "fixed z-[13060] pointer-events-none px-3 py-1 rounded-md bg-black/70 text-white text-sm font-medium shadow-lg",
        style: { left: `${hover.x + 12}px`, top: `${hover.y + 12}px` },
        children: hover.title
      }
    )
  ] });
}
function Card({ item, onEnter, onMove, onLeave }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "group mx-auto w-full max-w-[min(90vw,860px)] aspect-[5/3] rounded-xl overflow-hidden shadow-xl relative",
      onMouseEnter: (e) => onEnter(e, item),
      onMouseMove: onMove,
      onMouseLeave: onLeave,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: item.image,
            alt: item.title,
            className: "w-full h-full object-cover block",
            loading: "lazy",
            decoding: "async",
            draggable: false
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" })
      ]
    }
  );
}
function ScreenOrthoCamera() {
  const { camera, size } = useThree();
  React.useEffect(() => {
    const PAD = Math.max(80, Math.min(200, Math.round(Math.max(size.width, size.height) * 0.08)));
    camera.left = -size.width / 2 - PAD;
    camera.right = size.width / 2 + PAD;
    camera.top = size.height / 2 + PAD;
    camera.bottom = -size.height / 2 - PAD;
    camera.near = -5e3;
    camera.far = 5e3;
    camera.position.set(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}
function ParallaxBirds({ scrollerRef }) {
  const { size } = useThree();
  const leftRef = React.useRef();
  const rightRef = React.useRef();
  const whiteRef = React.useRef();
  const isMobile = React.useMemo(() => {
    try {
      return typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : size.width <= 640;
    } catch {
      return size.width <= 640;
    }
  }, [size]);
  const mobileScale = React.useMemo(() => {
    try {
      if (typeof window !== "undefined" && typeof window.__birdsScaleMobile === "number") {
        return isMobile ? Math.max(0.3, Math.min(1, window.__birdsScaleMobile)) : 1;
      }
    } catch {
    }
    return isMobile ? 0.6 : 1;
  }, [isMobile]);
  React.useEffect(() => {
    try {
      if (leftRef.current) leftRef.current.scale.setScalar(mobileScale);
      if (rightRef.current) rightRef.current.scale.setScalar(mobileScale);
      if (whiteRef.current) whiteRef.current.scale.setScalar(mobileScale);
    } catch {
    }
  }, [mobileScale]);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(false);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(0);
  React.useRef(null);
  const gltf = useGLTF(`${"/development/"}3dmodels/housebird.glb`);
  const gltfPink = useGLTF(`${"/development/"}3dmodels/housebirdPink.glb`);
  const gltfWhite = useGLTF(`${"/development/"}3dmodels/housebirdWhite.glb`);
  const DEBUG = false;
  React.useMemo(() => ({
    windAmpX: 0.045,
    // fracción del width
    windFreqL: 0.6,
    windFreqR: 0.52,
    windFreqW: 0.58,
    driftYScale: 0.014,
    // fracción del height
    kY: { L: 44, R: 40, W: 42 },
    // rigidez vertical
    cY: { L: 6.2, R: 6.6, W: 6.4 },
    // amortiguación vertical
    bounceY: { L: 0.86, R: 0.88, W: 0.88 },
    minKickY: { L: 48, R: 55, W: 52 },
    kX: { L: 7, R: 6.6, W: 6.8 },
    cX: { L: 4, R: 4.2, W: 4.1 },
    bounceX: { L: 0.88, R: 0.9, W: 0.89 },
    minKickX: { L: 52, R: 58, W: 55 },
    repelK: { L: 200, R: 210, W: 205 },
    edgeThreshY: 0.12,
    edgeThreshX: 0.12
  }), []);
  const makeBird = React.useCallback((variant = "default") => {
    let baseScene = gltf.scene;
    if (variant === "pink" && gltfPink?.scene) baseScene = gltfPink.scene;
    else if (variant === "white" && gltfWhite?.scene) baseScene = gltfWhite.scene;
    const clone2 = baseScene.clone(true);
    clone2.traverse((n) => {
      if (n.isMesh) {
        n.frustumCulled = false;
        if (n.material) {
          try {
            n.material = n.material.clone();
            n.material.transparent = false;
            n.material.opacity = 1;
            n.material.depthWrite = true;
            n.material.depthTest = true;
            n.material.side = FrontSide;
            n.material.alphaTest = 0;
            n.material.needsUpdate = true;
          } catch {
          }
        }
      }
    });
    try {
      const box = new Box3().setFromObject(clone2);
      const sizeV = new Vector3();
      box.getSize(sizeV);
      const maxDim = Math.max(sizeV.x, sizeV.y, sizeV.z) || 1;
      const targetPx = 900;
      const scale = targetPx / maxDim;
      clone2.scale.setScalar(scale);
    } catch {
    }
    return clone2;
  }, [gltf, gltfPink, gltfWhite]);
  const layout = React.useMemo(() => {
    const vh = size.height;
    const vw = size.width;
    return {
      left: { x: vw * 0.18, y: vh * 0.32, scale: 4 },
      right: { x: vw * 0.76, y: vh * 0.68, scale: 4.8 },
      white: { x: vw * 0.5, y: vh * 0.6, scale: 4.4 }
    };
  }, [size]);
  const leftBird = React.useMemo(() => makeBird("default"), [makeBird]);
  const rightBird = React.useMemo(() => makeBird("pink"), [makeBird]);
  const whiteBird = React.useMemo(() => makeBird("white"), [makeBird]);
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    const w = size.width;
    const h = size.height;
    let ampFactor = isMobile ? 0.7 : 1;
    try {
      if (typeof window !== "undefined" && typeof window.__birdsAmpFactor === "number") {
        ampFactor = Math.max(0.3, Math.min(1.5, window.__birdsAmpFactor));
      }
    } catch {
    }
    const ampX = Math.min(w, h) * 0.12 * ampFactor;
    const ampY = Math.min(w, h) * 0.1 * ampFactor;
    if (leftRef.current) {
      const baseX = layout.left.x - w / 2;
      const baseY = layout.left.y;
      const x = baseX + Math.sin(t * 0.6) * ampX;
      const scrY = baseY + Math.cos(t * 0.7) * ampY;
      const y = h / 2 - scrY;
      leftRef.current.position.set(x, y, 0);
      leftRef.current.rotation.y += delta * 0.08;
      leftRef.current.rotation.x += delta * 0.03;
      leftRef.current.rotation.z += delta * 0.028;
    }
    if (rightRef.current) {
      const baseX = layout.right.x - w / 2;
      const baseY = layout.right.y;
      const x = baseX + Math.sin(t * 0.52 + Math.PI * 0.33) * (ampX * 0.95);
      const scrY = baseY + Math.sin(t * 0.62 + 1.2) * (ampY * 0.9);
      const y = h / 2 - scrY;
      rightRef.current.position.set(x, y, 0);
      rightRef.current.rotation.y -= delta * 0.075;
      rightRef.current.rotation.x -= delta * 0.026;
      rightRef.current.rotation.z -= delta * 0.03;
    }
    if (whiteRef.current) {
      const baseX = layout.white.x - w / 2;
      const baseY = layout.white.y;
      const x = baseX + Math.sin(t * 0.58 + Math.PI * 0.18) * (ampX * 0.9);
      const scrY = baseY + Math.cos(t * 0.66 + 0.8) * (ampY * 0.85);
      const y = h / 2 - scrY;
      whiteRef.current.position.set(x, y, 0);
      whiteRef.current.rotation.y += delta * 0.085;
      whiteRef.current.rotation.x += delta * 0.024;
      whiteRef.current.rotation.z += delta * 0.032;
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { children: [
    DEBUG,
    /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { ref: leftRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { object: leftBird }),
      DEBUG
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { ref: rightRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { object: rightBird }),
      DEBUG
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { ref: whiteRef, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { object: whiteBird }),
      DEBUG
    ] })
  ] });
}
useGLTF.preload(`${"/development/"}3dmodels/housebird.glb`);
useGLTF.preload(`${"/development/"}3dmodels/housebirdPink.glb`);
useGLTF.preload(`${"/development/"}3dmodels/housebirdWhite.glb`);
function ScrollForwarder({ scrollerRef }) {
  React.useEffect(() => {
    const onWheel = (e) => {
      try {
        e.preventDefault();
        const el2 = scrollerRef?.current;
        if (el2) el2.scrollTop += e.deltaY;
      } catch {
      }
    };
    let touchY = null;
    const onTouchStart = (e) => {
      try {
        touchY = e.touches?.[0]?.clientY ?? null;
      } catch {
      }
    };
    const onTouchMove = (e) => {
      try {
        if (touchY == null) return;
        const y = e.touches?.[0]?.clientY ?? touchY;
        const dy = touchY - y;
        touchY = y;
        const el2 = scrollerRef?.current;
        if (el2) el2.scrollTop += dy;
        e.preventDefault();
      } catch {
      }
    };
    const onTouchEnd = () => {
      touchY = null;
    };
    const el = document.getElementById("work-scroll-forwarder");
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scrollerRef]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      id: "work-scroll-forwarder",
      className: "fixed inset-0 z-[5]",
      style: { pointerEvents: "auto", background: "transparent" }
    }
  );
}
const Section1$2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Section1$1,
  getWorkImageUrls
}, Symbol.toStringTag, { value: "Module" }));
function FollowLight({ playerRef, height = 6, intensity = 2.5, color = "#ffffff", angle = 0.8, penumbra = 0.6, relativeToBounds = false, relativeFactor = 0.4, showGizmo = false, gizmoColor = "#00ffff", follow = true, targetFollows = true, gizmoLayer = 31 }) {
  const lightRef = reactExports.useRef();
  const targetRef = reactExports.useRef();
  const tempPos = reactExports.useRef(new Vector3());
  const tempTarget = reactExports.useRef(new Vector3());
  const bboxRef = reactExports.useRef(new Box3());
  const sizeRef = reactExports.useRef(new Vector3());
  const gizmoRef = reactExports.useRef();
  const lineRef = reactExports.useRef();
  const draggingRef = reactExports.useRef(false);
  const initedRef = reactExports.useRef(false);
  const groupRef = reactExports.useRef();
  const { camera } = useThree();
  React.useEffect(() => {
    if (!showGizmo) return;
    if (!playerRef?.current || !lightRef.current) return;
    if (initedRef.current) return;
    try {
      const base = playerRef.current.position.clone();
      let yOff = height;
      if (relativeToBounds) {
        bboxRef.current.setFromObject(playerRef.current);
        bboxRef.current.getSize(sizeRef.current);
        const h = Math.max(0.1, sizeRef.current.y);
        yOff = h * (1 + Math.max(0, relativeFactor));
      }
      base.y += yOff;
      lightRef.current.position.copy(base);
      if (gizmoRef.current) gizmoRef.current.position.copy(base);
      initedRef.current = true;
    } catch {
    }
  }, [showGizmo, playerRef, height, relativeToBounds, relativeFactor]);
  React.useEffect(() => {
    if (!showGizmo || !camera) return;
    try {
      camera.layers.enable(gizmoLayer);
    } catch {
    }
  }, [showGizmo, camera, gizmoLayer]);
  useFrame((_, delta) => {
    if (!playerRef.current || !lightRef.current || !targetRef.current) return;
    const smoothing = 1 - Math.pow(1e-3, delta);
    if (follow) {
      tempPos.current.copy(playerRef.current.position);
      if (relativeToBounds) {
        try {
          bboxRef.current.setFromObject(playerRef.current);
          bboxRef.current.getSize(sizeRef.current);
          const h = Math.max(0.1, sizeRef.current.y);
          tempPos.current.y += h * (1 + Math.max(0, relativeFactor));
        } catch {
          tempPos.current.y += height;
        }
      } else {
        tempPos.current.y = (playerRef.current.position.y || 0) + height;
      }
    }
    if (targetFollows) {
      tempTarget.current.copy(playerRef.current.position);
      tempTarget.current.y += 1.6;
    }
    if (showGizmo) {
      try {
        if (!draggingRef.current) {
          if (gizmoRef.current && follow) gizmoRef.current.position.lerp(tempPos.current, smoothing);
        }
        const src = gizmoRef.current && draggingRef.current ? gizmoRef.current.position : follow ? tempPos.current : gizmoRef.current?.position || lightRef.current.position;
        lightRef.current.position.lerp(src, smoothing);
      } catch {
        lightRef.current.position.lerp(tempPos.current, smoothing);
      }
    } else {
      if (follow) lightRef.current.position.lerp(tempPos.current, smoothing);
    }
    if (targetFollows) {
      targetRef.current.position.lerp(tempTarget.current, smoothing);
      lightRef.current.target = targetRef.current;
      lightRef.current.target.updateMatrixWorld();
    }
    if (showGizmo) {
      try {
        if (gizmoRef.current) {
          gizmoRef.current.position.copy(lightRef.current.position);
        }
        if (lineRef.current) {
          const geo = lineRef.current.geometry;
          const posArr = new Float32Array([
            lightRef.current.position.x,
            lightRef.current.position.y,
            lightRef.current.position.z,
            targetRef.current.position.x,
            targetRef.current.position.y,
            targetRef.current.position.z
          ]);
          if (!geo.getAttribute("position")) {
            geo.setAttribute("position", new BufferAttribute(posArr, 3));
          } else {
            const attr = geo.getAttribute("position");
            attr.array.set(posArr);
            attr.needsUpdate = true;
          }
        }
      } catch {
      }
    }
    try {
      window.__preLightPos = [lightRef.current.position.x, lightRef.current.position.y, lightRef.current.position.z];
      window.__preLightTarget = [targetRef.current.position.x, targetRef.current.position.y, targetRef.current.position.z];
    } catch {
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "spotLight",
      {
        ref: lightRef,
        color,
        intensity,
        angle,
        penumbra,
        distance: 50,
        castShadow: true,
        "shadow-mapSize-width": 1024,
        "shadow-mapSize-height": 1024,
        "shadow-bias": -6e-5,
        "shadow-normalBias": 0.02,
        "shadow-radius": 8
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("object3D", { ref: targetRef }),
    showGizmo && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        TransformControls,
        {
          mode: "translate",
          onMouseDown: () => {
            draggingRef.current = true;
          },
          onMouseUp: () => {
            draggingRef.current = false;
          },
          children: /* @__PURE__ */ jsxRuntimeExports.jsxs("group", { ref: groupRef, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { layers: gizmoLayer, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("sphereGeometry", { args: [0.3, 12, 12] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("meshBasicMaterial", { transparent: true, opacity: 1e-3, depthWrite: false })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { ref: gizmoRef, layers: gizmoLayer, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("sphereGeometry", { args: [0.12, 16, 16] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("meshBasicMaterial", { color: gizmoColor, wireframe: true })
            ] })
          ] })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("line", { ref: lineRef, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("bufferGeometry", {}),
        /* @__PURE__ */ jsxRuntimeExports.jsx("lineBasicMaterial", { color: gizmoColor })
      ] })
    ] })
  ] });
}
function PortalParticles({ center = [0, 0, 0], radius = 3.5, count = 240, color = "#c7d2fe", targetColor = "#ffffff", mix = 0, playerRef, frenzyRadius = 10 }) {
  const MAX_BONES = 32;
  const aBaseAngle = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aBaseRadius = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aBaseY = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aSize = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aFreq = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aSeed = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aTight = reactExports.useMemo(() => new Float32Array(count), [count]);
  const aBoneSlot = reactExports.useMemo(() => new Float32Array(count), [count]);
  const centerVec = reactExports.useMemo(() => new Vector3().fromArray(center), [center]);
  const pointsRef = reactExports.useRef();
  const geoRef = reactExports.useRef();
  const materialRef = reactExports.useRef();
  const bonesRef = reactExports.useRef([]);
  reactExports.useRef(null);
  const tmpRef = reactExports.useRef({ world: new Vector3(), bone: new Vector3() });
  reactExports.useMemo(() => {
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * Math.PI * 2;
      const t = Math.random();
      const r = radius * Math.pow(t, 0.65);
      aBaseAngle[i] = angle;
      aBaseRadius[i] = r;
      const pr = Math.sin((i + 0.5) * 12.9898) * 43758.5453;
      const u = pr - Math.floor(pr);
      const up = u * u * u;
      aBaseY[i] = up * 1.6 - 0.2;
      aSize[i] = 0.3 + Math.random() * 0.5;
      aFreq[i] = 0.6 + Math.random() * 0.8;
      aSeed[i] = Math.random() * Math.PI * 2;
      aTight[i] = 0.05 + Math.random() * 0.12;
      aBoneSlot[i] = Math.floor(Math.random() * MAX_BONES);
    }
  }, [count, radius, aBaseAngle, aBaseRadius, aBaseY, aSize, aFreq, aSeed, aTight]);
  const uniformsRef = reactExports.useRef({
    uTime: { value: 0 },
    uCenter: { value: new Vector3().fromArray(center) },
    uPlayer: { value: new Vector3() },
    uFrenzy: { value: 0 },
    uColor: { value: new Color(color) },
    uTargetColor: { value: new Color(targetColor) },
    uMix: { value: mix },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uRadius: { value: radius },
    uBoneCount: { value: 0 },
    uBones: { value: new Array(MAX_BONES).fill(0).map(() => new Vector3()) }
  });
  reactExports.useEffect(() => {
    const u = uniformsRef.current;
    u.uCenter.value.fromArray(center);
    u.uColor.value.set(color);
    u.uTargetColor.value.set(targetColor);
    u.uRadius.value = radius;
    u.uMix.value = mix;
  }, [center, color, targetColor, radius, mix]);
  useFrame((state) => {
    const uniforms = uniformsRef.current;
    uniforms.uMix.value = mix;
    uniforms.uTargetColor.value.set(targetColor);
    uniforms.uTime.value = state.clock.getElapsedTime();
    if (state.gl) {
      const dpr = state.gl.getPixelRatio ? state.gl.getPixelRatio() : window.devicePixelRatio || 1;
      uniforms.uPixelRatio.value = Math.min(dpr, 2);
    }
    if (playerRef?.current) {
      if (bonesRef.current.length === 0) {
        let skinned = null;
        playerRef.current.traverse((o) => {
          if (!skinned && o.isSkinnedMesh && o.skeleton) skinned = o;
        });
        if (skinned && skinned.skeleton && skinned.skeleton.bones?.length) {
          bonesRef.current = skinned.skeleton.bones.slice();
        } else {
          const collected = [];
          playerRef.current.traverse((o) => {
            if (o.isBone) collected.push(o);
          });
          if (collected.length) bonesRef.current = collected;
        }
      }
      const boneCount = Math.min(MAX_BONES, bonesRef.current.length);
      uniforms.uBoneCount.value = boneCount;
      const groupWorld = pointsRef.current ? pointsRef.current.getWorldPosition(tmpRef.current.world) : centerVec;
      if (boneCount > 0) {
        for (let i = 0; i < MAX_BONES; i += 1) {
          const v = uniforms.uBones.value[i];
          if (i < boneCount) {
            bonesRef.current[i].getWorldPosition(tmpRef.current.bone);
            v.copy(tmpRef.current.bone).sub(groupWorld);
          } else {
            v.set(0, 0, 0);
          }
        }
      }
      const d = groupWorld.distanceTo(playerRef.current.position);
      uniforms.uFrenzy.value = MathUtils.clamp(1 - d / frenzyRadius, 0, 1);
      uniforms.uPlayer.value.copy(playerRef.current.position).sub(groupWorld);
      uniforms.uCenter.value.set(0, 0, 0);
    } else {
      uniformsRef.current.uFrenzy.value = 0;
    }
  });
  const dummyPosition = reactExports.useMemo(() => new Float32Array(count * 3), [count]);
  reactExports.useEffect(() => {
    if (!geoRef.current) return;
    const g = geoRef.current;
    try {
      g.setAttribute("position", new BufferAttribute(dummyPosition, 3));
      g.setAttribute("aBaseAngle", new BufferAttribute(aBaseAngle, 1));
      g.setAttribute("aBaseRadius", new BufferAttribute(aBaseRadius, 1));
      g.setAttribute("aBaseY", new BufferAttribute(aBaseY, 1));
      g.setAttribute("aSize", new BufferAttribute(aSize, 1));
      g.setAttribute("aFreq", new BufferAttribute(aFreq, 1));
      g.setAttribute("aSeed", new BufferAttribute(aSeed, 1));
      g.setAttribute("aTight", new BufferAttribute(aTight, 1));
      g.setAttribute("aBoneSlot", new BufferAttribute(aBoneSlot, 1));
      g.computeBoundingSphere();
    } catch {
    }
  }, [geoRef, dummyPosition, aBaseAngle, aBaseRadius, aBaseY, aSize, aFreq, aSeed, aTight, aBoneSlot]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("points", { ref: pointsRef, frustumCulled: false, renderOrder: -25, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("bufferGeometry", { ref: geoRef }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "shaderMaterial",
      {
        ref: materialRef,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: AdditiveBlending,
        uniforms: uniformsRef.current,
        vertexShader: `
          precision highp float;
          attribute float aBaseAngle;
          attribute float aBaseRadius;
          attribute float aBaseY;
          attribute float aSize;
          attribute float aFreq;
          attribute float aSeed;
          attribute float aTight;
          attribute float aBoneSlot;
          uniform float uTime;
          uniform float uRadius;
          uniform float uFrenzy;
          uniform float uPixelRatio;
          uniform vec3 uCenter;
          uniform vec3 uPlayer;
          uniform float uBoneCount;
          uniform vec3 uBones[32];
          varying float vLife;
          varying float vFrenzy;
          void main() {
            vFrenzy = uFrenzy;
            // Life pulse [0..1] for subtle brightness modulation
            float cycle = fract(uTime * aFreq + aSeed);
            float fadeIn = smoothstep(0.0, 0.2, cycle);
            float fadeOut = 1.0 - smoothstep(0.8, 1.0, cycle);
            vLife = fadeIn * fadeOut;

            // Reduced ring feel + freer wander
            float ang = aBaseAngle
              + uTime * (0.06 + aFreq * 0.04) * (1.0 + uFrenzy * 0.8)
              + sin(uTime * 0.18 + aSeed) * 0.08 * (1.0 + uFrenzy * 0.6);
            float rWave = 1.0 + 0.03 * sin(uTime * 0.18 + aSeed);
            float rExpand = 1.0 + 0.8 * uFrenzy;
            float rBase = aBaseRadius * rWave * rExpand;
            float r = mix(rBase, aTight * 0.8, clamp(uFrenzy * 1.05, 0.0, 1.0));

            float y = (aBaseY * (1.0 + 0.5 * uFrenzy)) + 0.2 * sin(uTime * 0.28 + aSeed);

            // Interpolate center towards a selected bone when close (stick to body)
            int boneCount = int(uBoneCount);
            int slot = int(mod(aBoneSlot, max(float(boneCount), 1.0)));
            vec3 bonePos = (boneCount > 0) ? uBones[slot] : uCenter;
            vec3 centerCurr = mix(uCenter, bonePos, clamp(uFrenzy, 0.0, 1.0));
            vec3 pos = vec3(cos(ang) * r, y, sin(ang) * r) + centerCurr;
            // Órbita local apretada alrededor del hueso cuando muy cerca
            vec3 p1 = normalize(vec3(sin(aSeed*1.3), 0.0, cos(aSeed*2.1)));
            vec3 p2 = normalize(cross(p1, vec3(0.0,1.0,0.0)));
            float lr = aTight * 1.2 * uFrenzy;
            vec3 localOrb = p1 * sin(uTime*(2.2 + aFreq*1.5)) + p2 * cos(uTime*(2.6 + aFreq));
            pos += localOrb * lr;
            // Free 3D wander
            float amp = 0.6 + 1.2 * uFrenzy; // wander más amplio
            vec3 wander = vec3(
              sin(uTime * (0.55 + aFreq) + aSeed * 1.1) + sin(uTime * 0.73 + aSeed * 2.0),
              sin(uTime * (0.41 + aFreq) + aSeed * 1.7),
              cos(uTime * (0.47 + aFreq * 0.9) + aSeed * 1.3)
            ) * 0.25 * amp;
            pos += wander;

            // Enjambre: alrededor del jugador de forma aleatoria
            // Dirección hacia el jugador con offset leve a la cabeza
            vec3 dir = normalize(uPlayer - pos + vec3(0.0, 1.2, 0.0));
            float h = fract(sin(aSeed * 12.9898) * 43758.5453);
            vec3 up = vec3(0.0, 1.0, 0.0);
            vec3 ortho = normalize(cross(dir, up));
            float wiggle = sin(uTime * (1.8 + aFreq) + aSeed) * 0.6 + cos(uTime * 1.4 + aSeed * 1.7) * 0.4;
            // Aumentar seguimiento y cohesión para recuperar "enjambre"
            vec3 steer = dir * (1.6 + 1.2 * h) + ortho * (0.55 * wiggle) + up * (0.5 * sin(uTime * 1.25 + aSeed * 2.2));
            float stick = clamp(uFrenzy * 1.2, 0.0, 1.0);
            pos += steer * (1.15 * (1.0 - 0.5 * stick));

            // Clamp final position to a max radius around the portal center to avoid stray fireflies
            float maxR = uRadius * 1.35;
            vec3 fromC = pos - centerCurr;
            float d = length(fromC);
            if (d > maxR) {
              fromC *= (maxR / d);
              pos = centerCurr + fromC;
            }

            // Evitar quedarse rasantes: empuje hacia arriba si muy bajo respecto al jugador
            float minY = uPlayer.y - 0.4;
            if (pos.y < minY) {
              pos.y = mix(pos.y, minY, 0.6);
            }
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            float perspectiveSize = aSize * (0.6 + 0.7 * vLife) * (1.0 + 0.1 * uFrenzy);
            gl_PointSize = perspectiveSize * (180.0 / max(1.0, -mvPosition.z)) * uPixelRatio;
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform vec3 uColor;
          uniform vec3 uTargetColor;
          uniform float uMix;
          varying float vLife;
          varying float vFrenzy;
          void main() {
            // Circular sprite (disc) with sharper falloff for crisp firefly
            vec2 uv = gl_PointCoord * 2.0 - 1.0;
            float d = length(uv);
            if (d > 1.0) discard;
            float core = pow(1.0 - d, 5.0);
            float halo = pow(1.0 - d, 2.0) * 0.2;
            float alpha = clamp(core + halo, 0.0, 1.0);
            // Twinkle/brightness modulation
            float brighten = 0.7 + 0.9 * vLife + 0.6 * vFrenzy;
            vec3 mixCol = mix(uColor, uTargetColor, clamp(uMix, 0.0, 1.0));
            vec3 col = mixCol * brighten;
            gl_FragColor = vec4(col, alpha);
          }
        `
      }
    )
  ] });
}
function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function MusicPlayer({ tracks = [], navHeight, autoStart = false }) {
  const [index, setIndex] = reactExports.useState(0);
  const [isPlaying, setIsPlaying] = reactExports.useState(false);
  const [currentTime, setCurrentTime] = reactExports.useState(0);
  const [duration, setDuration] = reactExports.useState(0);
  const audioRef = reactExports.useRef(null);
  const [isMobile, setIsMobile] = reactExports.useState(false);
  const [isPressing, setIsPressing] = reactExports.useState(false);
  const [isHoverOver, setIsHoverOver] = reactExports.useState(false);
  const [discExpanded, setDiscExpanded] = reactExports.useState(false);
  const [ctxReady, setCtxReady] = reactExports.useState(false);
  const fallbackSetRef = reactExports.useRef(/* @__PURE__ */ new Set());
  const hasTracks = tracks && tracks.length > 0;
  const current = hasTracks ? tracks[Math.min(index, tracks.length - 1)] : null;
  const containerRef = reactExports.useRef(null);
  const heightPx = Math.max(40, Math.min(80, typeof navHeight === "number" ? navHeight : 56));
  const verticalPadding = 8;
  const mobileDiscBase = Math.max(110, Math.min(180, Math.round((Math.min(window.innerWidth || 360, 360) - 80) * 0.55)));
  const isHoveringMobile = isMobile;
  const mobileFactor = isHoveringMobile ? 1.12 : 1;
  const discSize = isMobile ? Math.round(mobileDiscBase * mobileFactor) : Math.max(36, Math.min(72, heightPx - verticalPadding * 2));
  const deltaPushPx = isMobile ? Math.max(0, discSize - mobileDiscBase) : 0;
  const pushMarginPx = isMobile ? isHoveringMobile ? Math.max(32, Math.round(deltaPushPx + 32)) : 16 : void 0;
  const resolveUrl2 = (path) => {
    if (!path) return null;
    try {
      const base = (typeof window !== "undefined" ? window.location.origin : "") + "/development/";
      return encodeURI(new URL(path.replace(/^\/+/, ""), base).href);
    } catch {
      return path;
    }
  };
  async function handleDownloadCurrentTrack(e) {
    try {
      e?.preventDefault?.();
    } catch {
    }
    const track = current;
    const src = track?.src;
    if (!src) return;
    const url = resolveUrl2(src);
    const nameFromSrc = (() => {
      try {
        const u = new URL(url);
        const parts = (u.pathname || "").split("/");
        return decodeURIComponent(parts[parts.length - 1] || "track.mp3");
      } catch {
        const parts = (src || "").split("/");
        return decodeURIComponent(parts[parts.length - 1] || "track.mp3");
      }
    })();
    const fileName = (track?.title ? `${track.title}.mp3` : nameFromSrc).replace(/[\/:*?"<>|]+/g, " ").trim() || "track.mp3";
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("download-fetch-failed");
      const blob = await res.blob();
      const type = blob?.type && blob.type !== "application/octet-stream" ? blob.type : "audio/mpeg";
      const fixed = blob && blob.type === type ? blob : new Blob([blob], { type });
      const objUrl = URL.createObjectURL(fixed);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        try {
          URL.revokeObjectURL(objUrl);
        } catch {
        }
      }, 2500);
    } catch {
      try {
        window.open(url, "_blank", "noopener");
      } catch {
      }
    }
  }
  reactExports.useRef(null);
  const isDraggingRef = reactExports.useRef(false);
  const centerRef = reactExports.useRef({ x: 0, y: 0 });
  const draggingFromRef = reactExports.useRef({ x: 0, y: 0 });
  const tapStartRef = reactExports.useRef({ x: 0, y: 0, t: 0 });
  const angleRef = reactExports.useRef(0);
  const anglePrevRef = reactExports.useRef(0);
  const tsPrevRef = reactExports.useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const speedsRef = reactExports.useRef([]);
  const playbackSpeedRef = reactExports.useRef(1);
  const isReversedRef = reactExports.useRef(false);
  const [angleDeg, setAngleDeg] = reactExports.useState(0);
  const maxAngleRef = reactExports.useRef(Math.PI * 2);
  const rafIdRef = reactExports.useRef(0);
  const lastScratchTsRef = reactExports.useRef(0);
  const SCRATCH_GUARD_MS = 1200;
  const ctxRef = reactExports.useRef(null);
  const gainRef = reactExports.useRef(null);
  const bufFRef = reactExports.useRef(null);
  const bufRRef = reactExports.useRef(null);
  const srcRef = reactExports.useRef(null);
  const revRef = reactExports.useRef(false);
  const waBufferCacheRef = reactExports.useRef(/* @__PURE__ */ new Map());
  const coverCacheRef = reactExports.useRef(/* @__PURE__ */ new Map());
  const switchingRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(Boolean(mql.matches));
    update();
    try {
      mql.addEventListener("change", update);
    } catch {
      window.addEventListener("resize", update);
    }
    return () => {
      try {
        mql.removeEventListener("change", update);
      } catch {
        window.removeEventListener("resize", update);
      }
    };
  }, []);
  reactExports.useEffect(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    gainRef.current = g;
    setCtxReady(true);
    return () => {
      try {
        srcRef.current?.stop(0);
      } catch {
      }
      try {
        ctx.close();
      } catch {
      }
      setCtxReady(false);
    };
  }, []);
  async function loadTrack(urlIn, opts = { activate: true }) {
    if (!urlIn) return false;
    const url = (() => {
      try {
        const base = (typeof window !== "undefined" ? window.location.origin : "") + "/development/";
        return new URL(urlIn.replace(/^\/+/, ""), base).href;
      } catch {
        return urlIn;
      }
    })();
    try {
      const ctx = ctxRef.current;
      if (!ctx) return false;
      const cached = waBufferCacheRef.current.get(url);
      if (cached) {
        if (opts.activate) {
          bufFRef.current = cached.f;
          bufRRef.current = cached.r;
          setDuration(cached.f.duration || 0);
          const v = 0.75;
          maxAngleRef.current = (cached.f.duration || 0) * v * Math.PI * 2;
        }
        return true;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch-failed");
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const src = buf.getChannelData(ch);
        const dst = rev.getChannelData(ch);
        for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j];
      }
      waBufferCacheRef.current.set(url, { f: buf, r: rev });
      if (opts.activate) {
        bufFRef.current = buf;
        bufRRef.current = rev;
        setDuration(buf.duration || 0);
        const v = 0.75;
        maxAngleRef.current = (buf.duration || 0) * v * Math.PI * 2;
      }
      return true;
    } catch {
      return false;
    }
  }
  async function ensureCoverLoaded(track) {
    if (!track) return;
    const src = track.cover || track.src;
    if (!src) return;
    const url = (() => {
      try {
        return new URL((track.cover || track.src).replace(/^\/+/, ""), "/development/").href;
      } catch {
        return track.cover || track.src;
      }
    })();
    if (coverCacheRef.current.get(url)) return;
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error("cover-failed");
      coverCacheRef.current.set(url, true);
    } catch {
    }
  }
  function changeDirection(rev, seconds) {
    if (revRef.current === rev) return;
    revRef.current = rev;
    playFrom(seconds);
  }
  const stoppingRef = reactExports.useRef(false);
  function pauseWA() {
    try {
      stoppingRef.current = true;
      srcRef.current?.stop(0);
    } catch {
    }
    srcRef.current = null;
  }
  function playFrom(seconds = 0) {
    if (current && fallbackSetRef.current.has(current.src)) {
      try {
        const el = audioRef.current;
        if (!el) return;
        if (el.src !== resolveUrl2(current.src)) el.src = resolveUrl2(current.src);
        el.currentTime = Math.max(0, Math.min((duration || 0) - 0.01, seconds || 0));
        el.play().catch(() => {
        });
      } catch {
      }
      return;
    }
    const ctx = ctxRef.current;
    const g = gainRef.current;
    const buf = revRef.current ? bufRRef.current : bufFRef.current;
    if (!ctx || !g || !buf) return;
    pauseWA();
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.connect(g);
    const eps = 1e-3;
    const offs = Math.max(0, Math.min(buf.duration - eps, revRef.current ? buf.duration - seconds : seconds));
    s.playbackRate.value = 1;
    s.start(0, offs);
    try {
      s.onended = () => {
        if (stoppingRef.current) {
          stoppingRef.current = false;
          return;
        }
        if (switchingRef.current) return;
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (isDraggingRef.current || now - lastScratchTsRef.current < SCRATCH_GUARD_MS) {
          return;
        }
        if (!tracks || tracks.length <= 1) return;
        switchingRef.current = true;
        setIndex((i) => (i + 1) % tracks.length);
      };
    } catch {
    }
    srcRef.current = s;
  }
  function updateSpeed(rate, reversed, seconds) {
    if (current && fallbackSetRef.current.has(current.src)) {
      return;
    }
    const ctx = ctxRef.current;
    if (!ctx) return;
    changeDirection(reversed, seconds);
    const s = srcRef.current;
    if (!s) return;
    const now = ctx.currentTime;
    const eggSlow = typeof window !== "undefined" && window.__eggActiveGlobal ? 0.5 : 1;
    const r = Math.max(1e-3, Math.min(4, Math.abs(rate) * eggSlow));
    try {
      s.playbackRate.cancelScheduledValues(now);
      s.playbackRate.linearRampToValueAtTime(r, now + 0.05);
    } catch {
    }
  }
  reactExports.useEffect(() => {
    if (!current?.src) return;
    loadTrack(current.src, { activate: true });
  }, [current?.src]);
  const autoplayedRef = reactExports.useRef(false);
  const autoplayRetriesRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    if (autoplayedRef.current) return;
    if (!autoStart) return;
    if (!ctxReady) return;
    const first = tracks && tracks.length ? tracks[0] : null;
    if (!first) return;
    const idx = 0;
    const attempt = async () => {
      try {
        const ok = await loadTrack(first.src, { activate: true });
        if (!ok || !bufFRef.current && !bufRRef.current) {
          if (autoplayRetriesRef.current < 3) {
            autoplayRetriesRef.current += 1;
            setTimeout(attempt, 400);
          } else {
            try {
              fallbackSetRef.current.add(first.src);
            } catch {
            }
            try {
              const el = audioRef.current;
              if (el) {
                el.src = resolveUrl2(first.src);
                el.onloadedmetadata = () => {
                  try {
                    setDuration(el.duration || 0);
                  } catch {
                  }
                };
                angleRef.current = 0;
                anglePrevRef.current = 0;
                setAngleDeg(0);
                setCurrentTime(0);
                setIndex(idx);
                el.play().then(() => {
                  setIsPlaying(true);
                  autoplayedRef.current = true;
                }).catch(() => {
                });
              }
            } catch {
            }
          }
          return;
        }
        await ensureCoverLoaded(first);
        angleRef.current = 0;
        anglePrevRef.current = 0;
        setAngleDeg(0);
        setCurrentTime(0);
        if (idx >= 0) setIndex(idx);
        try {
          await ctxRef.current?.resume();
        } catch {
        }
        setIsPlaying(true);
        playFrom(0);
        autoplayedRef.current = true;
      } catch {
        if (autoplayRetriesRef.current < 3) {
          autoplayRetriesRef.current += 1;
          setTimeout(attempt, 400);
        }
      }
    };
    setTimeout(attempt, 200);
  }, [tracks, autoStart, ctxReady]);
  function onDown(e) {
    isDraggingRef.current = true;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const cx = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const cy = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    draggingFromRef.current = { x: cx, y: cy };
    tapStartRef.current = { x: cx, y: cy, t: typeof performance !== "undefined" ? performance.now() : Date.now() };
    if (isMobile) setIsPressing(true);
    lastScratchTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!isDraggingRef.current) return;
    const n = { x: e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0, y: e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0 };
    const o = Math.atan2(n.y - centerRef.current.y, n.x - centerRef.current.x);
    const a = Math.atan2(draggingFromRef.current.y - centerRef.current.y, draggingFromRef.current.x - centerRef.current.x);
    const l = Math.atan2(Math.sin(a - o), Math.cos(a - o));
    angleRef.current = Math.max(0, Math.min(angleRef.current - l, maxAngleRef.current));
    draggingFromRef.current = { ...n };
    setAngleDeg(angleRef.current * 180 / Math.PI);
    lastScratchTsRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
    e.preventDefault();
  }
  function onUp(e) {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
    }
    const nx = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? draggingFromRef.current.x;
    const ny = e.clientY ?? (e.changedTouches && e.changedTouches[0]?.clientY) ?? draggingFromRef.current.y;
    nx - tapStartRef.current.x;
    ny - tapStartRef.current.y;
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - tapStartRef.current.t;
    if (isMobile) setIsPressing(false);
    e.preventDefault();
  }
  reactExports.useEffect(() => {
    const TWO_PI = Math.PI * 2;
    const v = 0.75;
    const C = v * 60;
    const L = C * TWO_PI;
    const M = L / 60;
    const b = M * 1e-3;
    const clamp = (v2, lo, hi) => Math.max(lo, Math.min(v2, hi));
    const movingAvg = (arr, win) => {
      const s = Math.max(0, arr.length - win);
      return arr.slice(s);
    };
    const loop = () => {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (!isDraggingRef.current && isPlaying) {
        const t2 = now - tsPrevRef.current;
        let s2 = b * t2 * playbackSpeedRef.current;
        s2 += 0.1;
        s2 = clamp(s2, 0, b * t2);
        angleRef.current = clamp(angleRef.current + s2, 0, maxAngleRef.current);
      }
      const t = now - tsPrevRef.current;
      const s = angleRef.current - anglePrevRef.current;
      const n = M * 1e-3 * t;
      const speed = s / (n || 1);
      const arr = movingAvg(speedsRef.current.concat(speed), 10);
      speedsRef.current = arr;
      const avg = arr.reduce((a, b2) => a + b2, 0) / (arr.length || 1);
      playbackSpeedRef.current = clamp(avg, -4, 4);
      isReversedRef.current = angleRef.current < anglePrevRef.current;
      anglePrevRef.current = angleRef.current;
      tsPrevRef.current = now;
      setAngleDeg(angleRef.current * 180 / Math.PI);
      const secondsPlayed = angleRef.current / TWO_PI / v;
      updateSpeed(playbackSpeedRef.current, isReversedRef.current, secondsPlayed);
      setCurrentTime(secondsPlayed);
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [isPlaying]);
  const switchAttemptsRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    if (!hasTracks) return;
    const t = tracks[Math.min(index, tracks.length - 1)];
    if (!t) return;
    const url = t.src;
    (async () => {
      switchingRef.current = true;
      const fullUrl = (() => {
        try {
          const base = (typeof window !== "undefined" ? window.location.origin : "") + "/development/";
          return new URL(url.replace(/^\/+/, ""), base).href;
        } catch {
          return url;
        }
      })();
      const cached = waBufferCacheRef.current.get(fullUrl);
      pauseWA();
      if (fallbackSetRef.current.has(t.src)) {
        try {
          const el = audioRef.current;
          if (el) {
            el.src = resolveUrl2(t.src);
            el.onloadedmetadata = () => {
              try {
                setDuration(el.duration || 0);
              } catch {
              }
            };
            angleRef.current = 0;
            anglePrevRef.current = 0;
            setAngleDeg(0);
            setCurrentTime(0);
            if (isPlaying) el.play().catch(() => {
            });
            switchAttemptsRef.current = 0;
            switchingRef.current = false;
            return;
          }
        } catch {
        }
      }
      let ok = true;
      if (!cached) ok = await loadTrack(url, { activate: true });
      else {
        bufFRef.current = cached.f;
        bufRRef.current = cached.r;
        setDuration(cached.f.duration || 0);
        const v = 0.75;
        maxAngleRef.current = (cached.f.duration || 0) * v * Math.PI * 2;
      }
      if (!bufFRef.current && !bufRRef.current || !ok) {
        try {
          fallbackSetRef.current.add(t.src);
        } catch {
        }
        try {
          const el = audioRef.current;
          if (el) {
            el.src = resolveUrl2(t.src);
            el.onloadedmetadata = () => {
              try {
                setDuration(el.duration || 0);
              } catch {
              }
            };
            angleRef.current = 0;
            anglePrevRef.current = 0;
            setAngleDeg(0);
            setCurrentTime(0);
            if (isPlaying) el.play().catch(() => {
            });
            switchAttemptsRef.current = 0;
            switchingRef.current = false;
            return;
          }
        } catch {
        }
      }
      await ensureCoverLoaded(t);
      angleRef.current = 0;
      anglePrevRef.current = 0;
      setAngleDeg(0);
      setCurrentTime(0);
      if (isPlaying) playFrom(0);
      switchAttemptsRef.current = 0;
      switchingRef.current = false;
    })();
  }, [index]);
  reactExports.useEffect(() => {
    const t = current;
    if (!t) return () => {
    };
    if (!fallbackSetRef.current.has(t.src)) return () => {
    };
    const el = audioRef.current;
    if (!el) return () => {
    };
    const onTime = () => {
      try {
        setCurrentTime(el.currentTime || 0);
      } catch {
      }
    };
    const onEnd = () => {
      try {
        setIsPlaying(false);
      } catch {
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [current?.src]);
  reactExports.useEffect(() => {
    if (!current) return;
    if (switchingRef.current) return;
    if (isPlaying) {
      if (fallbackSetRef.current.has(current.src)) {
        try {
          const el = audioRef.current;
          if (el) {
            if (el.src !== resolveUrl2(current.src)) el.src = resolveUrl2(current.src);
            el.play().catch(() => {
            });
          }
        } catch {
        }
        return;
      }
      try {
        if (ctxRef.current?.state === "suspended") ctxRef.current.resume().catch(() => {
        });
      } catch {
      }
      const secondsPlayed = currentTime;
      playFrom(secondsPlayed);
    } else {
      if (fallbackSetRef.current.has(current.src)) {
        try {
          audioRef.current?.pause();
        } catch {
        }
      } else {
        pauseWA();
      }
    }
  }, [isPlaying, current]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: containerRef,
      className: isMobile ? "music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-xl shadow-lg grid grid-rows-[auto_auto_auto_auto] gap-4 w-[min(360px,92vw)] p-10 select-none text-black" : "music-pill pointer-events-auto relative bg-white/95 backdrop-blur rounded-full shadow-lg flex items-center gap-2 max-w-[92vw] select-none text-black",
      style: isMobile ? { paddingBottom: discExpanded ? "24px" : void 0 } : { height: `${heightPx}px`, padding: `${verticalPadding}px`, width: "420px", overflow: "visible" },
      children: [
        (() => {
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: isMobile ? "disc-wrap always-expanded justify-self-center relative select-none transition-all" : "disc-wrap always-expanded shrink-0 relative select-none origin-left",
              style: { width: `${discSize}px`, height: `${discSize}px`, marginBottom: isMobile ? `${pushMarginPx}px` : void 0 },
              onPointerEnter: () => {
                if (isMobile) setIsHoverOver(true);
              },
              onPointerLeave: () => {
                if (isMobile) setIsHoverOver(false);
              },
              onTouchStart: () => {
                if (isMobile) setIsHoverOver(true);
              },
              onTouchEnd: () => {
                if (isMobile) setIsHoverOver(false);
              },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { id: "disc", className: `disc ${isDraggingRef.current ? "is-scratching" : ""}`, style: { width: "100%", height: "100%", transform: `rotate(${angleDeg}deg)` }, children: [
                  current?.cover ? /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: resolveUrl2(current.cover), alt: "cover", className: "disc__label" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(CoverFromMeta, { src: current?.src, className: "disc__label" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "disc__middle" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "disc__glare", style: { width: `${discSize}px` } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0", style: { cursor: isDraggingRef.current ? "grabbing" : "grab", touchAction: "none" }, onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onTouchStart: () => {
                } })
              ]
            }
          );
        })(),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: isMobile ? "text-center w-full" : "pill-content right-ui flex-1 min-w-0", style: isMobile ? { marginTop: `${isHoveringMobile ? Math.max(16, Math.round(deltaPushPx * 0.2 + 16)) : 8}px` } : void 0, children: isMobile ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto inline-block max-w-[260px] whitespace-nowrap font-marquee text-[33px] sm:text-[13px] opacity-95 will-change-transform", style: { animation: "marquee 12s linear infinite" }, children: Array.from({ length: 2 }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "mx-2", children: [
          current ? current.title || "Unknown title" : "No tracks",
          current?.artist ? ` — ${current.artist}` : ""
        ] }, i)) }) }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "whitespace-nowrap font-marquee text-[13px] opacity-95 will-change-transform", style: { animation: "marquee 12s linear infinite" }, children: Array.from({ length: 2 }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "mx-3", children: [
            current ? current.title || "Unknown title" : "No tracks",
            current?.artist ? ` — ${current.artist}` : ""
          ] }, i)) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 h-[3px] rounded-full bg-black/10 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-black/70", style: { width: `${Math.max(0, Math.min(100, duration ? currentTime / duration * 100 : 0))}%` } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-0.5 flex items-center justify-between text-[10px] text-black/70 tabular-nums leading-4 whitespace-nowrap", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0", children: formatTime(currentTime) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "a",
              {
                href: resolveUrl2(current?.src) || "#",
                download: true,
                onClick: handleDownloadCurrentTrack,
                className: "mx-2 grow text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors truncate",
                title: current?.title ? `Download: ${current.title}` : "Download this track",
                children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-1 justify-center", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$1, { className: "w-3.5 h-3.5" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Download this track" })
                ] })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0", children: formatTime(duration) })
          ] })
        ] }) }),
        isMobile && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "a",
          {
            href: resolveUrl2(current?.src) || "#",
            download: true,
            onClick: handleDownloadCurrentTrack,
            className: "text-center underline underline-offset-2 decoration-black/30 hover:decoration-black transition-colors text-[12px]",
            title: current?.title ? `Download: ${current.title}` : "Download this track",
            children: "Download this track"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: isMobile ? "flex items-center justify-center gap-1.5" : "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "p-2 rounded-full hover:bg-black/10 disabled:opacity-40", disabled: !hasTracks || switchingRef.current || isDraggingRef.current || (typeof performance !== "undefined" ? performance.now() : Date.now()) - lastScratchTsRef.current < SCRATCH_GUARD_MS, onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          }, onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            if (!hasTracks) return;
            if (switchingRef.current) return;
            if (isDraggingRef.current) return;
            if ((typeof performance !== "undefined" ? performance.now() : Date.now()) - lastScratchTsRef.current < SCRATCH_GUARD_MS) return;
            stoppingRef.current = true;
            pauseWA();
            switchingRef.current = true;
            setIndex((i) => (i - 1 + tracks.length) % tracks.length);
            setIsPlaying(true);
          }, "aria-label": "Previous", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$2, { className: "w-5 h-5" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "p-2 rounded-full hover:bg-black/10 disabled:opacity-50", onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          }, onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            setIsPlaying((v) => !v);
          }, disabled: !hasTracks, "aria-label": isPlaying ? "Pause" : "Play", children: isPlaying ? /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$3, { className: "w-6 h-6" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$4, { className: "w-6 h-6" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "p-2 rounded-full hover:bg-black/10 disabled:opacity-40", disabled: !hasTracks || switchingRef.current || isDraggingRef.current || (typeof performance !== "undefined" ? performance.now() : Date.now()) - lastScratchTsRef.current < SCRATCH_GUARD_MS, onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          }, onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            if (!hasTracks) return;
            if (switchingRef.current) return;
            if (isDraggingRef.current) return;
            if ((typeof performance !== "undefined" ? performance.now() : Date.now()) - lastScratchTsRef.current < SCRATCH_GUARD_MS) return;
            stoppingRef.current = true;
            pauseWA();
            switchingRef.current = true;
            setIndex((i) => (i + 1) % tracks.length);
            setIsPlaying(true);
          }, "aria-label": "Next", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$5, { className: "w-5 h-5" }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("audio", { ref: audioRef, preload: "metadata" })
      ]
    }
  );
}
function CoverFromMeta({ src, className }) {
  const [dataUrl, setDataUrl] = React.useState(null);
  const cacheRef = React.useRef(/* @__PURE__ */ new Map());
  React.useEffect(() => {
    let cancelled = false;
    if (!src) {
      setDataUrl(null);
      return;
    }
    setDataUrl(null);
    const key = src;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    (async () => {
      try {
        const url = (() => {
          try {
            const path = src.replace(/^\/+/, "");
            return encodeURI(new URL(path, "/development/").href);
          } catch {
            return encodeURI(src);
          }
        })();
        const res = await fetch(url);
        if (!res.ok) throw new Error("fetch-failed");
        const blob = await res.blob();
        const { default: jsmediatags } = await __vitePreload(async () => {
          const { default: jsmediatags2 } = await import("./vendor-kJyMmUE3.js").then((n) => n.j);
          return { default: jsmediatags2 };
        }, true ? [] : void 0);
        jsmediatags.read(blob, {
          onSuccess: ({ tags }) => {
            if (cancelled) return;
            const pic = tags.picture;
            if (pic && pic.data && pic.format) {
              const byteArray = new Uint8Array(pic.data);
              const imgBlob = new Blob([byteArray], { type: pic.format });
              const urlObj = URL.createObjectURL(imgBlob);
              cacheRef.current.set(key, urlObj);
              setDataUrl(urlObj);
            } else {
              setDataUrl(null);
            }
          },
          onError: () => {
            if (!cancelled) setDataUrl(null);
          }
        });
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);
  if (dataUrl) return /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: dataUrl, alt: "cover", className: className || "" });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: className ? `${className} grid place-items-center` : "grid place-items-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" }) });
}
function MobileJoystick({ bottomPx = 140, leftPx = 16, radius = 64, centerX = false }) {
  const padRef = React.useRef(null);
  const knobRef = React.useRef(null);
  const activeRef = React.useRef(false);
  const centerRef = React.useRef({ x: 0, y: 0 });
  const dirRef = React.useRef({ up: false, down: false, left: false, right: false });
  const setKeys = React.useCallback((u, d, l, r) => {
    const prev = dirRef.current;
    const emit = (type, key) => {
      try {
        window.dispatchEvent(new KeyboardEvent(type, { key }));
      } catch {
      }
    };
    if (u !== prev.up) emit(u ? "keydown" : "keyup", "w");
    if (d !== prev.down) emit(d ? "keydown" : "keyup", "s");
    if (l !== prev.left) emit(l ? "keydown" : "keyup", "a");
    if (r !== prev.right) emit(r ? "keydown" : "keyup", "d");
    dirRef.current = { up: u, down: d, left: l, right: r };
  }, []);
  const reset = React.useCallback(() => {
    setKeys(false, false, false, false);
    if (knobRef.current) knobRef.current.style.transform = "translate(-50%, -50%) translate(0px, 0px)";
  }, [setKeys]);
  React.useEffect(() => () => reset(), [reset]);
  const updateFromPoint = React.useCallback((clientX, clientY) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    centerRef.current = { x: cx, y: cy };
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const maxR = radius * 0.8;
    const clamped = dist > maxR ? maxR : dist;
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    if (knobRef.current) knobRef.current.style.transform = `translate(-50%, -50%) translate(${kx}px, ${ky}px)`;
    const dead = 10;
    const up = dy < -dead;
    const down = dy > dead;
    const left = dx < -dead;
    const right = dx > dead;
    setKeys(up, down, left, right);
  }, [radius, setKeys]);
  const padStyle = centerX ? { left: "50%", transform: "translateX(-50%)", bottom: `${bottomPx}px`, width: `${radius * 2}px`, height: `${radius * 2}px` } : { left: `${leftPx}px`, bottom: `${bottomPx}px`, width: `${radius * 2}px`, height: `${radius * 2}px` };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      ref: padRef,
      className: "fixed z-[12000] select-none touch-none",
      style: padStyle,
      onPointerDown: (e) => {
        activeRef.current = true;
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId);
        } catch {
        }
        updateFromPoint(e.clientX, e.clientY);
        e.preventDefault();
      },
      onPointerMove: (e) => {
        if (!activeRef.current) return;
        updateFromPoint(e.clientX, e.clientY);
        e.preventDefault();
      },
      onPointerUp: (e) => {
        activeRef.current = false;
        try {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        } catch {
        }
        reset();
        e.preventDefault();
      },
      onPointerCancel: (e) => {
        activeRef.current = false;
        reset();
        e.preventDefault();
      },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "absolute inset-0 rounded-full bg-white/10 backdrop-blur-sm border border-white/15",
            style: { boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            ref: knobRef,
            className: "absolute left-1/2 top-1/2 w-12 h-12 rounded-full bg-white/60 border border-white/80",
            style: { transform: "translate(-50%, -50%) translate(0px, 0px)", boxShadow: "0 6px 16px rgba(0,0,0,0.3)" }
          }
        )
      ]
    }
  );
}
function GpuStats({ gl, sampleMs = 1e3 }) {
  const [stats, setStats] = reactExports.useState({ fps: 0, calls: 0, triangles: 0, lines: 0, points: 0, geometries: 0, textures: 0 });
  const lastTRef = reactExports.useRef(performance.now());
  const frameCountRef = reactExports.useRef(0);
  const rafRef = reactExports.useRef(0);
  reactExports.useEffect(() => {
    const loop = () => {
      frameCountRef.current += 1;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  reactExports.useEffect(() => {
    let timer = null;
    const tick = () => {
      const now = performance.now();
      const dtMs = now - lastTRef.current;
      lastTRef.current = now;
      const fps = dtMs > 0 ? Math.round(frameCountRef.current * 1e3 / dtMs) : 0;
      frameCountRef.current = 0;
      try {
        const info = gl?.info;
        setStats({
          fps,
          calls: info?.render?.calls || 0,
          triangles: info?.render?.triangles || 0,
          lines: info?.render?.lines || 0,
          points: info?.render?.points || 0,
          geometries: info?.memory?.geometries || 0,
          textures: info?.memory?.textures || 0
        });
      } catch {
      }
      timer = setTimeout(tick, sampleMs);
    };
    timer = setTimeout(tick, sampleMs);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [gl, sampleMs]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { position: "fixed", top: 8, left: 8, zIndex: 2e4, pointerEvents: "auto" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "rgba(0,0,0,0.6)", color: "white", padding: "6px 8px", borderRadius: 6, fontSize: 11, lineHeight: 1.25, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "FPS: ",
      stats.fps
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Draws: ",
      stats.calls
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Tris: ",
      stats.triangles
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      "Geom: ",
      stats.geometries,
      " · Tex: ",
      stats.textures
    ] })
  ] }) });
}
function FrustumCulledGroup({ position = [0, 0, 0], radius = 5, maxDistance = 80, sampleEvery = 3, children }) {
  const groupRef = reactExports.useRef();
  const { camera } = useThree();
  const frustum = reactExports.useMemo(() => new Frustum(), []);
  const projScreenMatrix = reactExports.useMemo(() => new Matrix4(), []);
  const sphere = reactExports.useMemo(() => new Sphere(new Vector3(), radius), [radius]);
  const tmp = reactExports.useRef({ frame: 0 });
  reactExports.useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position[0] || 0, position[1] || 0, position[2] || 0);
    }
  }, [position]);
  useFrame(() => {
    if (!groupRef.current || !camera) return;
    const t = tmp.current;
    t.frame = (t.frame + 1) % Math.max(1, sampleEvery);
    if (t.frame !== 0) return;
    const worldPos = groupRef.current.getWorldPosition(new Vector3());
    const dist = camera.position.distanceTo(worldPos);
    if (dist > maxDistance) {
      groupRef.current.visible = false;
      return;
    }
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    sphere.center.copy(worldPos);
    sphere.radius = radius;
    groupRef.current.visible = frustum.intersectsSphere(sphere);
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx("group", { ref: groupRef, children });
}
const Section1 = reactExports.lazy(() => __vitePreload(() => Promise.resolve().then(() => Section1$2), true ? void 0 : void 0));
const Section2 = reactExports.lazy(() => __vitePreload(() => import("./Section2-BPEedqqC.js"), true ? __vite__mapDeps([0,1]) : void 0));
const Section3 = reactExports.lazy(() => __vitePreload(() => import("./Section3-iAd3N-7Y.js"), true ? __vite__mapDeps([2,1]) : void 0));
const Section4 = reactExports.lazy(() => __vitePreload(() => import("./Section4-BQqydh3B.js"), true ? __vite__mapDeps([3,1]) : void 0));
const sectionColors = {
  home: "#0f172a",
  section1: "#00bfff",
  // Work
  section2: "#00ff26",
  // About
  section3: "#e600ff",
  // Side Quests
  section4: "#decf00"
};
function App() {
  const isMobilePerf = reactExports.useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer:coarse)").matches;
    const saveData = navigator.connection && (navigator.connection.saveData || navigator.connection.effectiveType && /2g/.test(navigator.connection.effectiveType));
    const lowMemory = navigator.deviceMemory && navigator.deviceMemory <= 4;
    const lowThreads = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    const highDPR = window.devicePixelRatio && window.devicePixelRatio > 2;
    return Boolean(isMobileUA || coarse || saveData || lowMemory || lowThreads || highDPR);
  }, []);
  const [fx, setFx] = reactExports.useState(() => ({
    bloom: 0.78,
    vignette: 0.4,
    noise: 0,
    dotEnabled: true,
    dotScale: 0.76,
    dotAngle: 0.06,
    dotCenterX: 0.38,
    dotCenterY: 0.44,
    dotOpacity: 0.05,
    dotBlend: "screen",
    godEnabled: false,
    godDensity: 0.35,
    godDecay: 0.62,
    godWeight: 0.5,
    godExposure: 0.22,
    godClampMax: 0.56,
    godSamples: 28,
    dofEnabled: false,
    dofProgressive: false,
    dofFocusDistance: 0.375,
    dofFocalLength: 5e-3,
    dofBokehScale: 2.1,
    dofFocusSpeed: 0.12
  }));
  const [topLight, setTopLight] = reactExports.useState({ height: 3.35, intensity: 8, angle: 1.2, penumbra: 0.6 });
  const [showFxPanel, setShowFxPanel] = reactExports.useState(false);
  const [showLightPanel, setShowLightPanel] = reactExports.useState(false);
  const [showPortraitPanel, setShowPortraitPanel] = reactExports.useState(false);
  const [portraitGlowV, setPortraitGlowV] = reactExports.useState(0);
  const [copiedFx, setCopiedFx] = reactExports.useState(false);
  const [navTarget, setNavTarget] = reactExports.useState(null);
  const [orbActiveUi, setOrbActiveUi] = reactExports.useState(false);
  const glRef = reactExports.useRef(null);
  const [showMusic, setShowMusic] = reactExports.useState(false);
  const [showGpu, setShowGpu] = reactExports.useState(false);
  const [tracks, setTracks] = reactExports.useState([]);
  const [menuOpen, setMenuOpen] = reactExports.useState(false);
  const [isMobile, setIsMobile] = reactExports.useState(false);
  const [showSectionUi, setShowSectionUi] = reactExports.useState(false);
  const [sectionUiAnimatingOut, setSectionUiAnimatingOut] = reactExports.useState(false);
  const [sectionUiFadeIn, setSectionUiFadeIn] = reactExports.useState(false);
  const sectionScrollRef = reactExports.useRef(null);
  const [uiHintPortalId, setUiHintPortalId] = reactExports.useState(null);
  reactExports.useRef(null);
  const [section, setSection] = reactExports.useState("home");
  const [transitionState, setTransitionState] = reactExports.useState({ active: false, from: "home", to: null });
  const handleExitSection = React.useCallback(() => {
    if (transitionState.active) return;
    if (section !== "home") {
      setBlackoutImmediate(true);
      setBlackoutVisible(true);
      setShowSectionUi(false);
      try {
        lastExitedSectionRef.current = section;
      } catch {
      }
      setShowMarquee(false);
      setMarqueeAnimatingOut(false);
      setMarqueeForceHidden(true);
      setSectionUiAnimatingOut(false);
      setSectionUiFadeIn(false);
      try {
        if (blackoutTimerRef.current) {
          clearTimeout(blackoutTimerRef.current);
          blackoutTimerRef.current = null;
        }
      } catch {
      }
      setTimeout(() => {
        setBlackoutVisible(false);
        setBlackoutImmediate(false);
      }, 1400);
      setNavTarget("home");
      setSection("home");
      try {
        syncUrl("home");
      } catch {
      }
    }
  }, [section, transitionState.active]);
  reactExports.useEffect(() => {
    const onExit = () => handleExitSection();
    window.addEventListener("exit-section", onExit);
    return () => window.removeEventListener("exit-section", onExit);
  }, [handleExitSection]);
  const [eggActive, setEggActive] = reactExports.useState(false);
  reactExports.useEffect(() => {
    try {
      window.__eggActiveGlobal = eggActive;
    } catch {
    }
  }, [eggActive]);
  reactExports.useEffect(() => {
    try {
      const cls = "glitch-font";
      const root = document.documentElement;
      const body = document.body;
      if (eggActive) {
        root.classList.add(cls);
        body.classList.add(cls);
      } else {
        root.classList.remove(cls);
        body.classList.remove(cls);
      }
    } catch {
    }
  }, [eggActive]);
  const mainControlsRef = reactExports.useRef(null);
  const [nearPortalId, setNearPortalId] = reactExports.useState(null);
  const [showSectionBanner, setShowSectionBanner] = reactExports.useState(false);
  const bannerTimerRef = reactExports.useRef(null);
  const [showCta, setShowCta] = reactExports.useState(false);
  const [ctaAnimatingOut, setCtaAnimatingOut] = reactExports.useState(false);
  const ctaHideTimerRef = reactExports.useRef(null);
  const [ctaLoading, setCtaLoading] = reactExports.useState(false);
  const [ctaProgress, setCtaProgress] = reactExports.useState(0);
  const [ctaColor, setCtaColor] = reactExports.useState("#ffffff");
  const ctaProgTimerRef = reactExports.useRef(null);
  const [showMarquee, setShowMarquee] = reactExports.useState(false);
  const [marqueeAnimatingOut, setMarqueeAnimatingOut] = reactExports.useState(false);
  const marqueeHideTimerRef = reactExports.useRef(null);
  const [marqueeLabelSection, setMarqueeLabelSection] = reactExports.useState(null);
  const lastExitedSectionRef = reactExports.useRef(null);
  const [marqueePinned, setMarqueePinned] = reactExports.useState({ active: false, label: null });
  const [marqueeForceHidden, setMarqueeForceHidden] = reactExports.useState(false);
  const [landingBannerActive, setLandingBannerActive] = reactExports.useState(false);
  const [scrollbarW, setScrollbarW] = reactExports.useState(0);
  const [sectionScrollProgress, setSectionScrollProgress] = reactExports.useState(0);
  const [blackoutVisible, setBlackoutVisible] = reactExports.useState(false);
  const [blackoutImmediate, setBlackoutImmediate] = reactExports.useState(false);
  const blackoutTimerRef = reactExports.useRef(null);
  const [bootLoading, setBootLoading] = reactExports.useState(true);
  const [bootProgress, setBootProgress] = reactExports.useState(0);
  const [bootAllDone, setBootAllDone] = reactExports.useState(false);
  const [characterReady, setCharacterReady] = reactExports.useState(false);
  const [audioReady, setAudioReady] = reactExports.useState(false);
  const preloaderPlayerRef = reactExports.useRef();
  const preloaderHeadRef = reactExports.useRef();
  const preSunRef = reactExports.useRef();
  const [preOrbitPaused, setPreOrbitPaused] = reactExports.useState(false);
  const [preloaderFadingOut, setPreloaderFadingOut] = reactExports.useState(false);
  const preloaderStartedRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    try {
      window.pausePreloaderCamera = () => setPreOrbitPaused(true);
      window.resumePreloaderCamera = () => setPreOrbitPaused(false);
    } catch {
    }
  }, []);
  reactExports.useEffect(() => {
    let cancelled = false;
    (async () => {
      let done = 0;
      let total = 0;
      const bump = () => {
        done += 1;
        if (cancelled) return;
        const pct = Math.round(done / Math.max(1, total) * 100);
        setBootProgress((p) => pct > p ? pct : p);
      };
      const safe = async (p) => {
        try {
          await p;
        } catch {
        } finally {
          bump();
        }
      };
      const tasks = [];
      const addTask = (promiseFactory) => {
        total += 1;
        tasks.push(safe(promiseFactory()));
      };
      try {
        const glbList = [
          `${"/development/"}character.glb`,
          `${"/development/"}characterStone.glb`,
          `${"/development/"}grave_lowpoly.glb`,
          `${"/development/"}3dmodels/housebird.glb`,
          `${"/development/"}3dmodels/housebirdPink.glb`,
          `${"/development/"}3dmodels/housebirdWhite.glb`
        ];
        const hdrList = [
          `${"/development/"}light.hdr`,
          `${"/development/"}light_.hdr`
        ];
        const imageList = [
          `${"/development/"}Etherean.jpg`,
          `${"/development/"}slap.svg`
        ];
        const fxList = ["hover", "click", "magiaInicia", "sparkleBom", "sparkleFall", "stepone", "stepSoft", "steptwo"];
        const otherAudio = [
          `${"/development/"}punch.mp3`,
          `${"/development/"}scratchfail.wav`
        ];
        const sectionImports = [
          () => __vitePreload(() => Promise.resolve().then(() => Section1$2), true ? void 0 : void 0),
          () => __vitePreload(() => import("./Section2-BPEedqqC.js"), true ? __vite__mapDeps([0,1]) : void 0),
          () => __vitePreload(() => import("./Section3-iAd3N-7Y.js"), true ? __vite__mapDeps([2,1]) : void 0),
          () => __vitePreload(() => import("./Section4-BQqydh3B.js"), true ? __vite__mapDeps([3,1]) : void 0)
        ];
        const workUrls = typeof getWorkImageUrls === "function" ? getWorkImageUrls() || [] : [];
        glbList.forEach((url) => addTask(() => Promise.resolve().then(() => useGLTF.preload(url))));
        hdrList.forEach((url) => addTask(() => fetch(url, { cache: "force-cache" }).then((r) => r.blob())));
        sectionImports.forEach((fn) => addTask(() => fn()));
        const loadImg = (u, ms = 8e3) => new Promise((resolve) => {
          const img = new Image();
          let finished = false;
          const finish = () => {
            if (!finished) {
              finished = true;
              resolve(true);
            }
          };
          const t = setTimeout(finish, ms);
          img.onload = () => {
            clearTimeout(t);
            finish();
          };
          img.onerror = () => {
            clearTimeout(t);
            finish();
          };
          img.src = u;
        });
        imageList.forEach((u) => addTask(() => loadImg(u)));
        workUrls.forEach((u) => addTask(() => loadImg(u)));
        addTask(() => Promise.resolve().then(() => preloadSfx(fxList)));
        fxList.forEach((name) => addTask(() => fetch(`${"/development/"}fx/${name}.wav`, { cache: "force-cache" }).then((r) => r.blob())));
        otherAudio.forEach((u) => addTask(() => fetch(u, { cache: "force-cache" }).then((r) => r.blob())));
        addTask(() => fetch(`${"/development/"}songs/manifest.json`, { cache: "no-cache" }).then((r) => r.json()).then(() => {
        }));
        await Promise.all(tasks);
        if (!cancelled) setBootAllDone(true);
      } catch {
        if (!cancelled) setBootAllDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  reactExports.useEffect(() => {
    if (!bootAllDone || !audioReady) return;
    if (preloaderStartedRef.current) return;
    preloaderStartedRef.current = true;
    setBootProgress(100);
    const t = setTimeout(() => {
      setBlackoutVisible(true);
      setPreloaderFadingOut(true);
      setNavTarget("home");
      setTimeout(() => {
        setBootLoading(false);
        setPreloaderFadingOut(false);
      }, 1e3);
    }, 180);
    return () => clearTimeout(t);
  }, [bootAllDone, audioReady]);
  const scrollTrackRef = reactExports.useRef(null);
  const [scrollThumb, setScrollThumb] = reactExports.useState({ height: 12, top: 0 });
  const isDraggingThumbRef = reactExports.useRef(false);
  const snapTimerRef = reactExports.useRef(null);
  const snapInProgressRef = reactExports.useRef(false);
  const controlledScrollRef = reactExports.useRef(false);
  const updateScrollbarFromScroll = React.useCallback(() => {
    try {
      const scroller = sectionScrollRef.current;
      const track = scrollTrackRef.current;
      if (!scroller || !track) return;
      const trackRect = track.getBoundingClientRect();
      const trackH = Math.max(0, Math.round(trackRect.height));
      const sh = Math.max(1, scroller.scrollHeight || 1);
      const ch = Math.max(1, scroller.clientHeight || 1);
      const maxScroll = Math.max(1, sh - ch);
      const ratioVisible = Math.max(0, Math.min(1, ch / sh));
      const thumbH = Math.max(12, Math.round(trackH * ratioVisible));
      const ratioTop = Math.max(0, Math.min(1, (scroller.scrollTop || 0) / maxScroll));
      const top = Math.round((trackH - thumbH) * ratioTop);
      setScrollThumb((t) => t.height !== thumbH || t.top !== top ? { height: thumbH, top } : t);
    } catch {
    }
  }, []);
  reactExports.useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(Boolean(mql.matches));
    update();
    try {
      mql.addEventListener("change", update);
    } catch {
      window.addEventListener("resize", update);
    }
    return () => {
      try {
        mql.removeEventListener("change", update);
      } catch {
        window.removeEventListener("resize", update);
      }
    };
  }, []);
  reactExports.useEffect(() => {
    if (isMobile) setShowMusic(false);
  }, [isMobile]);
  reactExports.useEffect(() => {
    const onResize = () => updateScrollbarFromScroll();
    window.addEventListener("resize", onResize);
    const t = setTimeout(updateScrollbarFromScroll, 80);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(t);
    };
  }, [updateScrollbarFromScroll, showSectionUi]);
  React.useCallback((dir) => {
    try {
      if (section !== "section1") return;
      const scroller = sectionScrollRef.current;
      if (!scroller) return;
      const cards = Array.from(scroller.querySelectorAll("[data-work-card]"));
      if (!cards.length) return;
      const sRect = scroller.getBoundingClientRect();
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2;
      const centers = cards.map((el) => {
        const r = el.getBoundingClientRect();
        return (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2;
      });
      let targetCenter = null;
      if (dir === "next") {
        targetCenter = centers.find((c) => c > viewCenter + 1);
        if (targetCenter == null) targetCenter = centers[0];
      } else if (dir === "prev") {
        for (let i = centers.length - 1; i >= 0; i--) {
          if (centers[i] < viewCenter - 1) {
            targetCenter = centers[i];
            break;
          }
        }
        if (targetCenter == null) targetCenter = centers[centers.length - 1];
      }
      if (targetCenter == null) return;
      const targetScroll = Math.max(0, Math.round(targetCenter - (scroller.clientHeight || 0) / 2));
      scroller.scrollTo({ top: targetScroll, behavior: "smooth" });
    } catch {
    }
  }, [section]);
  const snapToAdjacentCard = React.useCallback((dir) => {
    try {
      if (section !== "section1") return;
      const scroller = sectionScrollRef.current;
      if (!scroller) return;
      const cards = Array.from(scroller.querySelectorAll("[data-work-card]"));
      if (!cards.length) return;
      const sRect = scroller.getBoundingClientRect();
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2;
      let nearestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < cards.length; i++) {
        const r2 = cards[i].getBoundingClientRect();
        const c2 = (scroller.scrollTop || 0) + (r2.top - sRect.top) + r2.height / 2;
        const d = Math.abs(c2 - viewCenter);
        if (d < bestD) {
          bestD = d;
          nearestIdx = i;
        }
      }
      const step = dir === "prev" ? -1 : 1;
      const targetIdx = (nearestIdx + step + cards.length) % cards.length;
      const targetEl = cards[targetIdx];
      const r = targetEl.getBoundingClientRect();
      const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2;
      const targetScroll = Math.max(0, Math.round(c - (scroller.clientHeight || 0) / 2));
      controlledScrollRef.current = true;
      scroller.scrollTo({ top: targetScroll, behavior: "smooth" });
      setTimeout(() => {
        controlledScrollRef.current = false;
      }, 450);
    } catch {
    }
  }, [section]);
  const snapToNearestWorkCard = React.useCallback(() => {
    try {
      if (section !== "section1") return;
      const scroller = sectionScrollRef.current;
      if (!scroller) return;
      const cards = Array.from(scroller.querySelectorAll("[data-work-card]"));
      if (!cards.length) return;
      const sRect = scroller.getBoundingClientRect();
      const viewCenter = (scroller.scrollTop || 0) + (scroller.clientHeight || 0) / 2;
      let best = { d: Infinity, c: null };
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        const c = (scroller.scrollTop || 0) + (r.top - sRect.top) + r.height / 2;
        const d = Math.abs(c - viewCenter);
        if (d < best.d) best = { d, c };
      }
      if (best.c == null) return;
      const delta = best.c - viewCenter;
      if (Math.abs(delta) < 26) return;
      snapInProgressRef.current = true;
      const targetScroll = Math.max(0, Math.round(best.c - (scroller.clientHeight || 0) / 2));
      scroller.scrollTo({ top: targetScroll, behavior: "smooth" });
      setTimeout(() => {
        snapInProgressRef.current = false;
      }, 340);
    } catch {
    }
  }, [section]);
  reactExports.useEffect(() => {
    const onMove = (e) => {
      if (!isDraggingThumbRef.current) return;
      try {
        const scroller = sectionScrollRef.current;
        const track = scrollTrackRef.current;
        if (!scroller || !track) return;
        const rect = track.getBoundingClientRect();
        const trackH = Math.max(1, rect.height);
        const clientY = e.touches && e.touches[0] ? e.touches[0].clientY : e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : e.clientY || 0;
        const pos = Math.max(0, Math.min(trackH, clientY - rect.top));
        const sh = Math.max(1, scroller.scrollHeight || 1);
        const ch = Math.max(1, scroller.clientHeight || 1);
        const maxScroll = Math.max(1, sh - ch);
        const thumbH = Math.max(12, Math.round(trackH * Math.max(0, Math.min(1, ch / sh))));
        const ratio = Math.max(0, Math.min(1, (pos - thumbH / 2) / Math.max(1, trackH - thumbH)));
        const nextTop = Math.round((trackH - thumbH) * ratio);
        setScrollThumb((t) => t.height !== thumbH || t.top !== nextTop ? { height: thumbH, top: nextTop } : t);
        scroller.scrollTop = Math.round(maxScroll * ratio);
        if (e.cancelable) e.preventDefault();
      } catch {
      }
    };
    const onUp = () => {
      isDraggingThumbRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseleave", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchcancel", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseleave", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchcancel", onUp);
    };
  }, []);
  const sectionLabel = reactExports.useMemo(() => ({
    home: "HOME",
    section1: "WORK",
    section2: "ABOUT",
    section3: "SIDE QUESTS",
    section4: "CONTACT"
  }), []);
  const navRef = reactExports.useRef(null);
  const [navHeight, setNavHeight] = reactExports.useState(0);
  const [navBottomOffset, setNavBottomOffset] = reactExports.useState(0);
  const musicBtnRef = reactExports.useRef(null);
  const [musicPos, setMusicPos] = reactExports.useState({ left: 0, bottom: 0 });
  const navInnerRef = reactExports.useRef(null);
  const navBtnRefs = reactExports.useRef({});
  const [navHover, setNavHover] = reactExports.useState({ left: 0, width: 0, visible: false });
  const marqueeRef = reactExports.useRef(null);
  const [marqueeHeight, setMarqueeHeight] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const measure = () => {
      try {
        const rect = navRef.current ? navRef.current.getBoundingClientRect() : null;
        const isHidden = !rect || !isFinite(rect.height) || rect.height <= 0 || !isFinite(rect.bottom);
        if (isHidden) {
          setNavHeight(0);
          setNavBottomOffset(0);
          return;
        }
        const h = Math.round(rect.height);
        setNavHeight(h || 0);
        const off = Math.round((window.innerHeight || rect.bottom) - rect.bottom);
        setNavBottomOffset(Math.max(0, off) || 0);
      } catch {
      }
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", measure);
    const t = setTimeout(measure, 60);
    return () => {
      window.removeEventListener("resize", measure);
      if (ro && navRef.current) ro.unobserve(navRef.current);
      clearTimeout(t);
    };
  }, []);
  const marqueeObserverRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    const measureMarquee = () => {
      try {
        const h = marqueeRef.current ? Math.round(marqueeRef.current.getBoundingClientRect().height) : 0;
        setMarqueeHeight(h || 0);
      } catch {
      }
    };
    measureMarquee();
    if (typeof ResizeObserver !== "undefined") {
      if (marqueeObserverRef.current) {
        try {
          marqueeObserverRef.current.disconnect();
        } catch {
        }
      }
      marqueeObserverRef.current = new ResizeObserver(measureMarquee);
      if (marqueeRef.current) marqueeObserverRef.current.observe(marqueeRef.current);
    }
    window.addEventListener("resize", measureMarquee);
    const t2 = setTimeout(measureMarquee, 60);
    return () => {
      window.removeEventListener("resize", measureMarquee);
      if (marqueeObserverRef.current) {
        try {
          marqueeObserverRef.current.disconnect();
        } catch {
        }
      }
      clearTimeout(t2);
    };
  }, [showMarquee, showSectionUi]);
  reactExports.useEffect(() => {
    const measureSb = () => {
      try {
        const el = sectionScrollRef.current;
        if (!el) {
          setScrollbarW(0);
          return;
        }
        const w = Math.max(0, (el.offsetWidth || 0) - (el.clientWidth || 0));
        setScrollbarW(w);
      } catch {
        setScrollbarW(0);
      }
    };
    measureSb();
    window.addEventListener("resize", measureSb);
    return () => window.removeEventListener("resize", measureSb);
  }, [showSectionUi]);
  const ensureInfiniteScroll = React.useCallback(() => {
    try {
      if (section !== "section1") return;
      if (controlledScrollRef.current) return;
      const scroller = sectionScrollRef.current;
      if (!scroller) return;
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      const t = scroller.scrollTop || 0;
      const margin = Math.max(80, Math.round(scroller.clientHeight * 0.25));
      if (t < margin) {
        const newTop = Math.max(0, max - (scroller.clientHeight - t));
        scroller.scrollTop = newTop;
      } else if (t > max - margin) {
        const newTop = Math.max(0, t - (max - margin));
        scroller.scrollTop = newTop;
      }
    } catch {
    }
  }, [section]);
  reactExports.useEffect(() => {
    const measureMusicPos = () => {
      try {
        if (!musicBtnRef.current) return;
        const r = musicBtnRef.current.getBoundingClientRect();
        const left = Math.round(r.left + r.width / 2);
        const gap = 12;
        const bottom = Math.max(0, Math.round(window.innerHeight - (r.top - gap)));
        setMusicPos({ left, bottom });
      } catch {
      }
    };
    measureMusicPos();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureMusicPos) : null;
    if (ro && musicBtnRef.current) ro.observe(musicBtnRef.current);
    window.addEventListener("resize", measureMusicPos);
    const t = setTimeout(measureMusicPos, 60);
    return () => {
      window.removeEventListener("resize", measureMusicPos);
      if (ro && musicBtnRef.current) ro.unobserve(musicBtnRef.current);
      clearTimeout(t);
    };
  }, [showMusic]);
  const updateNavHighlightForEl = (el) => {
    try {
      if (!el || !navInnerRef.current) return;
      const PAD = 10;
      const c = navInnerRef.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const styles = window.getComputedStyle(navInnerRef.current);
      const padL = parseFloat(styles.paddingLeft) || PAD;
      const padR = parseFloat(styles.paddingRight) || PAD;
      let left = Math.round(r.left - c.left) - (PAD - padL);
      let width = Math.round(r.width) + (PAD - padL) + (PAD - padR);
      if (left < 0) {
        width += left;
        left = 0;
      }
      const maxW = Math.round(c.width);
      if (left + width > maxW) width = Math.max(0, maxW - left);
      left = Math.round(left);
      width = Math.round(width);
      setNavHover({ left, width, visible: true });
    } catch {
    }
  };
  const baseUrl = "/development/";
  const sectionSlug = reactExports.useMemo(() => ({ section1: "work", section2: "about", section3: "side-quests", section4: "contact" }), []);
  const slugToSection = reactExports.useMemo(() => ({ work: "section1", about: "section2", "side-quests": "section3", contact: "section4" }), []);
  const sectionToPath = (s) => s && s !== "home" ? `${baseUrl}${sectionSlug[s] || s}` : baseUrl;
  const pathToSection = (path) => {
    try {
      const base = new URL(baseUrl, window.location.origin);
      const full = new URL(path, window.location.origin);
      let rel = full.pathname;
      const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
      if (rel.startsWith(basePath)) rel = rel.slice(basePath.length);
      rel = rel.replace(/^\//, "");
      if (rel === "" || rel === "/") return "home";
      if (slugToSection[rel]) return slugToSection[rel];
      if (["section1", "section2", "section3", "section4"].includes(rel)) return rel;
      return "home";
    } catch {
      return "home";
    }
  };
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = pathToSection(window.location.pathname);
    if (initial) setSection(initial);
  }, []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const preload = () => {
      try {
        __vitePreload(() => Promise.resolve().then(() => Section1$2), true ? void 0 : void 0);
      } catch {
      }
      try {
        __vitePreload(() => import("./Section2-BPEedqqC.js"), true ? __vite__mapDeps([0,1]) : void 0);
      } catch {
      }
      try {
        __vitePreload(() => import("./Section3-iAd3N-7Y.js"), true ? __vite__mapDeps([2,1]) : void 0);
      } catch {
      }
      try {
        __vitePreload(() => import("./Section4-BQqydh3B.js"), true ? __vite__mapDeps([3,1]) : void 0);
      } catch {
      }
    };
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2e3 });
    } else {
      setTimeout(preload, 0);
    }
  }, []);
  React.useEffect(() => {
    try {
      preloadSfx(["hover", "click"]);
    } catch {
    }
  }, []);
  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const res = await fetch(`${"/development/"}songs/manifest.json`, { cache: "no-cache" });
        const json = await res.json();
        let arr = Array.isArray(json) ? json.slice() : [];
        const target = "songs/Skulley Rad - Speaking in public (The last act of Skulley Rad).mp3";
        const idx = arr.findIndex((t) => (t?.src || "").toLowerCase() === target.toLowerCase());
        if (idx > 0) {
          const speaking = { ...arr[idx] };
          arr.splice(idx, 1);
          arr = [speaking, ...arr];
        }
        if (!canceled) setTracks(arr);
      } catch {
        if (!canceled) setTracks([]);
      }
    })();
    return () => {
      canceled = true;
    };
  }, []);
  reactExports.useEffect(() => {
    if (transitionState.active) return;
    if (section !== "home") {
      setShowSectionUi(true);
      setSectionUiAnimatingOut(false);
      setSectionUiFadeIn(false);
      requestAnimationFrame(() => {
        try {
          if (sectionScrollRef.current) sectionScrollRef.current.scrollTop = 0;
        } catch {
        }
        setTimeout(() => setSectionUiFadeIn(true), 10);
      });
    } else if (showSectionUi) {
      setSectionUiAnimatingOut(true);
      setSectionUiFadeIn(false);
      const t = setTimeout(() => {
        setShowSectionUi(false);
        setSectionUiAnimatingOut(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [section, transitionState.active, showSectionUi]);
  reactExports.useEffect(() => {
    const lock = showSectionUi || sectionUiAnimatingOut;
    const prev = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSectionUi, sectionUiAnimatingOut]);
  reactExports.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && showSectionUi && !transitionState.active) {
        handleExitSection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSectionUi, transitionState.active, handleExitSection]);
  const syncUrl = (s) => {
    if (typeof window === "undefined") return;
    const next = sectionToPath(s);
    if (window.location.pathname !== next) {
      window.history.pushState({ section: s }, "", next);
    }
  };
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const target = pathToSection(window.location.pathname);
      if (!target) return;
      if (target === "home") {
        setShowSectionUi(false);
        setSectionUiAnimatingOut(false);
        if (!transitionState.active && section !== "home") {
          setTransitionState({ active: true, from: section, to: "home" });
        }
        setSection("home");
        return;
      }
      if (target !== section && !transitionState.active) {
        setTransitionState({ active: true, from: section, to: target });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [section, transitionState.active]);
  const playerRef = reactExports.useRef();
  const sunRef = reactExports.useRef();
  const dofTargetRef = playerRef;
  const prevPlayerPosRef = reactExports.useRef(new Vector3(0, 0, 0));
  const lastPortalIdRef = reactExports.useRef(null);
  const portals = reactExports.useMemo(
    () => [
      { id: "section1", position: [0, 0, -16], color: sectionColors["section1"] },
      { id: "section2", position: [16, 0, 0], color: sectionColors["section2"] },
      { id: "section3", position: [-16, 0, 0], color: sectionColors["section3"] },
      { id: "section4", position: [0, 0, 16], color: sectionColors["section4"] }
    ],
    []
  );
  const handlePortalEnter = (target) => {
    if (!transitionState.active && target !== section) {
      setTransitionState({ active: true, from: section, to: target });
    }
  };
  const handleTransitionComplete = () => {
    setSection(transitionState.to);
    setTransitionState({ active: false, from: transitionState.to || section, to: null });
    if (transitionState.to) syncUrl(transitionState.to);
    try {
      if (ctaProgTimerRef.current) {
        clearInterval(ctaProgTimerRef.current);
        ctaProgTimerRef.current = null;
      }
    } catch {
    }
    setCtaLoading(false);
    setCtaProgress(0);
    if (transitionState.to === "home") {
      try {
        if (playerRef.current) {
          playerRef.current.position.set(0, 0, 0);
          playerRef.current.rotation.set(0, 0, 0);
        }
      } catch {
      }
      setShowSectionUi(false);
      setSectionUiAnimatingOut(false);
      setUiHintPortalId(null);
      setNearPortalId(null);
      setShowCta(false);
      setShowMarquee(false);
      setTintFactor(0);
      try {
        if (mainControlsRef.current) mainControlsRef.current.enabled = true;
      } catch {
      }
      setTimeout(() => setBlackoutVisible(false), 80);
    }
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setShowSectionBanner(true);
    bannerTimerRef.current = setTimeout(() => {
      setShowSectionBanner(false);
      bannerTimerRef.current = null;
    }, 1800);
  };
  React.useEffect(() => {
    if (transitionState.active) return;
    const activeId = nearPortalId || uiHintPortalId;
    if (activeId) {
      setShowCta(true);
      setCtaAnimatingOut(false);
      if (ctaHideTimerRef.current) {
        clearTimeout(ctaHideTimerRef.current);
        ctaHideTimerRef.current = null;
      }
    } else {
      if (showCta) {
        setCtaAnimatingOut(true);
        if (ctaHideTimerRef.current) clearTimeout(ctaHideTimerRef.current);
        ctaHideTimerRef.current = window.setTimeout(() => {
          setShowCta(false);
          setCtaAnimatingOut(false);
          ctaHideTimerRef.current = null;
        }, 220);
      }
    }
  }, [nearPortalId, uiHintPortalId, transitionState.active, showCta]);
  React.useEffect(() => {
    if (marqueeForceHidden) {
      setShowMarquee(false);
      setMarqueeAnimatingOut(false);
      return;
    }
    if (landingBannerActive) {
      setShowMarquee(true);
      setMarqueeAnimatingOut(false);
      return;
    }
    if (ctaLoading && transitionState.to && transitionState.to !== "home") {
      setShowMarquee(true);
      setMarqueeAnimatingOut(false);
      setMarqueeLabelSection(transitionState.to);
      return;
    }
    if (showSectionUi) {
      setShowMarquee(true);
      setMarqueeAnimatingOut(false);
      setMarqueeLabelSection(section);
      return;
    }
    const shouldShowHome = Boolean(section === "home" && (nearPortalId || uiHintPortalId));
    if (shouldShowHome) {
      setShowMarquee(true);
      setMarqueeAnimatingOut(false);
      setMarqueeLabelSection(nearPortalId || uiHintPortalId || section);
      if (marqueeHideTimerRef.current) {
        clearTimeout(marqueeHideTimerRef.current);
        marqueeHideTimerRef.current = null;
      }
      return;
    }
    if (showMarquee) {
      setMarqueeAnimatingOut(true);
      if (marqueeHideTimerRef.current) clearTimeout(marqueeHideTimerRef.current);
      marqueeHideTimerRef.current = window.setTimeout(() => {
        if (!landingBannerActive) {
          setShowMarquee(false);
          setMarqueeAnimatingOut(false);
        }
        marqueeHideTimerRef.current = null;
      }, 200);
    }
  }, [marqueeForceHidden, landingBannerActive, ctaLoading, transitionState.to, showSectionUi, section, nearPortalId, uiHintPortalId, showMarquee]);
  reactExports.useEffect(() => {
    if (!transitionState.active) return;
    if (transitionState.from !== "home" && transitionState.to === "home") ;
  }, [transitionState]);
  const [tintFactor, setTintFactor] = reactExports.useState(0);
  const sceneColor = reactExports.useMemo(() => {
    const baseBg = "#204580";
    const nearColor = "#0a132b";
    return lerpColor(baseBg, nearColor, tintFactor);
  }, [tintFactor]);
  const [portalMixMap, setPortalMixMap] = reactExports.useState({});
  function lerpColor(hex1, hex2, t) {
    const c1 = parseInt(hex1.slice(1), 16);
    const c2 = parseInt(hex2.slice(1), 16);
    const r = Math.round((c1 >> 16 & 255) * (1 - t) + (c2 >> 16 & 255) * t);
    const g = Math.round((c1 >> 8 & 255) * (1 - t) + (c2 >> 8 & 255) * t);
    const b = Math.round((c1 & 255) * (1 - t) + (c2 & 255) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }
  const redEgg = "#7a0b0b";
  const effectiveSceneColor = eggActive ? redEgg : sceneColor;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full h-full relative overflow-hidden", children: [
    !bootLoading && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Canvas,
      {
        shadows: { type: PCFSoftShadowMap },
        dpr: [1, isMobilePerf ? 1.2 : 1.5],
        gl: { antialias: false, powerPreference: "high-performance", alpha: false, stencil: false, preserveDrawingBuffer: false },
        camera: { position: [0, 3, 8], fov: 60, near: 0.1, far: 120 },
        events: void 0,
        onCreated: ({ gl }) => {
          try {
            gl.getContextAttributes();
          } catch {
          }
          glRef.current = gl;
          try {
            const el = gl.domElement;
            el.style.position = "fixed";
            el.style.top = "0";
            el.style.left = "0";
            el.style.bottom = "0";
            el.style.right = "0";
          } catch {
          }
        },
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(reactExports.Suspense, { fallback: null, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(AdaptiveDpr, { pixelated: true }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(PauseFrameloop, { paused: (showSectionUi || sectionUiAnimatingOut) && !transitionState.active }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Environment, { overrideColor: effectiveSceneColor, lowPerf: isMobilePerf }),
          fx.godEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { ref: sunRef, position: [0, 8, 0], children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("sphereGeometry", { args: [0.35, 12, 12] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("meshBasicMaterial", { color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Player,
            {
              playerRef,
              portals,
              onPortalEnter: handlePortalEnter,
              onProximityChange: (f) => {
                const smooth = (prev, next, k = 0.22) => prev + (next - prev) * k;
                setTintFactor((prev) => smooth(prev ?? 0, f));
              },
              onPortalsProximityChange: setPortalMixMap,
              onNearPortalChange: (id) => {
                setNearPortalId(id);
                if (id && section === "home") {
                  if (bannerTimerRef.current) {
                    clearTimeout(bannerTimerRef.current);
                    bannerTimerRef.current = null;
                  }
                  setLandingBannerActive(false);
                  setMarqueeAnimatingOut(false);
                  setShowMarquee(true);
                  setMarqueeLabelSection(id);
                }
              },
              navigateToPortalId: navTarget,
              sceneColor: effectiveSceneColor,
              onCharacterReady: () => {
                setCharacterReady(true);
              },
              onHomeFallStart: () => {
                if (blackoutVisible) {
                  setBlackoutImmediate(false);
                  setBlackoutVisible(false);
                }
              },
              onReachedPortal: (id) => {
                try {
                  lastPortalIdRef.current = id;
                } catch {
                }
                if (id && id !== "home") {
                  try {
                    setMarqueeLabelSection(id);
                  } catch {
                  }
                }
                setNavTarget(null);
              },
              onOrbStateChange: (active) => setOrbActiveUi(active),
              onHomeSplash: () => {
                if (bannerTimerRef.current) {
                  clearTimeout(bannerTimerRef.current);
                  bannerTimerRef.current = null;
                }
                setMarqueeLabelSection("home");
                setShowMarquee(true);
                setMarqueeAnimatingOut(false);
                setMarqueeForceHidden(false);
                setLandingBannerActive(true);
                if (blackoutVisible) setTimeout(() => setBlackoutVisible(false), 80);
                bannerTimerRef.current = setTimeout(() => {
                  setLandingBannerActive(false);
                  setMarqueeAnimatingOut(true);
                  window.setTimeout(() => {
                    setShowMarquee(false);
                    setMarqueeAnimatingOut(false);
                  }, 220);
                  bannerTimerRef.current = null;
                }, 2e3);
                lastExitedSectionRef.current = null;
              }
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(FollowLight, { playerRef, height: topLight.height, intensity: topLight.intensity, angle: topLight.angle, penumbra: topLight.penumbra, color: "#fff" }),
          portals.map((p) => {
            const mix = portalMixMap[p.id] || 0;
            const targetColor = sectionColors[p.id] || "#ffffff";
            return /* @__PURE__ */ jsxRuntimeExports.jsxs(FrustumCulledGroup, { position: p.position, radius: 4.5, maxDistance: 64, sampleEvery: 4, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Portal, { position: [0, 0, 0], color: p.color, targetColor, mix, size: 2 }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(PortalParticles, { center: [0, 0, 0], radius: 4, count: isMobilePerf ? 120 : 220, color: "#9ec6ff", targetColor, mix, playerRef, frenzyRadius: 10 })
            ] }, p.id);
          }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            CameraController,
            {
              playerRef,
              controlsRefExternal: mainControlsRef,
              shakeActive: eggActive || Boolean(nearPortalId),
              shakeAmplitude: eggActive ? 0.18 : 0.08,
              shakeFrequencyX: eggActive ? 22 : 14,
              shakeFrequencyY: eggActive ? 18 : 12,
              shakeYMultiplier: eggActive ? 1 : 0.9,
              enabled: !showSectionUi && !sectionUiAnimatingOut,
              followBehind: isMobile
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            PostFX,
            {
              lowPerf: false,
              eggActiveGlobal: eggActive,
              bloom: fx.bloom,
              vignette: fx.vignette,
              noise: fx.noise,
              dotEnabled: fx.dotEnabled,
              dotScale: fx.dotScale,
              dotAngle: fx.dotAngle,
              dotCenterX: fx.dotCenterX,
              dotCenterY: fx.dotCenterY,
              dotOpacity: fx.dotOpacity,
              dotBlend: fx.dotBlend,
              godEnabled: fx.godEnabled,
              godSun: sunRef,
              godDensity: fx.godDensity,
              godDecay: fx.godDecay,
              godWeight: fx.godWeight,
              godExposure: fx.godExposure,
              godClampMax: fx.godClampMax,
              godSamples: fx.godSamples,
              dofEnabled: fx.dofEnabled,
              dofProgressive: fx.dofProgressive,
              dofFocusDistance: fx.dofFocusDistance,
              dofFocalLength: fx.dofFocalLength,
              dofBokehScale: fx.dofBokehScale,
              dofFocusSpeed: fx.dofFocusSpeed,
              dofTargetRef
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            TransitionOverlay,
            {
              active: transitionState.active,
              fromColor: sectionColors[transitionState.from],
              toColor: sectionColors[transitionState.to || section],
              duration: 0.8,
              onComplete: handleTransitionComplete,
              forceOnceKey: `${transitionState.from}->${transitionState.to}`,
              maxOpacity: 1
            }
          )
        ] })
      }
    ),
    bootLoading && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-[20000] bg-[#0a0f22] text-white", role: "dialog", "aria-modal": "true", style: { opacity: preloaderFadingOut ? 0 : 1, transition: "opacity 1000ms ease" }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 w-full h-full", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "hidden md:block relative overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Canvas, { dpr: [1, 1.5], camera: { position: [0, 1.6, 4], fov: 55, near: 0.1, far: 120 }, gl: { antialias: false, powerPreference: "high-performance", alpha: true }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Environment, { overrideColor: effectiveSceneColor, lowPerf: isMobilePerf, noAmbient: true }),
        fx.godEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("mesh", { ref: preSunRef, position: [0, 8, 0], children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("sphereGeometry", { args: [0.35, 12, 12] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("meshBasicMaterial", { color: "#ffffff", transparent: true, opacity: 0, depthWrite: false })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PreloaderCharacterWalk, { playerRef: preloaderPlayerRef }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(PreloaderPinLight, { playerRef: preloaderPlayerRef }),
        !preOrbitPaused && /* @__PURE__ */ jsxRuntimeExports.jsx(
          PreloaderOrbit,
          {
            playerRef: preloaderPlayerRef,
            outHeadRef: preloaderHeadRef,
            radius: 6.2,
            startRadius: 9,
            rampMs: 1400,
            speed: 0.18,
            targetOffsetY: 1.6,
            startDelayMs: 1200
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PostFX,
          {
            lowPerf: false,
            eggActiveGlobal: false,
            bloom: fx.bloom,
            vignette: fx.vignette,
            noise: fx.noise,
            dotEnabled: fx.dotEnabled,
            dotScale: fx.dotScale,
            dotAngle: fx.dotAngle,
            dotCenterX: fx.dotCenterX,
            dotCenterY: fx.dotCenterY,
            dotOpacity: fx.dotOpacity,
            dotBlend: fx.dotBlend,
            godEnabled: fx.godEnabled,
            godSun: preSunRef,
            godDensity: fx.godDensity,
            godDecay: fx.godDecay,
            godWeight: fx.godWeight,
            godExposure: fx.godExposure,
            godClampMax: fx.godClampMax,
            godSamples: fx.godSamples,
            dofEnabled: fx.dofEnabled,
            dofProgressive: fx.dofProgressive,
            dofFocusDistance: fx.dofFocusDistance,
            dofFocalLength: fx.dofFocalLength,
            dofBokehScale: fx.dofBokehScale,
            dofFocusSpeed: fx.dofFocusSpeed,
            dofTargetRef: preloaderHeadRef
          }
        )
      ] }) }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center p-8 col-span-1 md:col-span-1 md:justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full max-w-xl text-center md:text-left", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-marquee uppercase text-[2.625rem] sm:text-[3.15rem] md:text-[4.2rem] leading-[0.9] tracking-wide mb-4", style: { WebkitTextStroke: "1px rgba(255,255,255,0.08)" }, children: "SKULLEY RAD, THE LAST DESIGNER OF HUMAN KIND" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "opacity-90 leading-tight mb-6 text-base sm:text-lg", children: "Skulley Rad fue un diseñador gráfico que murió de la peor enfermedad de este siglo: el desempleo creativo. Las máquinas hicieron su trabajo más rápido, más barato y sin pedir revisiones infinitas… y bueno, ya nadie lo contrató." }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "opacity-90 leading-tight mb-6 text-base sm:text-lg", children: 'En honor a su "gran" carrera (y a sus memes en Illustrator que nunca vieron la luz), las mismas máquinas que lo dejaron sin chamba decidieron rendirle tributo: construyeron un universo digital con sus recuerdos, archivos corruptos y capas mal nombradas.' }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "opacity-90 leading-tight mb-6 text-base sm:text-lg", children: "Hoy, Skulley Rad existe entre bits y píxeles, convertido en una calavera punk errante del más allá digital, condenado a vivir eternamente en un tributo irónico a los humanos que alguna vez creyeron tener el control de las máquinas." }),
        !bootAllDone && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-full h-2 rounded-full bg-white/10 overflow-hidden", "aria-hidden": true, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-red-500", style: { width: `${bootProgress}%`, transition: "width 160ms ease-out" } }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-xs opacity-60", "aria-live": "polite", children: [
            bootProgress,
            "%"
          ] })
        ] }),
        bootAllDone && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              setAudioReady(true);
            },
            className: "mt-6 inline-flex items-center justify-center w-full max-w-xs sm:max-w-none px-6 py-4 sm:px-8 sm:py-4 md:px-10 md:py-5 rounded-full bg-white text-black font-bold uppercase tracking-wide text-lg sm:text-xl md:text-2xl shadow hover:translate-y-[-1px] active:translate-y-0 transition-transform font-marquee",
            "aria-label": "Entrar con sonido",
            children: "Entrar"
          }
        )
      ] }) })
    ] }) }),
    showGpu && /* @__PURE__ */ jsxRuntimeExports.jsx(GpuStats, { sampleMs: 1e3, gl: glRef.current }),
    (showSectionUi || sectionUiAnimatingOut) && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: sectionScrollRef,
        className: "fixed inset-0 z-[10] overflow-y-auto no-native-scrollbar",
        style: {
          backgroundColor: sectionColors[section] || "#000000",
          opacity: sectionUiFadeIn && showSectionUi && !sectionUiAnimatingOut ? 1 : 0,
          transition: "opacity 500ms ease",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          touchAction: "pan-y"
        },
        onScroll: (e) => {
          try {
            const el = e.currentTarget;
            const max = Math.max(1, el.scrollHeight - el.clientHeight);
            setSectionScrollProgress(el.scrollTop / max);
            updateScrollbarFromScroll();
            ensureInfiniteScroll();
            if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
            snapTimerRef.current = setTimeout(() => {
              if (!snapInProgressRef.current) snapToNearestWorkCard();
            }, 240);
          } catch {
          }
        },
        "data-section-scroll": true,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "min-h-screen w-full", style: { paddingTop: `${marqueeHeight}px`, overscrollBehavior: "contain" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative max-w-5xl mx-auto px-6 sm:px-8 pt-6 pb-12", children: [
            section === "section1" && /* @__PURE__ */ jsxRuntimeExports.jsx(Section1, { scrollerRef: sectionScrollRef, scrollbarOffsetRight: scrollbarW }),
            section === "section2" && /* @__PURE__ */ jsxRuntimeExports.jsx(Section2, {}),
            section === "section3" && /* @__PURE__ */ jsxRuntimeExports.jsx(Section3, {}),
            section === "section4" && /* @__PURE__ */ jsxRuntimeExports.jsx(Section4, {})
          ] }) }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "div",
            {
              className: "pointer-events-auto fixed top-1/2 -translate-y-1/2 z-[12020] hidden sm:flex flex-col items-center gap-2 select-none",
              onWheel: (e) => {
                try {
                  sectionScrollRef.current?.scrollBy({ top: e.deltaY, behavior: "auto" });
                } catch {
                }
              },
              onClick: (e) => e.stopPropagation(),
              "aria-hidden": true,
              style: { right: `${(scrollbarW || 0) + 40}px` },
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "w-2 h-2 rounded-full bg-black/50 hover:bg-black/60 transition-colors", onClick: () => {
                  if (section === "section1") snapToAdjacentCard("prev");
                  else sectionScrollRef.current?.scrollBy({ top: -window.innerHeight * 0.6, behavior: "smooth" });
                } }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "w-2 h-2 rounded-full bg-black/50 hover:bg-black/60 transition-colors", onClick: () => {
                  if (section === "section1") snapToAdjacentCard("next");
                  else sectionScrollRef.current?.scrollBy({ top: window.innerHeight * 0.6, behavior: "smooth" });
                } })
              ]
            }
          )
        ]
      }
    ),
    (showCta || ctaAnimatingOut || ctaLoading) && (!transitionState.active || ctaLoading) && (section === "home" && !showSectionUi && !sectionUiAnimatingOut || ctaLoading) && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: `pointer-events-none fixed z-[300] ${isMobile ? "inset-0 grid place-items-center" : "inset-x-0 flex items-center justify-center"}`,
        style: isMobile ? void 0 : { bottom: `${Math.max(0, (navHeight || 0) + (navBottomOffset || 0) + 30)}px` },
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            onClick: async () => {
              try {
                playSfx("click", { volume: 1 });
              } catch {
              }
              const target = nearPortalId || uiHintPortalId;
              if (!target) return;
              if (transitionState.active) return;
              if (target === section) return;
              if (ctaLoading) return;
              try {
                setCtaColor(sectionColors[target] || "#ffffff");
              } catch {
              }
              setCtaLoading(true);
              setCtaProgress(0);
              if (ctaProgTimerRef.current) clearInterval(ctaProgTimerRef.current);
              ctaProgTimerRef.current = setInterval(() => {
                setCtaProgress((p) => Math.min(100, p + 4));
              }, 60);
              try {
                const preloadMap = {
                  section1: () => __vitePreload(() => Promise.resolve().then(() => Section1$2), true ? void 0 : void 0),
                  section2: () => __vitePreload(() => import("./Section2-BPEedqqC.js"), true ? __vite__mapDeps([0,1]) : void 0),
                  section3: () => __vitePreload(() => import("./Section3-iAd3N-7Y.js"), true ? __vite__mapDeps([2,1]) : void 0),
                  section4: () => __vitePreload(() => import("./Section4-BQqydh3B.js"), true ? __vite__mapDeps([3,1]) : void 0)
                };
                const f = preloadMap[target];
                if (typeof f === "function") {
                  try {
                    await f();
                  } catch {
                  }
                }
              } catch {
              }
              try {
                if (target === "section1") {
                  const urls = typeof getWorkImageUrls === "function" ? getWorkImageUrls() : [];
                  const subset = urls.slice(0, 6);
                  const loadWithTimeout = (u, ms = 2e3) => new Promise((resolve) => {
                    const img = new Image();
                    let done = false;
                    const finish = (ok) => {
                      if (!done) {
                        done = true;
                        resolve(ok);
                      }
                    };
                    const t = setTimeout(() => finish(false), ms);
                    img.onload = () => {
                      clearTimeout(t);
                      finish(true);
                    };
                    img.onerror = () => {
                      clearTimeout(t);
                      finish(false);
                    };
                    img.src = u;
                  });
                  await Promise.all(subset.map((u) => loadWithTimeout(u)));
                }
              } catch {
              }
              setCtaProgress(100);
              try {
                if (ctaProgTimerRef.current) {
                  clearInterval(ctaProgTimerRef.current);
                  ctaProgTimerRef.current = null;
                }
              } catch {
              }
              window.setTimeout(() => {
                setCtaLoading(false);
              }, 180);
              try {
                if (playerRef.current) prevPlayerPosRef.current.copy(playerRef.current.position);
              } catch {
              }
              try {
                lastPortalIdRef.current = target;
              } catch {
              }
              setTransitionState({ active: true, from: section, to: target });
              setPortraitGlowV((v) => v + 1);
              setSection(target);
              if (typeof window !== "undefined") {
                const base = "/development/";
                const map = { section1: "work", section2: "about", section3: "side-quests", section4: "contact" };
                const next = target && target !== "home" ? `${base}${map[target] || target}` : base;
                if (window.location.pathname !== next) {
                  window.history.pushState({ section: target }, "", next);
                }
              }
              window.setTimeout(() => {
                setTransitionState((s) => s.active ? { active: false, from: target, to: null } : s);
              }, 900);
            },
            onMouseEnter: () => {
              try {
                playSfx("hover", { volume: 0.9 });
              } catch {
              }
            },
            className: "pointer-events-auto relative overflow-hidden px-6 py-3 sm:px-10 sm:py-4 md:px-12 md:py-5 rounded-full bg-white text-black font-bold uppercase tracking-wide text-lg sm:text-3xl md:text-4xl shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:translate-y-[-2px] active:translate-y-[0] transition-transform font-marquee sm:scale-150",
            style: { fontFamily: "'Luckiest Guy', Archivo Black, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", animation: `${nearPortalId || uiHintPortalId ? "slideup 220ms ease-out forwards" : "slideup-out 220ms ease-in forwards"}` },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "span",
                {
                  "aria-hidden": true,
                  className: "absolute left-0 top-0 bottom-0 z-0 rounded-full",
                  style: {
                    width: `${ctaLoading ? ctaProgress : 0}%`,
                    backgroundColor: ctaColor,
                    transition: "width 150ms ease-out"
                  }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "relative z-[10]", children: "Cruza el portal" })
            ]
          }
        )
      }
    ),
    (showMarquee || marqueeAnimatingOut) && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        ref: marqueeRef,
        className: "fixed top-0 left-0 right-0 z-[20] pointer-events-none pt-0 pb-2",
        style: { animation: `${landingBannerActive || nearPortalId || showSectionUi ? "slidedown 200ms ease-out" : marqueeAnimatingOut ? "slidedown-out 200ms ease-in forwards" : "none"}`, right: `${scrollbarW}px` },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden w-full", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "whitespace-nowrap opacity-95 will-change-transform", style: { animation: "marquee 18s linear infinite", transform: "translateZ(0)" }, children: [0, 1].map((seq) => /* @__PURE__ */ jsxRuntimeExports.jsx(React.Fragment, { children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "span",
          {
            className: "title-banner",
            style: { fontFamily: "'Luckiest Guy', Archivo Black, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", WebkitTextStroke: "1px rgba(255,255,255,0.08)" },
            children: sectionLabel[marqueeLabelSection || nearPortalId || uiHintPortalId || section] || (marqueeLabelSection || nearPortalId || uiHintPortalId || section || "").toUpperCase()
          },
          `${seq}-${i}`
        )) }, seq)) }) })
      }
    ),
    !showSectionUi && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        onClick: () => setShowFxPanel((v) => !v),
        className: "pointer-events-auto fixed right-4 top-16 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md z-[15000]",
        "aria-label": "Toggle panel FX",
        children: "FX"
      }
    ),
    !showSectionUi && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        onClick: () => setShowGpu((v) => !v),
        className: "pointer-events-auto fixed right-4 top-28 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md z-[15000] transition-transform hover:translate-y-[-1px]",
        "aria-label": "Toggle GPU stats",
        children: "GPU"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-none fixed right-4 bottom-4 z-[16000] flex flex-col items-end gap-3 sm:hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            setShowMusic((v) => !v);
          },
          onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          },
          className: `pointer-events-auto h-12 w-12 rounded-full grid place-items-center shadow-md transition-colors ${showMusic ? "bg-black text-white" : "bg-white/95 text-black"}`,
          "aria-pressed": showMusic ? "true" : "false",
          "aria-label": "Toggle music player",
          title: showMusic ? "Hide player" : "Show player",
          style: { marginRight: `${scrollbarW || 0}px` },
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$6, { className: "w-6 h-6" })
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            setMenuOpen((v) => !v);
          },
          onMouseEnter: () => {
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          },
          className: "pointer-events-auto h-12 w-12 rounded-full bg-white/95 text-black grid place-items-center shadow-md",
          "aria-expanded": menuOpen ? "true" : "false",
          "aria-controls": "nav-overlay",
          "aria-label": "Open navigation menu",
          style: { marginRight: `${scrollbarW || 0}px` },
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$7, { className: "w-7 h-7" })
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { ref: navRef, className: "pointer-events-auto fixed inset-x-0 bottom-10 z-[450] hidden sm:flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { ref: navInnerRef, className: "relative bg-white/95 backdrop-blur rounded-full shadow-lg p-2.5 flex items-center gap-0 overflow-hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `absolute rounded-full bg-black/10 transition-all duration-200 ${navHover.visible ? "opacity-100" : "opacity-0"}`,
          style: { left: `${navHover.left}px`, width: `${navHover.width}px`, top: "10px", bottom: "10px" }
        }
      ),
      ["section1", "section2", "section3", "section4"].map((id) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          ref: (el) => {
            if (el) navBtnRefs.current[id] = el;
          },
          onMouseEnter: (e) => {
            updateNavHighlightForEl(e.currentTarget);
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          },
          onFocus: (e) => updateNavHighlightForEl(e.currentTarget),
          onMouseLeave: () => setNavHover((h) => ({ ...h, visible: false })),
          onBlur: () => setNavHover((h) => ({ ...h, visible: false })),
          onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            if (!orbActiveUi) {
              setNavTarget(id);
              setPortraitGlowV((v) => v + 1);
            }
          },
          className: "relative z-[1] px-2.5 py-2.5 rounded-full bg-transparent text-black text-base sm:text-lg font-marquee uppercase tracking-wide",
          children: sectionLabel[id]
        },
        id
      )),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          onClick: () => {
            try {
              playSfx("click", { volume: 1 });
            } catch {
            }
            setShowMusic((v) => !v);
          },
          ref: musicBtnRef,
          onMouseEnter: (e) => {
            updateNavHighlightForEl(e.currentTarget);
            try {
              playSfx("hover", { volume: 0.9 });
            } catch {
            }
          },
          onFocus: (e) => updateNavHighlightForEl(e.currentTarget),
          onMouseLeave: () => setNavHover((h) => ({ ...h, visible: false })),
          onBlur: () => setNavHover((h) => ({ ...h, visible: false })),
          className: `relative z-[1] px-2.5 py-2.5 rounded-full grid place-items-center transition-colors ${showMusic ? "bg-black text-white" : "bg-transparent text-black"}`,
          "aria-pressed": showMusic ? "true" : "false",
          "aria-label": "Toggle music player",
          title: showMusic ? "Hide player" : "Show player",
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(ForwardRef$6, { className: "w-6 h-6" })
        }
      )
    ] }) }),
    menuOpen && /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        id: "nav-overlay",
        role: "dialog",
        "aria-modal": "true",
        className: "fixed inset-0 z-[14000] flex items-center justify-center",
        onClick: () => setMenuOpen(false),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 bg-black/60 backdrop-blur-sm" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative pointer-events-auto grid gap-4 w-full max-w-md px-6", children: [
            ["section1", "section2", "section3", "section4"].map((id) => /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  try {
                    playSfx("click", { volume: 1 });
                  } catch {
                  }
                  setMenuOpen(false);
                  if (!orbActiveUi) {
                    setNavTarget(id);
                    setPortraitGlowV((v) => v + 1);
                  }
                },
                className: "w-full py-4 rounded-xl bg-white text-black text-xl font-marquee uppercase tracking-wide shadow-md hover:scale-[1.01] active:scale-[0.995] transition-transform",
                children: sectionLabel[id]
              },
              id
            )),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                type: "button",
                onClick: () => setMenuOpen(false),
                className: "w-full py-3 rounded-xl bg-black/70 text-white text-base shadow hover:bg-black/80",
                children: "Close"
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `fixed inset-0 z-[14050] sm:z-[900] ${showMusic ? "grid" : "hidden"} place-items-center sm:pointer-events-none`, role: "dialog", "aria-modal": "true", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `absolute inset-0 bg-black/60 backdrop-blur-sm sm:hidden transition-opacity ${showMusic ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`,
          onClick: () => setShowMusic(false)
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: `relative pointer-events-auto sm:fixed transition-all duration-200 ${showMusic ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"} `,
          onClick: (e) => e.stopPropagation(),
          style: isMobile ? void 0 : { right: `${(scrollbarW || 0) + 40}px`, bottom: "40px" },
          children: /* @__PURE__ */ jsxRuntimeExports.jsx(MusicPlayer, { tracks, navHeight, autoStart: audioReady })
        }
      )
    ] }),
    showFxPanel && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-auto fixed right-4 top-28 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none z-[500]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs font-semibold opacity-80", children: "Post‑Processing" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "GodRays" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "checkbox",
            checked: fx.godEnabled,
            onChange: (e) => {
              const enabled = e.target.checked;
              const looksDefault = fx.godDensity === 0.9 && fx.godDecay === 0.95 && fx.godWeight === 0.6 && fx.godExposure === 0.3 && fx.godClampMax === 1 && fx.godSamples === 60;
              setFx({
                ...fx,
                godEnabled: enabled,
                ...enabled && looksDefault ? { godDensity: 1.1, godDecay: 0.94, godWeight: 1, godExposure: 0.6, godClampMax: 1.2, godSamples: 80 } : {}
              });
            }
          }
        )
      ] }),
      fx.godEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "Density: ",
          fx.godDensity.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.1", max: "1.5", step: "0.01", value: fx.godDensity, onChange: (e) => setFx({ ...fx, godDensity: parseFloat(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "Decay: ",
          fx.godDecay.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.5", max: "1.0", step: "0.01", value: fx.godDecay, onChange: (e) => setFx({ ...fx, godDecay: parseFloat(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "Weight: ",
          fx.godWeight.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.1", max: "1.5", step: "0.01", value: fx.godWeight, onChange: (e) => setFx({ ...fx, godWeight: parseFloat(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "Exposure: ",
          fx.godExposure.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.0", max: "1.0", step: "0.01", value: fx.godExposure, onChange: (e) => setFx({ ...fx, godExposure: parseFloat(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "ClampMax: ",
          fx.godClampMax.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.2", max: "2.0", step: "0.01", value: fx.godClampMax, onChange: (e) => setFx({ ...fx, godClampMax: parseFloat(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
          "Samples: ",
          fx.godSamples,
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "16", max: "120", step: "1", value: fx.godSamples, onChange: (e) => setFx({ ...fx, godSamples: parseInt(e.target.value, 10) }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Bloom: ",
        fx.bloom.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1.5", step: "0.01", value: fx.bloom, onChange: (e) => setFx({ ...fx, bloom: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Vignette: ",
        fx.vignette.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.01", value: fx.vignette, onChange: (e) => setFx({ ...fx, vignette: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Halftone (DotScreen)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: fx.dotEnabled, onChange: (e) => setFx({ ...fx, dotEnabled: e.target.checked }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Dot scale: ",
        fx.dotScale.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "3", step: "0.01", value: fx.dotScale, onChange: (e) => setFx({ ...fx, dotScale: parseFloat(e.target.value) }), disabled: !fx.dotEnabled })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Dot angle: ",
        fx.dotAngle.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "3.1416", step: "0.01", value: fx.dotAngle, onChange: (e) => setFx({ ...fx, dotAngle: parseFloat(e.target.value) }), disabled: !fx.dotEnabled })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex-1 block text-[11px] opacity-80", children: [
          "Center X: ",
          fx.dotCenterX.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.01", value: fx.dotCenterX, onChange: (e) => setFx({ ...fx, dotCenterX: parseFloat(e.target.value) }), disabled: !fx.dotEnabled })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex-1 block text-[11px] opacity-80", children: [
          "Center Y: ",
          fx.dotCenterY.toFixed(2),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.01", value: fx.dotCenterY, onChange: (e) => setFx({ ...fx, dotCenterY: parseFloat(e.target.value) }), disabled: !fx.dotEnabled })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Dot opacity: ",
        fx.dotOpacity.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.01", value: fx.dotOpacity, onChange: (e) => setFx({ ...fx, dotOpacity: parseFloat(e.target.value) }), disabled: !fx.dotEnabled })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Dot blend",
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "select",
          {
            className: "w-full bg-black/30 border border-white/10 rounded mt-1",
            value: fx.dotBlend,
            onChange: (e) => setFx({ ...fx, dotBlend: e.target.value }),
            disabled: !fx.dotEnabled,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "normal", children: "Normal" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "multiply", children: "Multiply" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "screen", children: "Screen" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "overlay", children: "Overlay" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "softlight", children: "SoftLight" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "add", children: "Add" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "darken", children: "Darken" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "lighten", children: "Lighten" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors transition-transform hover:translate-y-[-1px]",
          onClick: async () => {
            const preset = JSON.stringify(fx, null, 2);
            try {
              await navigator.clipboard.writeText(preset);
            } catch {
              const ta = document.createElement("textarea");
              ta.value = preset;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
            setCopiedFx(true);
            setTimeout(() => setCopiedFx(false), 1200);
          },
          children: copiedFx ? "¡Copiado!" : "Copiar preset FX"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Noise: ",
        fx.noise.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "0.6", step: "0.01", value: fx.noise, onChange: (e) => setFx({ ...fx, noise: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-px bg-white/10 my-2" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs font-semibold opacity-80", children: "Depth of Field" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Activar" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: fx.dofEnabled, onChange: (e) => setFx({ ...fx, dofEnabled: e.target.checked }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-[11px] opacity-80", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Progresivo" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: fx.dofProgressive, onChange: (e) => setFx({ ...fx, dofProgressive: e.target.checked }) })
      ] }),
      !fx.dofProgressive && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Focus distance: ",
        fx.dofFocusDistance.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.005", value: fx.dofFocusDistance, onChange: (e) => setFx({ ...fx, dofFocusDistance: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Focal length: ",
        fx.dofFocalLength.toFixed(3),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.001", max: "0.06", step: "0.001", value: fx.dofFocalLength, onChange: (e) => setFx({ ...fx, dofFocalLength: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Bokeh scale: ",
        fx.dofBokehScale.toFixed(1),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.5", max: "6", step: "0.1", value: fx.dofBokehScale, onChange: (e) => setFx({ ...fx, dofBokehScale: parseFloat(e.target.value) }) })
      ] }),
      fx.dofProgressive && /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Focus speed: ",
        fx.dofFocusSpeed.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.02", max: "0.5", step: "0.01", value: fx.dofFocusSpeed, onChange: (e) => setFx({ ...fx, dofFocusSpeed: parseFloat(e.target.value) }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        onClick: () => setShowLightPanel((v) => !v),
        className: "pointer-events-auto fixed right-4 top-4 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-xs grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]",
        "aria-label": "Toggle panel Luz",
        children: "Luz"
      }
    ),
    showLightPanel && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pointer-events-auto fixed right-4 top-16 w-56 p-3 rounded-md bg-black/50 text-white space-y-2 select-none", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors transition-transform hover:translate-y-[-1px]",
          onClick: async () => {
            const preset = JSON.stringify(topLight, null, 2);
            try {
              await navigator.clipboard.writeText(preset);
            } catch {
              const ta = document.createElement("textarea");
              ta.value = preset;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
          },
          children: "Copiar preset Luz"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs font-semibold opacity-80", children: "Luz superior" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Altura: ",
        topLight.height.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "2", max: "12", step: "0.05", value: topLight.height, onChange: (e) => setTopLight({ ...topLight, height: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Intensidad: ",
        topLight.intensity.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "8", step: "0.05", value: topLight.intensity, onChange: (e) => setTopLight({ ...topLight, intensity: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Ángulo: ",
        topLight.angle.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0.1", max: "1.2", step: "0.01", value: topLight.angle, onChange: (e) => setTopLight({ ...topLight, angle: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "block text-[11px] opacity-80", children: [
        "Penumbra: ",
        topLight.penumbra.toFixed(2),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: "w-full", type: "range", min: "0", max: "1", step: "0.01", value: topLight.penumbra, onChange: (e) => setTopLight({ ...topLight, penumbra: parseFloat(e.target.value) }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-px bg-white/10 my-2" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs font-semibold opacity-80", children: "Preloader Light" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors",
          onClick: async () => {
            const preset = JSON.stringify({ intensity: topLight.intensity, angle: topLight.angle, penumbra: topLight.penumbra, relativeFactor: 0.4 }, null, 2);
            try {
              await navigator.clipboard.writeText(preset);
            } catch {
              const ta = document.createElement("textarea");
              ta.value = preset;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
          },
          children: "Copiar preset Preloader"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "mt-1 w-full py-1.5 text-[12px] rounded bg-white/10 hover:bg-white/20 transition-colors",
          onClick: async () => {
            try {
              const pos = (window.__preLightPos || []).map((v) => Number(v));
              const tgt = (window.__preLightTarget || []).map((v) => Number(v));
              const payload = JSON.stringify({ position: pos, target: tgt }, null, 2);
              await navigator.clipboard.writeText(payload);
            } catch {
              const ta = document.createElement("textarea");
              const payload = JSON.stringify({ position: window.__preLightPos || [], target: window.__preLightTarget || [] }, null, 2);
              ta.value = payload;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand("copy");
              document.body.removeChild(ta);
            }
          },
          children: "Copiar posición/target"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      CharacterPortrait,
      {
        showUI: showPortraitPanel,
        dotEnabled: fx.dotEnabled,
        dotScale: fx.dotScale,
        dotAngle: fx.dotAngle,
        dotCenterX: fx.dotCenterX,
        dotCenterY: fx.dotCenterY,
        dotOpacity: fx.dotOpacity,
        dotBlend: fx.dotBlend,
        glowVersion: portraitGlowV,
        onEggActiveChange: setEggActive,
        zIndex: 600,
        showExit: section !== "home" && showSectionUi
      }
    ),
    isMobile && section === "home" && !orbActiveUi ? /* @__PURE__ */ jsxRuntimeExports.jsx(MobileJoystick, { centerX: true, bottomPx: 40, radius: 52 }) : null,
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        onClick: () => setShowPortraitPanel((v) => !v),
        className: "pointer-events-auto fixed right-4 top-40 h-9 w-9 rounded-full bg-black/60 hover:bg-black/70 text-white text-[10px] grid place-items-center shadow-md transition-transform hover:translate-y-[-1px]",
        "aria-label": "Toggle panel Retrato",
        children: "Ret"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "fixed inset-0 z-[50000] pointer-events-none", style: { background: "#000", opacity: blackoutVisible ? 1 : 0, transition: blackoutImmediate ? "none" : "opacity 300ms ease" } })
  ] });
}
function PreloaderCharacterWalk({ playerRef }) {
  const { scene, animations } = useGLTF(`${"/development/"}character.glb`, true);
  const groupRef = React.useRef();
  const model = React.useMemo(() => clone(scene), [scene]);
  const { actions } = useAnimations(animations, model);
  const headRef = React.useRef(null);
  React.useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    const explicitWalk = "root|root|Walking";
    const walkName = names.includes(explicitWalk) ? explicitWalk : names.find((n) => n.toLowerCase().includes("walk")) || names[1] || names[0];
    const idleName = names.find((n) => n.toLowerCase().includes("idle")) || names[0];
    if (idleName && actions[idleName]) {
      try {
        actions[idleName].stop();
      } catch {
      }
    }
    if (walkName && actions[walkName]) {
      const a = actions[walkName];
      a.reset().setEffectiveWeight(1).setLoop(LoopRepeat, Infinity).setEffectiveTimeScale(1.1).play();
    }
  }, [actions]);
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const sway = Math.sin(t * 1.2) * 0.25;
    groupRef.current.position.x = sway;
    groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.15;
  });
  reactExports.useEffect(() => {
    if (!model) return;
    let found = null;
    try {
      model.traverse((o) => {
        if (!found && /head/i.test(o?.name || "")) found = o;
      });
    } catch {
    }
    if (!found) {
      try {
        const box = new Box3().setFromObject(model);
        const c = new Vector3();
        box.getCenter(c);
        found = new Object3D();
        found.position.copy(c);
        model.add(found);
      } catch {
      }
    }
    headRef.current = found;
  }, [model]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("group", { ref: (el) => {
    groupRef.current = el;
    if (typeof playerRef?.current !== "undefined") playerRef.current = el;
  }, position: [0, 0, 0], children: /* @__PURE__ */ jsxRuntimeExports.jsx("primitive", { object: model, scale: 1.6, raycast: null }) });
}
function PreloaderOrbit({ playerRef, outHeadRef, radius = 6.2, startRadius = 9, rampMs = 1400, speed = 0.18, targetOffsetY = 1.6, startDelayMs = 1200 }) {
  const { camera } = useThree();
  const startTsRef = React.useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const headRef = React.useRef(null);
  reactExports.useEffect(() => {
    const root = playerRef?.current;
    if (!root) return;
    let found = null;
    try {
      root.traverse((o) => {
        if (!found && /head/i.test(o?.name || "")) found = o;
      });
    } catch {
    }
    if (!found) {
      try {
        const box = new Box3().setFromObject(root);
        const center = new Vector3();
        box.getCenter(center);
        found = new Object3D();
        found.position.copy(center);
        root.add(found);
      } catch {
      }
    }
    headRef.current = found;
    if (outHeadRef && typeof outHeadRef === "object") outHeadRef.current = found;
  }, [playerRef]);
  useFrame(() => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - startTsRef.current < startDelayMs) return;
    const tSec = (now - startTsRef.current - startDelayMs) / 1e3;
    const ang = tSec * speed;
    const head = new Vector3();
    try {
      if (headRef.current) headRef.current.getWorldPosition(head);
      else playerRef?.current?.getWorldPosition(head);
    } catch {
    }
    const rampT = Math.max(0, Math.min(1, (now - startTsRef.current) / Math.max(1, rampMs)));
    const ease = rampT * rampT * (3 - 2 * rampT);
    const r = MathUtils.lerp(startRadius, radius, ease);
    const x = head.x + Math.cos(ang) * r;
    const z = head.z + Math.sin(ang) * r;
    const y = head.y + (targetOffsetY || 0);
    camera.position.set(x, y, z);
    camera.lookAt(head.x, head.y + (targetOffsetY || 0), head.z);
  });
  return null;
}
function PreloaderPinLight({ playerRef }) {
  const lightRef = React.useRef();
  const [cfg, setCfg] = React.useState({ intensity: 14.4, distance: 21, decay: 0.65, color: "#ff8800", x: 0, y: 1.4, z: 0 });
  React.useEffect(() => {
    try {
      const p = playerRef?.current?.position || new Vector3(0, 0, 0);
      setCfg((c) => ({ ...c, x: p.x, z: p.z }));
    } catch {
    }
  }, [playerRef]);
  useFrame(() => {
    if (!lightRef.current) return;
    lightRef.current.position.set(cfg.x, cfg.y, cfg.z);
    window.__prePinLight = { position: [cfg.x, cfg.y, cfg.z], intensity: cfg.intensity, distance: cfg.distance, decay: cfg.decay, color: cfg.color };
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(jsxRuntimeExports.Fragment, { children: /* @__PURE__ */ jsxRuntimeExports.jsx("pointLight", { ref: lightRef, args: [cfg.color, cfg.intensity, cfg.distance, cfg.decay] }) });
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) })
);
