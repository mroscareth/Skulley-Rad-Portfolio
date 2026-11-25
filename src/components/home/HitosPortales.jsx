import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { sectionColors } from '../../lib/appHelpers.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'

// Un hito de piedra labrada detrás de cada portal (Oscar, 2026-11-24): reemplaza a los dos menhires
// que tenía cada uno ("las piedras de los portales de hoy no me gustan"; el hito de los props del mapa
// que se descartó le gustó mucho). En su panel, el nombre de la sección en runas de SKULLEYGLYPH en
// bajorrelieve, en el idioma de la barra, que se prende del color de su portal con Skulley cerca, como
// hacían los menhires. Modelos: scripts/estilo/props_hitos.py → public/3dmodels/estilo/props_hitos.glb.
// Las runas de los dos idiomas van montadas; la del otro idioma se encoge a casi nada (cambiar de
// idioma no compila). Se arma fuera de la escena cuando llega el GLB y se compila antes de montarse.

const VERSION = 1

export const HITOS = {
  radio: 19.6,       // detrás de cada portal, donde iban los menhires
  escala: 2.2,       // la de los props: el GLB está en metros reales
  solido: 0.5,       // radio del círculo sólido, en metros reales del hito
  brillo: 2.6,       // lo que se prende con Skulley en el portal
  base: 0.1,         // lo que brillan siempre (como los menhires)
}

const NADA = 1e-4
const _c = new THREE.Color()

export default function HitosPortales({ portales, portalMixMap, visible = true }) {
  const { gl, camera, scene } = useThree()
  const { lang } = useLanguage()
  const [armado, setArmado] = useState(null)
  const hitos = useRef([])
  const mezcla = useRef(portalMixMap)
  mezcla.current = portalMixMap
  const lista = (portales || []).filter((p) => !p.antimatter)
  const llavePortales = lista.map((p) => `${p.id}:${p.position.join(',')}`).join('|')

  useEffect(() => {
    let vivo = true
    cargarGrupoEstilo('hitos', VERSION).then(async (gltf) => {
      const piedra = gltf?.scene.getObjectByName('Prop_HitoPortal')
      if (!vivo || !piedra) return
      const raiz = new THREE.Group()
      raiz.name = 'HitosPortales'
      const nuevos = []
      const solidos = []
      for (const p of lista) {
        const g = new THREE.Group()
        const ang = Math.atan2(p.position[2], p.position[0])
        g.position.set(Math.cos(ang) * HITOS.radio, 0, Math.sin(ang) * HITOS.radio)
        // de espaldas al portal, de frente al centro, como iban los menhires (Oscar)
        g.rotation.y = Math.atan2(-g.position.x, -g.position.z)
        g.scale.setScalar(HITOS.escala)
        const cuerpo = armarPintado(copiaLocal(piedra))
        g.add(cuerpo.grupo)
        const runas = {}
        for (const idioma of ['en', 'es']) {
          const n = gltf.scene.getObjectByName(`Prop_HitoPortal_Runas_${p.id}_${idioma}`)
          if (!n) continue
          const r = armarPintado(copiaLocal(n))
          // armarPintado le da materiales propios a cada copia: cada portal brilla de su color
          const mats = []
          r.grupo.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) mats.push(o.material) })
          g.add(r.grupo)
          runas[idioma] = { pintado: r, mats }
        }
        raiz.add(g)
        nuevos.push({ id: p.id, grupo: g, cuerpo, runas, color: new THREE.Color(sectionColors[p.id] || '#ffffff'), brillo: 0, fase: nuevos.length * 1.7 })
        solidos.push({ x: g.position.x, z: g.position.z, r: HITOS.solido * HITOS.escala })
      }
      raiz.updateMatrixWorld(true)
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, raiz, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) return
      hitos.current = nuevos
      setObstaculosExtra('hitos', solidos)
      setArmado(raiz)
    }).catch((e) => console.warn('[hitos] no se armaron', e))
    return () => { vivo = false; setObstaculosExtra('hitos', []) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, scene, llavePortales])

  // el idioma de la barra: las runas del otro se encogen a casi nada
  useEffect(() => {
    for (const h of hitos.current) {
      for (const [idioma, r] of Object.entries(h.runas)) r.pintado.grupo.scale.setScalar(idioma === lang ? 1 : NADA)
    }
  }, [lang, armado])

  useFrame((state, delta) => {
    if (!armado || !visible) return
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    for (const h of hitos.current) {
      h.cuerpo.medir(state)
      const meta = Math.min(1, mezcla.current?.[h.id] || 0)
      h.brillo += Math.max(-dt / 0.6, Math.min(dt / 0.35, meta - h.brillo))
      // los colores claros (el amarillo de Contacto) se lavaban a blanco con el bloom
      const lum = 0.2126 * h.color.r + 0.7152 * h.color.g + 0.0722 * h.color.b
      const k = 1 - 0.5 * Math.min(1, lum)
      const pulso = 0.85 + 0.15 * Math.sin(t * 2.4 + h.fase)
      _c.copy(h.color).multiplyScalar(k * (HITOS.base + HITOS.brillo * h.brillo * pulso))
      for (const r of Object.values(h.runas)) {
        r.pintado.medir(state)
        for (const m of r.mats) m.emissive.copy(_c)
      }
    }
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__hitosPortales = { hitos: hitos.current, HITOS }
  return armado ? <primitive object={armado} visible={visible} /> : null
}
