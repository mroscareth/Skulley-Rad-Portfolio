import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'

// Un letrero de neón OPEN en runas junto al portal de la tienda (Oscar, 2026-11-24: de los props del
// mapa que se descartó quiso rescatar los neones). Letras de bloque con estructura sobre dos postes de
// PTR en dados de concreto, con su transformador (scripts/estilo/props_claro.py). Los tubos los prende
// y los hace parpadear pintado.js (NEON, color `Open`: el magenta de la tienda). Se arma fuera de la
// escena cuando llega el GLB y se compila antes de montarse.

const VERSION = 1

export const LETRERO_CLARO = {
  // a un lado del portal de la tienda (144°), por fuera, donde no estorba al hito de detrás
  angulo: 130,
  radio: 21,
  giro: Math.PI,   // su frente (+z del GLB) hacia la cámara
  escala: 2.2,
  postes: [-0.72, 0.72], // x de sus postes, en metros reales
}

export default function LetreroClaro({ visible = true }) {
  const { gl, camera, scene } = useThree()
  const [armado, setArmado] = useState(null)
  const pintado = useRef(null)

  useEffect(() => {
    let vivo = true
    cargarGrupoEstilo('claro', VERSION).then(async (gltf) => {
      const nodo = gltf?.scene.getObjectByName('Prop_LetreroOpen')
      if (!vivo || !nodo) return
      const L = LETRERO_CLARO
      const a = (L.angulo * Math.PI) / 180
      const raiz = new THREE.Group()
      raiz.name = 'LetreroClaro'
      raiz.position.set(Math.sin(a) * L.radio, 0, -Math.cos(a) * L.radio)
      raiz.rotation.y = L.giro
      raiz.scale.setScalar(L.escala)
      const p = armarPintado(copiaLocal(nodo))
      raiz.add(p.grupo)
      raiz.updateMatrixWorld(true)
      // sólidos: los dos postes con sus dados
      const v = new THREE.Vector3()
      const solidos = L.postes.map((x) => {
        v.set(x, 0, 0).applyMatrix4(raiz.matrixWorld)
        return { x: v.x, z: v.z, r: 0.3 * L.escala }
      })
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, raiz, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) return
      pintado.current = p
      setObstaculosExtra('letrero', solidos)
      setArmado(raiz)
    }).catch((e) => console.warn('[letrero] no se armó', e))
    return () => { vivo = false; setObstaculosExtra('letrero', []) }
  }, [gl, camera, scene])

  useFrame((state) => {
    if (!armado || !visible) return
    pintado.current?.medir(state)
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__letreroClaro = { armado, LETRERO_CLARO }
  return armado ? <primitive object={armado} visible={visible} /> : null
}
