import { useRef, useEffect } from 'react'

// Preview ANIMADO del shader de cada skin en el selector (mini-canvas WebGL con
// un puerto 2D del look: oil/hologram/void/lava/slime). Para base/gold (no shader)
// o cuando el customizer está cerrado, cae al gradiente CSS (`skin.swatch`) y NO
// crea contexto WebGL. Los canvases se montan solo con `active` → no gastan
// contextos cuando el modo customize no está abierto.

// Ticker compartido: un solo rAF dibuja todos los swatches vivos.
const liveDraws = new Set()
let rafId = null
let startMs = 0
function now() { try { return performance.now() } catch { return 0 } }
function tick() {
  rafId = null
  if (liveDraws.size === 0) return
  const t = (now() - startMs) / 1000
  liveDraws.forEach((fn) => { try { fn(t) } catch { } })
  rafId = requestAnimationFrame(tick)
}
function ensureTicker() {
  if (rafId == null && liveDraws.size > 0) {
    if (!startMs) startMs = now()
    rafId = requestAnimationFrame(tick)
  }
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform int uMode;
vec3 iriPal(float t){ return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0,0.33,0.67))); }
float hash31(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash31(i+vec3(0.,0.,0.)),b=hash31(i+vec3(1.,0.,0.)),c=hash31(i+vec3(0.,1.,0.)),d=hash31(i+vec3(1.,1.,0.));
  float e=hash31(i+vec3(0.,0.,1.)),g=hash31(i+vec3(1.,0.,1.)),h=hash31(i+vec3(0.,1.,1.)),k=hash31(i+vec3(1.,1.,1.));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y),mix(mix(e,g,f.x),mix(h,k,f.x),f.y),f.z); }
