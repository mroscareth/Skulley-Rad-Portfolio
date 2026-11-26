import React, { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { armarPintado } from '../../lib/pintado.js'
import { compileAsyncSafe } from '../../lib/compileAsyncSafe.js'
import { cargarGrupoEstilo, copiaLocal } from '../../lib/cargarEstilo.js'
import { setObstaculosExtra } from '../../lib/obstaculosHome.js'
import { LUGARES } from '../../lib/plazaOfrenda.js'
import { ofrendaPuesta, ofrendaEnMano } from '../../lib/ofrendas.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'

// Un hito labrado detrás de cada lugar de la plaza de la ofrenda (Oscar, 2026-11-25: "las piedras del
// portal de SKULLEYGLYPH… cámbialas por las que platicamos ayer"; reemplazan a las estelas, menhires
// chicos del bosque). En su panel, FREEBIES en runas de SKULLEYGLYPH en bajorrelieve (Oscar: la sección 6
// se va a llamar así), en el idioma de la barra, que se prende en naranja cuando la ofrenda de ese lugar
// está puesta, como las estelas. Si el GLB no trae FREEBIES, cada una dice el nombre de su ofrenda.
// Modelo: scripts/estilo/props_hitos.py → props_hitos.glb (la misma piedra que se probó en los portales).
// Las runas de los dos idiomas van montadas y la del otro se encoge a casi nada (cambiar de idioma no
// compila). Se arma fuera de la escena cuando llega el GLB y se compila antes de montarse.
// Con su objeto en el inventario, el hito llama a Skulley cuando se acerca (Oscar, 2026-11-25): late
// más fuerte y más rápido entre más cerca, hasta que al llegar a la corona el objeto se pone solo.

const VERSION = 4
const NADA = 1e-4

export const HITOS_OFRENDA = {
  escala: 1.6,       // el GLB está en metros reales (la piedra mide 1.67 m)
  solido: 0.32,      // radio del círculo sólido, en metros reales (como el de la estela)
  color: '#ff7a1a',  // el naranja de la ofrenda (COLOR_OFRENDA de BosquePintado)
  fuerza: 2.1,       // lo que se prende con la ofrenda puesta (lo de las estelas: 2.6 × 0.83 por ser claro)
  base: 0.08,        // lo que brillan apagadas
  prende: 1.5,       // s en prenderse
  apaga: 0.6,
  llamaLejos: 15,    // con su objeto en el inventario: desde aquí empieza a llamar (m del hito)…
  llamaCerca: 4,     // …y aquí llama a todo
  llamaFuerza: 1.8,
  llamaHz: 1.6,
}

export default function HitosOfrenda({ visible = true, playerRef }) {
  const { gl, camera, scene } = useThree()
  const { lang } = useLanguage()
  const [armado, setArmado] = useState(null)
  const hitos = useRef([])

  useEffect(() => {
    let vivo = true
    cargarGrupoEstilo('hitos', VERSION).then(async (gltf) => {
      const piedra = gltf?.scene.getObjectByName('Prop_HitoPortal')
      if (!vivo || !piedra) return
      const H = HITOS_OFRENDA
      const raiz = new THREE.Group()
      raiz.name = 'HitosOfrenda'
      const nuevos = []
      const solidos = []
      for (const l of LUGARES) {
        const g = new THREE.Group()
        g.position.set(l.estela.x, 0, l.estela.z)
        g.rotation.y = l.estela.rot
        g.scale.setScalar(H.escala)
        const cuerpo = armarPintado(copiaLocal(piedra))
        g.add(cuerpo.grupo)
        const runas = {}
        for (const idioma of ['en', 'es']) {
          const n = gltf.scene.getObjectByName(`Prop_HitoPortal_Runas_freebies_${idioma}`)
            || gltf.scene.getObjectByName(`Prop_HitoPortal_Runas_${l.id}_${idioma}`)
          if (!n) continue
          const r = armarPintado(copiaLocal(n))
          // armarPintado le da materiales propios a cada copia: cada hito se prende por su cuenta
          const mats = []
          r.grupo.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) mats.push(o.material) })
          g.add(r.grupo)
          runas[idioma] = { pintado: r, mats }
        }
        raiz.add(g)
        nuevos.push({ id: l.id, grupo: g, cuerpo, runas, brillo: ofrendaPuesta(l.id) ? 1 : 0, fase: nuevos.length * 1.3 })
        solidos.push({ x: l.estela.x, z: l.estela.z, r: H.solido * H.escala, esfera: true })
      }
      raiz.updateMatrixWorld(true)
      const rt = new THREE.WebGLRenderTarget(16, 16)
      try { await compileAsyncSafe(gl, raiz, camera, 10000, rt, scene) } catch { }
      rt.dispose()
      if (!vivo) return
      hitos.current = nuevos
      setObstaculosExtra('hitosOfrenda', solidos)
      setArmado(raiz)
    }).catch((e) => console.warn('[hitos de la ofrenda] no se armaron', e))
    return () => { vivo = false; setObstaculosExtra('hitosOfrenda', []) }
  }, [gl, camera, scene])

  // el idioma de la barra: las runas del otro se encogen a casi nada
  useEffect(() => {
    for (const h of hitos.current) {
      for (const [idioma, r] of Object.entries(h.runas)) r.pintado.grupo.scale.setScalar(idioma === lang ? 1 : NADA)
    }
  }, [lang, armado])

  const color = useRef(new THREE.Color(HITOS_OFRENDA.color))
  const _c = useRef(new THREE.Color())
  useFrame((state, delta) => {
    if (!armado || !visible) return
    const H = HITOS_OFRENDA
    const dt = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime
    const p = playerRef?.current?.position
    for (const h of hitos.current) {
      h.cuerpo.medir(state)
      const meta = ofrendaPuesta(h.id) ? 1 : 0
      h.brillo += Math.max(-dt / H.apaga, Math.min(dt / H.prende, meta - h.brillo))
      const pulso = 0.85 + 0.15 * Math.sin(t * 2.4 + h.fase)
      // llama: su objeto en el inventario y Skulley acercándose
      let llama = 0
      if (p && ofrendaEnMano(h.id)) {
        const d = Math.hypot(p.x - h.grupo.position.x, p.z - h.grupo.position.z)
        llama = Math.min(1, Math.max(0, (H.llamaLejos - d) / (H.llamaLejos - H.llamaCerca)))
      }
      h.llama = (h.llama || 0) + (llama - (h.llama || 0)) * (1 - Math.exp(-4 * dt))
      const late = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * H.llamaHz * (1 + h.llama))
      _c.current.copy(color.current).multiplyScalar(H.base + H.fuerza * h.brillo * pulso + H.llamaFuerza * h.llama * (0.35 + 0.65 * late))
      for (const r of Object.values(h.runas)) {
        r.pintado.medir(state)
        for (const m of r.mats) m.emissive.copy(_c.current)
      }
    }
  })

  if (typeof window !== 'undefined' && import.meta.env.DEV) window.__hitosOfrenda = { hitos: hitos.current, HITOS_OFRENDA }
  return armado ? <primitive object={armado} visible={visible} /> : null
}
