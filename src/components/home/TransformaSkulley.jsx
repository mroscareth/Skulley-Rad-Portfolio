import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { crearParticulas } from '../../lib/particulasSkulley.js'
import { transforma } from '../../lib/transformaSkulley.js'
import { ocultarSkulley } from '../../lib/inventarioEscena.js'

// La transformación en su lugar (lib/transformaSkulley.js): los mismos puntos del viaje a una sección, pero en
// la escena normal y sin la trama. Todos salen a la vez de su pose (sin el corte de la trama no hay cómo
// esconderlo de los pies a la cabeza), con los colores del cuadro de antes; ya deshecho cambia la skin y los
// puntos regresan, de la cabeza a los pies, en los verdes de Poltergeist. Montado siempre (los puntos fuera
// de cuadro mientras no se usan): su programa se compila con la escena.
const T = { sale: 0.05, vida: 0.82, cambia: 0.35 }
const VERDES = ['#0a4a2e', '#1fa865', '#3ddc84', '#8dffc0']

function texturaVerde() {
  const n = 8
  const datos = new Uint8Array(n * n * 4)
  for (let i = 0; i < n * n; i++) {
    const c = new THREE.Color(VERDES[Math.floor(Math.random() * VERDES.length)])
    datos[i * 4] = Math.round(c.r * 255)
    datos[i * 4 + 1] = Math.round(c.g * 255)
    datos[i * 4 + 2] = Math.round(c.b * 255)
    datos[i * 4 + 3] = 255
  }
  const t = new THREE.DataTexture(datos, n, n)
  t.minFilter = THREE.NearestFilter
  t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
}

export default function TransformaSkulley({ playerRef }) {
  const { gl, camera } = useThree()
  const recursos = useMemo(() => ({ particulas: crearParticulas(), verde: texturaVerde(), tam: new THREE.Vector2(), v: new THREE.Vector3() }), [])
  const foto = useRef(null)
  const est = useRef(null)
  useEffect(() => {
    recursos.particulas.t = -1
    recursos.particulas.puntos.renderOrder = 20
    return () => { recursos.particulas.dispose(); recursos.verde.dispose(); foto.current?.dispose() }
  }, [recursos])

  const tamPuntos = (alto) => {
    const p = playerRef.current
    const { v } = recursos
    const pies = v.set(p.position.x, alto[0], p.position.z).project(camera).y
    const cabeza = v.set(p.position.x, alto[1], p.position.z).project(camera).y
    gl.getDrawingBufferSize(recursos.tam)
    recursos.particulas.tam = Math.abs(cabeza - pies) * 0.5 * recursos.tam.y * 0.034
  }

  useFrame((_, delta) => {
    const pedido = transforma.pedido
    const p = playerRef.current
    const P = recursos.particulas
    if (!pedido || !p) {
      // se acabó a medias (el tope de lib/transformaSkulley.js): que no se quede oculto
      if (est.current) { est.current = null; P.t = -1; ocultarSkulley(false) }
      return
    }
    const dt = Math.min(delta, 0.05)
    let e = est.current
    if (!e || e.pedido !== pedido) {
      // primer cuadro: los puntos salen de la pose de ahorita y la foto se toma ya dibujado este cuadro
      const alto = P.suelta(p, T.sale) || [p.position.y, p.position.y + 3]
      P.apunta(camera)
      tamPuntos(alto)
      e = est.current = { pedido, etapa: 'foto', t: 0, alto }
      return
    }
    if (e.etapa === 'foto') {
      if (!e.foto) return
      ocultarSkulley(true)
      P.foto = foto.current
      try { window.dispatchEvent(new CustomEvent('character-color-burst', { detail: { life: 1.1, spread: 0.3 } })) } catch { }
      e.etapa = 'sale'
      e.t = 0
    }
    e.t += dt
    if (e.etapa === 'sale') {
      P.t = e.t
      if (e.t >= T.sale + T.vida) {
        P.t = -1
        if (!pedido.oculto) { pedido.oculto = true; try { pedido.alOcultar?.() } catch { } }
        e.etapa = 'cambia'
        e.t = 0
      }
    } else if (e.etapa === 'cambia') {
      if (e.t >= T.cambia) {
        e.alto = P.suelta(p, T.sale) || e.alto
        P.apunta(camera)
        tamPuntos(e.alto)
        P.foto = recursos.verde
        e.etapa = 'entra'
        e.t = 0
      }
    } else if (e.etapa === 'entra') {
      const total = T.sale + T.vida
      P.t = Math.max(0, total - e.t)
      if (e.t >= total) {
        P.t = -1
        ocultarSkulley(false)
        est.current = null
        transforma.pedido = null
        pedido.listo()
      }
    }
  })

  // Ya dibujado el cuadro (el composer va en 1): la foto de cómo se veía, para el color de cada punto.
  useFrame(() => {
    const e = est.current
    if (!e || e.etapa !== 'foto' || e.foto) return
    const m = gl.getDrawingBufferSize(recursos.tam)
    if (foto.current?.image.width !== m.x || foto.current?.image.height !== m.y) {
      foto.current?.dispose()
      foto.current = new THREE.FramebufferTexture(m.x, m.y)
      foto.current.minFilter = THREE.NearestFilter
      foto.current.magFilter = THREE.NearestFilter
    }
    gl.copyFramebufferToTexture(foto.current)
    e.foto = true
  }, 2)

  return <primitive object={recursos.particulas.puntos} />
}