vec3 hash33(vec3 p){ p=fract(p*vec3(0.1031,0.1030,0.0973)); p+=dot(p,p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
vec2 worley(vec3 p){ vec3 ip=floor(p); vec3 fp=fract(p); float f1=9.9; float f2=9.9;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 g=vec3(float(x),float(y),float(z)); vec3 r=g+hash33(ip+g)-fp; float dd=dot(r,r);
    if(dd<f1){ f2=f1; f1=dd; } else if(dd<f2){ f2=dd; } }
  return vec2(sqrt(f1), sqrt(f2)); }
void main(){
  vec2 uv = vUv * 2.0 - 1.0;
  float r = length(uv);
  float fres = clamp(r, 0.0, 1.0);            // fake fresnel (borde del disco)
  float t = uTime;
  vec3 p = vec3(uv*1.4, t*0.12);
  vec3 col = vec3(0.1);
  if (uMode == 1) {
    float flow = sin(uv.y*7.0 + t*1.1)*0.5 + sin(uv.x*5.0 - t*0.8)*0.3;
    col = iriPal(fres*0.7 + flow*0.22 + t*0.03);
  } else if (uMode == 2) {
    float scan = 0.55 + 0.45*sin(uv.y*42.0 - t*7.0);
    col = iriPal(fres*0.4 + 0.55 + t*0.04) * (0.55 + 0.45*scan) + fres*0.3;
  } else if (uMode == 3) {
    vec3 cell = floor(p*14.0);
    float star = step(0.985, hash31(cell));
    float tw = 0.6 + 0.4*sin(t*3.0 + hash31(cell)*30.0);
    col = vec3(0.015,0.0,0.04) + star*tw*vec3(0.7,0.85,1.0);
    col += iriPal(fres*1.2 + t*0.02)*0.12*fres;
  } else if (uMode == 4) {
    vec2 w = worley(vec3(uv*1.8, t*0.1));
    float ed = w.y - w.x;
    float lava = 1.0 - smoothstep(0.0, 0.28, ed);
    float core = 1.0 - smoothstep(0.0, 0.10, ed);
    vec3 hot = mix(vec3(0.55,0.02,0.0), vec3(1.0,0.22,0.0), smoothstep(0.0,0.5,lava));
    hot = mix(hot, vec3(1.0,0.5,0.05), core);
    col = mix(vec3(0.035,0.012,0.008), hot, lava);
  } else if (uMode == 5) {
    float mott = vnoise(vec3(uv*4.0, t*0.4));
    vec3 green = vec3(0.05,0.82,0.03);
    vec3 hi = vec3(0.55,1.0,0.28);
    float lz = clamp(mott*0.65 + (1.0-fres)*0.35, 0.0, 1.0);
    col = mix(green, hi, lz*0.6);
    float blob = vnoise(vec3(uv*3.0, t*0.22 + 5.0));
    col = mix(col, green*0.28, smoothstep(0.58,0.16,blob)*0.7);
    col += vec3(0.30,1.0,0.15) * pow(fres,2.5) * 0.9;
  } else if (uMode == 6) {
    // GOLD — oro rico oscuro + sparkles de 4 picos (mismo lenguaje que skinShaders modo 6).
    float shine = pow(0.5 + 0.5*sin(uv.y*7.0 - t*1.8 + fres*5.0), 10.0);
    vec3 gd = vec3(0.24,0.12,0.015), gb = vec3(0.74,0.48,0.045), gh = vec3(1.0,0.79,0.26);
    col = mix(gd, gb, smoothstep(0.0, 0.7, 1.0 - fres));
    col = mix(col, gh, clamp(shine*0.85, 0.0, 1.0));
    vec2 sc = floor(uv*5.0);
    float sr1 = hash31(vec3(sc,0.0)), sr2 = hash31(vec3(sc,7.0)), sr3 = hash31(vec3(sc,3.0));
    vec2 sctr = vec2(0.5) + (vec2(sr1,sr2)-0.5)*0.5;
    vec2 sd = abs(fract(uv*5.0) - sctr) / 0.34;
    float stw = pow(0.5 + 0.5*sin(t*3.0 + sr3*6.2832), 3.0);
    float shas = step(0.74, sr3);
    float star = max(0.0,1.0-(sd.x+sd.y*7.0)) + max(0.0,1.0-(sd.y+sd.x*7.0));
    col += vec3(1.0,0.96,0.78) * star * stw * shas * 1.1;
  }
  gl_FragColor = vec4(col, 1.0);
}
`

export default function SkinSwatch({ skin, active = false }) {
  const mode = skin?.type === 'shader' ? (skin.shaderMode || 0) : 0
  const useGL = active && mode > 0
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!useGL) return
    const canvas = canvasRef.current
    if (!canvas) return
    let gl = null
    let cleanup = () => { }
    try {
      gl = canvas.getContext('webgl', { antialias: true, alpha: false, depth: false, premultipliedAlpha: false })
      if (!gl) return
      const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VERT); gl.compileShader(vs)
      const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs, FRAG); gl.compileShader(fs)
      const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
      gl.useProgram(prog)
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
      const aPos = gl.getAttribLocation(prog, 'aPos')
      gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
      const uTime = gl.getUniformLocation(prog, 'uTime')
      const uMode = gl.getUniformLocation(prog, 'uMode')
      const draw = (t) => {
        try {
          gl.viewport(0, 0, canvas.width, canvas.height)
          gl.uniform1f(uTime, t)
          gl.uniform1i(uMode, mode)
          gl.drawArrays(gl.TRIANGLES, 0, 3)
        } catch { }
      }
      liveDraws.add(draw)
      ensureTicker()
      cleanup = () => {
        liveDraws.delete(draw)
        try { gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs) } catch { }
      }
    } catch { }
    return cleanup
  }, [useGL, mode])

  if (!useGL) {
    return <span className="absolute inset-0 rounded-full" style={{ background: skin?.swatch }} aria-hidden />
  }
  return <canvas ref={canvasRef} width={72} height={72} className="absolute inset-0 w-full h-full rounded-full" aria-hidden />
}
