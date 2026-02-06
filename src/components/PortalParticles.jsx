import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Count reduced from 240 to 150 for better performance
export default function PortalParticles({ center = [0, 0, 0], radius = 3.5, count = 150, color = '#c7d2fe', targetColor = '#ffffff', mix = 0, playerRef, frenzyRadius = 10 }) {
  const MAX_BONES = 32
  // Per-particle base parameters
  const aBaseAngle = useMemo(() => new Float32Array(count), [count])
  const aBaseRadius = useMemo(() => new Float32Array(count), [count])
  const aBaseY = useMemo(() => new Float32Array(count), [count])
  const aSize = useMemo(() => new Float32Array(count), [count])
  const aFreq = useMemo(() => new Float32Array(count), [count])
  const aSeed = useMemo(() => new Float32Array(count), [count])
  const aTight = useMemo(() => new Float32Array(count), [count])
  const aBoneSlot = useMemo(() => new Float32Array(count), [count])
  const centerVec = useMemo(() => new THREE.Vector3().fromArray(center), [center])
  const pointsRef = useRef()
  const geoRef = useRef()
  const materialRef = useRef()
  const bonesRef = useRef([])
  const modelRootRef = useRef(null)
  const tmpRef = useRef({ world: new THREE.Vector3(), bone: new THREE.Vector3() })

  // Initialize per-particle attributes
  useMemo(() => {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2
      // Portal interior fill: radius in [0..radius] biased toward edge
      const t = Math.random()
      const r = radius * Math.pow(t, 0.65)
      aBaseAngle[i] = angle
      aBaseRadius[i] = r
      // Strong upward bias: deterministic pseudo-random by index
      const pr = Math.sin((i + 0.5) * 12.9898) * 43758.5453
      const u = pr - Math.floor(pr) // fract(pr)
      const up = u * u * u
      aBaseY[i] = up * 1.6 - 0.2
      aSize[i] = 0.3 + Math.random() * 0.5 // much smaller, tiny fireflies
      aFreq[i] = 0.6 + Math.random() * 0.8 // faster base motion/twinkle
      aSeed[i] = Math.random() * Math.PI * 2
      aTight[i] = 0.05 + Math.random() * 0.12
      aBoneSlot[i] = Math.floor(Math.random() * MAX_BONES)
    }
  }, [count, radius, aBaseAngle, aBaseRadius, aBaseY, aSize, aFreq, aSeed, aTight])

  // Shader uniforms: keep stable object to avoid recreations
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3().fromArray(center) },
    uPlayer: { value: new THREE.Vector3() },
    uFrenzy: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uTargetColor: { value: new THREE.Color(targetColor) },
    uMix: { value: mix },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uRadius: { value: radius },
    uBoneCount: { value: 0 },
    uBones: { value: new Array(MAX_BONES).fill(0).map(() => new THREE.Vector3()) },
  })
  useEffect(() => {
    const u = uniformsRef.current
    u.uCenter.value.fromArray(center)
    u.uColor.value.set(color)
    u.uTargetColor.value.set(targetColor)
    u.uRadius.value = radius
    u.uMix.value = mix
  }, [center, color, targetColor, radius, mix])

  useFrame((state) => {
    const uniforms = uniformsRef.current
    uniforms.uMix.value = mix
    uniforms.uTargetColor.value.set(targetColor)
    uniforms.uTime.value = state.clock.getElapsedTime()
    // Sync real renderer DPR in case it changes via mobile heuristics
    if (state.gl) {
      const dpr = state.gl.getPixelRatio ? state.gl.getPixelRatio() : window.devicePixelRatio || 1
      uniforms.uPixelRatio.value = Math.min(dpr, 2)
    }
    if (playerRef?.current) {
      // Search for bones robustly; retry until found
      if (bonesRef.current.length === 0) {
        let skinned = null
        playerRef.current.traverse((o) => {
          if (!skinned && o.isSkinnedMesh && o.skeleton) skinned = o
        })
        if (skinned && skinned.skeleton && skinned.skeleton.bones?.length) {
          bonesRef.current = skinned.skeleton.bones.slice()
        } else {
          // Fallback: collect Bone nodes from player tree
          const collected = []
          playerRef.current.traverse((o) => { if (o.isBone) collected.push(o) })
          if (collected.length) bonesRef.current = collected
        }
      }
      const boneCount = Math.min(MAX_BONES, bonesRef.current.length)
      uniforms.uBoneCount.value = boneCount
      const groupWorld = pointsRef.current ? pointsRef.current.getWorldPosition(tmpRef.current.world) : centerVec
      if (boneCount > 0) {
        for (let i = 0; i < MAX_BONES; i += 1) {
          const v = uniforms.uBones.value[i]
          if (i < boneCount) {
            bonesRef.current[i].getWorldPosition(tmpRef.current.bone)
            v.copy(tmpRef.current.bone).sub(groupWorld)
          } else {
            v.set(0, 0, 0)
          }
        }
      }
      const d = groupWorld.distanceTo(playerRef.current.position)
      uniforms.uFrenzy.value = THREE.MathUtils.clamp(1 - d / frenzyRadius, 0, 1)
      uniforms.uPlayer.value.copy(playerRef.current.position).sub(groupWorld)
      uniforms.uCenter.value.set(0, 0, 0)
    } else {
      uniformsRef.current.uFrenzy.value = 0
    }
  })

  // Dummy position attribute to define vertex count for Three.js
  const dummyPosition = useMemo(() => new Float32Array(count * 3), [count])

  // Configure geometry once to avoid re-creations by JSX
  useEffect(() => {
    if (!geoRef.current) return
    const g = geoRef.current
    try {
      g.setAttribute('position', new THREE.BufferAttribute(dummyPosition, 3))
      g.setAttribute('aBaseAngle', new THREE.BufferAttribute(aBaseAngle, 1))
      g.setAttribute('aBaseRadius', new THREE.BufferAttribute(aBaseRadius, 1))
      g.setAttribute('aBaseY', new THREE.BufferAttribute(aBaseY, 1))
      g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
      g.setAttribute('aFreq', new THREE.BufferAttribute(aFreq, 1))
      g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))
      g.setAttribute('aTight', new THREE.BufferAttribute(aTight, 1))
      g.setAttribute('aBoneSlot', new THREE.BufferAttribute(aBoneSlot, 1))
      g.computeBoundingSphere()
    } catch {}
  }, [geoRef, dummyPosition, aBaseAngle, aBaseRadius, aBaseY, aSize, aFreq, aSeed, aTight, aBoneSlot])

  return (
    <points ref={pointsRef} frustumCulled={false} renderOrder={-25}>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        depthTest={true}
        blending={THREE.AdditiveBlending}
        uniforms={uniformsRef.current}
        vertexShader={`
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

            // ---- Phase control: scatter → attract ----
            // Scatter: particles break ring formation chaotically (frenzy 0→0.5)
            // Attract: each particle individually drifts to its bone (frenzy 0.35→1.0)
            float scatterPhase = smoothstep(0.0, 0.5, uFrenzy);
            float attractPhase = smoothstep(0.35, 1.0, uFrenzy);
            // Per-particle timing offset for organic staggered transitions
            float pDelay = fract(aSeed * 2.71828);
            float myScatter = smoothstep(pDelay * 0.2, pDelay * 0.2 + 0.5, scatterPhase);
            float myAttract = smoothstep(pDelay * 0.3, pDelay * 0.3 + 0.5, attractPhase);

            // ---- Angle: gentle constant rotation, NO frenzy speedup ----
            float ang = aBaseAngle
              + uTime * (0.06 + aFreq * 0.04)
              + sin(uTime * 0.18 + aSeed) * 0.08;

            // ---- Radius: chaotic scatter instead of group expansion ----
            float rWave = 1.0 + 0.03 * sin(uTime * 0.18 + aSeed);
            float rBase = aBaseRadius * rWave;
            // Each particle scatters in a unique radial direction
            float scatterSign = sign(sin(aSeed * 17.3));
            float scatterMag = 0.4 + 0.6 * fract(aSeed * 7.13);
            float r = rBase * (1.0 + scatterSign * scatterMag * myScatter * 0.7);

            float y = (aBaseY * (1.0 + 0.3 * myScatter)) + 0.2 * sin(uTime * 0.28 + aSeed);
            // Scatter adds per-particle vertical chaos
            y += sin(aSeed * 11.7 + uTime * 0.6) * 0.7 * myScatter * (1.0 - myAttract);

            // ---- Bone target (anchor Y toward portal to prevent falling with player) ----
            int boneCount = int(uBoneCount);
            int slot = int(mod(aBoneSlot, max(float(boneCount), 1.0)));
            vec3 bonePos = (boneCount > 0) ? uBones[slot] : uCenter;
            // Only follow bone Y when very close (quadratic ramp); at low frenzy stay at portal height
            bonePos.y = mix(uCenter.y, bonePos.y, uFrenzy * uFrenzy);

            // ---- Build scattered ring position ----
            vec3 ringPos = vec3(cos(ang) * r, y, sin(ang) * r) + uCenter;

            // 3D scatter displacement: each particle flies in its own direction
            vec3 scatterDir = normalize(vec3(
              sin(aSeed * 3.7 + 1.2),
              sin(aSeed * 5.3 - 0.8) * 0.5,
              cos(aSeed * 4.1 + 2.5)
            ));
            // Animate scatter with per-particle frequency
            vec3 scatterAnim = scatterDir
              * (sin(uTime * (0.8 + aFreq * 0.3) + aSeed * 2.0) * 0.3 + 0.7);
            vec3 scatteredPos = ringPos
              + scatterAnim * myScatter * uRadius * 0.35 * (1.0 - myAttract);

            // ---- Individually attract toward bone (keep floating distance) ----
            // Cap blend at 0.75 so particles orbit NEAR the bone, not ON it
            vec3 pos = mix(scatteredPos, bonePos, myAttract * 0.75);

            // Wider orbit around bone so particles visibly float around the body
            vec3 p1 = normalize(vec3(sin(aSeed*1.3), 0.0, cos(aSeed*2.1)));
            vec3 p2 = normalize(cross(p1, vec3(0.0,1.0,0.0)));
            float lr = (aTight * 3.5 + 0.35) * myAttract;
            vec3 localOrb = p1 * sin(uTime*(2.2 + aFreq*1.5)) + p2 * cos(uTime*(2.6 + aFreq));
            pos += localOrb * lr;

            // Free 3D wander (keep more alive when attracted)
            float wanderScale = 1.0 - myAttract * 0.35;
            float amp = 0.6 + 0.6 * myScatter;
            vec3 wander = vec3(
              sin(uTime * (0.55 + aFreq) + aSeed * 1.1) + sin(uTime * 0.73 + aSeed * 2.0),
              sin(uTime * (0.41 + aFreq) + aSeed * 1.7),
              cos(uTime * (0.47 + aFreq * 0.9) + aSeed * 1.3)
            ) * 0.25 * amp * wanderScale;
            pos += wander;

            // Swarm: steer toward the player ONLY when nearby (uFrenzy > 0)
            vec3 dir = normalize(uPlayer - pos + vec3(0.0, 1.2, 0.0));
            float h = fract(sin(aSeed * 12.9898) * 43758.5453);
            vec3 up = vec3(0.0, 1.0, 0.0);
            vec3 ortho = normalize(cross(dir, up));
            float wiggle = sin(uTime * (1.8 + aFreq) + aSeed) * 0.6 + cos(uTime * 1.4 + aSeed * 1.7) * 0.4;
            vec3 steer = dir * (1.6 + 1.2 * h) + ortho * (0.55 * wiggle) + up * (0.5 * sin(uTime * 1.25 + aSeed * 2.2));
            // Steer activates only when player is reasonably close (smoothstep threshold)
            float steerStrength = 1.15 * smoothstep(0.25, 0.6, uFrenzy) * (1.0 - myAttract * 0.45);
            pos += steer * steerStrength;

            // Clamp to max radius around the effective center (portal or bone)
            vec3 effectiveCenter = mix(uCenter, bonePos, myAttract);
            float maxR = mix(uRadius * 1.35, 2.8, myAttract);
            vec3 fromC = pos - effectiveCenter;
            float dist = length(fromC);
            if (dist > maxR) {
              fromC *= (maxR / dist);
              pos = effectiveCenter + fromC;
            }

            // Avoid staying low: only push up when player is actively near the portal
            if (uFrenzy > 0.3) {
              float minY = uPlayer.y - 0.4;
              if (pos.y < minY) {
                pos.y = mix(pos.y, minY, 0.6 * uFrenzy);
              }
            }
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            float perspectiveSize = aSize * (0.6 + 0.7 * vLife) * (1.0 + 0.1 * uFrenzy);
            gl_PointSize = perspectiveSize * (180.0 / max(1.0, -mvPosition.z)) * uPixelRatio;
          }
        `}
        fragmentShader={`
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
        `}
      />
    </points>
  )
}


