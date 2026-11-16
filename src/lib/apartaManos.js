import * as THREE from 'three'

// Con los bóxers puestos, las manos no los atraviesan (Oscar, 2026-11-16).
// Al caminar el clip pasa las manos rozando la cadera (a 12 cm del centro,
// más adentro que la pelvis) y se metían hasta 9.6 cm en la tela; en el idle
// la derecha, 2.8 cm. Esto es una capa después del mixer y de las poses
// (patada, láser): mide qué tanto entra cada mano en el volumen de los bóxers
// y abre el brazo desde el hombro (arm_stretch, que lleva consigo los huesos
// de giro, el antebrazo y la mano) justo lo necesario. Es continua (empuja lo
// que se mete, sin mínimo fijo). Abrirse de golpe en cada paso se veía como
// brinco (Oscar): abre en unos cuadros (ABRE_S), con unos centímetros de
// anticipación para que eso no deje pasar la mano (MARGEN), y sostiene la
// apertura casi un segundo (SOSTIENE_S): caminando se queda abierto parejo.
//
// El volumen vive en el reposo de cada hueso (metros, y hacia arriba, el
// frente en +z): un elipse de cadera en la pelvis y un cilindro por pierna en
// cada muslo, del tamaño de los bóxers ya holgados.

// Medido sobre la tela en reposo: cadera ±0.2195 de ancho, frente 0.187 y
// atrás 0.201 desde su centro; pierna 0.12–0.13 del eje del muslo.
const CADERA = { y0: 0.57, y1: 0.75, A: 0.2195, Bf: 0.187, Bb: 0.201, cz: -0.004 }
const PIERNA = { r: 0.125, tMax: 0.72 }
const MARGEN = 0.014
const ABRE_S = 0.07
const SOSTIENE_S = 0.9
const ITER = 3

const DEDOS = ['index', 'middle', 'pinky', 'thumb']

export function crearApartaManos(escena, reposoDe) {
  const B = {}
  escena.traverse((o) => { if (o.isBone) B[o.name] = o })
  if (!B.rootx || !B.thigh_twistl || !B.thigh_twistr || !B.arm_stretchl || !B.arm_stretchr) return null
  const R = {
    raiz: reposoDe(B.rootx).invert(),
    musloL: reposoDe(B.thigh_twistl).invert(),
    musloR: reposoDe(B.thigh_twistr).invert(),
  }
  const cadera = [B.thigh_twistl, B.thigh_twistr].map((b) => new THREE.Vector3().setFromMatrixPosition(reposoDe(b)))
  const rodilla = ['leg_stretchl', 'leg_stretchr'].map((n, k) => {
    const b = B[n]
    if (!b) return cadera[k].clone().add(new THREE.Vector3(0, -0.244, 0.082))
    return new THREE.Vector3().setFromMatrixPosition(reposoDe(b))
  })
  const lados = ['l', 'r'].map((s) => {
    const puntos = []
    const h = B[`hand${s}`]
    if (h) puntos.push({ a: h, r: 0.045 })
    for (const d of DEDOS) {
      const cadena = [1, 2, 3].map((k) => B[`${d}${k}${s}`]).filter(Boolean)
      cadena.forEach((b) => puntos.push({ a: b, r: d === 'thumb' ? 0.024 : 0.022 }))
      if (cadena.length >= 2) puntos.push({ a: cadena[cadena.length - 1], b: cadena[cadena.length - 2], r: 0.02 })
      if (h && cadena[0]) puntos.push({ a: h, b: cadena[0], mitad: true, r: 0.045 })
    }
    if (B[`forearm_twist${s}`]) puntos.push({ a: B[`forearm_twist${s}`], r: 0.038 })
    // Vértices reales de la mano (las piezas de character.glb de mano y dedos):
    // con esferas en las articulaciones el volumen salía grueso y al correr
    // abría los brazos 44° sin que las manos tocaran la tela.
    const muestras = []
    escena.traverse((o) => {
      const si = o.isSkinnedMesh && o.geometry?.attributes?.skinIndex
      if (!si || o.userData?.accesorio) return
      const b = o.skeleton?.bones?.[si.getX(0)]
      const m = b && /^(hand|index|middle|pinky|thumb)\d*(?:_base)?([lr])$/.exec(b.name)
      if (m && m[2] === s) muestras.push(o)
    })
    const total = muestras.reduce((a, o) => a + o.geometry.attributes.position.count, 0)
    const paso = Math.max(1, Math.ceil(total / 90))
    const vertices = muestras.map((o) => {
      const n = o.geometry.attributes.position.count
      const idx = []
      for (let i = 0; i < n; i += paso) idx.push(i)
      return { malla: o, idx }
    })
    return { brazo: B[`arm_stretch${s}`], puntos, vertices, crudo: new THREE.Quaternion(), rv: new THREE.Vector3(), sostiene: new THREE.Vector3(), necesita: 0, tieneCrudo: false }
  })

  const M = { raiz: new THREE.Matrix4(), l: new THREE.Matrix4(), r: new THREE.Matrix4() }
  const Mi = { raiz: new THREE.Matrix4(), l: new THREE.Matrix4(), r: new THREE.Matrix4() }
  const p = new THREE.Vector3(), q = new THREE.Vector3(), u = new THREE.Vector3(), n = new THREE.Vector3()
  const eAx = new THREE.Vector3(), ePt = new THREE.Vector3(), eDir = new THREE.Vector3()
  const hombro = new THREE.Vector3(), eje = new THREE.Vector3(), mejorN = new THREE.Vector3(), mejorP = new THREE.Vector3()
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qw = new THREE.Quaternion()

  const matrices = () => {
    M.raiz.multiplyMatrices(B.rootx.matrixWorld, R.raiz); Mi.raiz.copy(M.raiz).invert()
    M.l.multiplyMatrices(B.thigh_twistl.matrixWorld, R.musloL); Mi.l.copy(M.l).invert()
    M.r.multiplyMatrices(B.thigh_twistr.matrixWorld, R.musloR); Mi.r.copy(M.r).invert()
  }

  // Lo más que se mete una esfera (centro en mundo, radio en metros) y hacia dónde salir.
  const hondura = (c, rad, esc, salida) => {
    let peor = 0
    const rr = rad + MARGEN
    u.copy(c).applyMatrix4(Mi.raiz)
    if (u.y > CADERA.y0 - rr && u.y < CADERA.y1 + rr) {
      const dz = u.z - CADERA.cz
      const Bz = dz > 0 ? CADERA.Bf : CADERA.Bb
      const s = Math.sqrt((u.x / CADERA.A) ** 2 + (dz / Bz) ** 2)
      const rp = Math.hypot(u.x, dz)
      if (s > 1e-4) {
        const d = rp / s + rr - rp
        if (d > peor) {
          peor = d
          salida.set(u.x / (CADERA.A * CADERA.A), 0, dz / (Bz * Bz)).normalize().transformDirection(M.raiz)
        }
      }
    }
    for (let k = 0; k < 2; k++) {
      const Mk = k ? M.r : M.l, Mik = k ? Mi.r : Mi.l
      u.copy(c).applyMatrix4(Mik)
      const a = cadera[k], b = rodilla[k]
      eAx.subVectors(b, a)
      const L2 = eAx.lengthSq()
      const t = ((u.x - a.x) * eAx.x + (u.y - a.y) * eAx.y + (u.z - a.z) * eAx.z) / L2
      if (t < 0 || t > PIERNA.tMax) continue
      ePt.copy(a).addScaledVector(eAx, t)
      eDir.subVectors(u, ePt)
      const dist = eDir.length()
      const d = PIERNA.r + rr - dist
      if (d > peor && dist > 1e-5) {
        peor = d
        salida.copy(eDir).multiplyScalar(1 / dist).transformDirection(Mk)
      }
    }
    return peor * esc
  }

  const centro = (pt, out) => {
    out.setFromMatrixPosition(pt.a.matrixWorld)
    if (pt.b) {
      q.setFromMatrixPosition(pt.b.matrixWorld)
      if (pt.mitad) out.lerp(q, 0.5)
      else out.addScaledVector(q.sub(out).negate(), 0.9)   // la punta: un tramo más allá de la última falange
    }
    return out
  }

  // Gira el brazo en mundo (rotación vector rv, en el espacio del padre del brazo).
  const girar = (lado, rv) => {
    const br = lado.brazo
    br.quaternion.copy(lado.crudo)
    const ang = rv.length()
    if (ang > 1e-6) {
      br.parent.getWorldQuaternion(qp)
      eje.copy(rv).multiplyScalar(1 / ang).applyQuaternion(qp)
      qa.setFromAxisAngle(eje, ang)
      qw.copy(qp).multiply(br.quaternion)
      qw.premultiply(qa)
      br.quaternion.copy(qp.invert()).multiply(qw)
    }
    br.updateMatrixWorld(true)
  }

  return {
    lados,
    // Antes del mixer: si el mixer no corre este cuadro, el brazo regresa a lo que dejó.
    restaurar() {
      for (const l of lados) if (l.tieneCrudo) l.brazo.quaternion.copy(l.crudo)
    },
    aplicar(dt, activo) {
      // window.__sinApartar (desarrollo): sin la capa, para medir contra qué se compara
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.__sinApartar) activo = false
      B.rootx.updateWorldMatrix(true, false)
      B.thigh_twistl.updateWorldMatrix(true, false)
      B.thigh_twistr.updateWorldMatrix(true, false)
      matrices()
      const esc = Math.hypot(M.raiz.elements[0], M.raiz.elements[1], M.raiz.elements[2])
      const t = Math.max(dt, 0)
      const decae = Math.exp(-t / SOSTIENE_S)
      const abre = 1 - Math.exp(-t / ABRE_S)
      for (const lado of lados) {
        lado.brazo.updateWorldMatrix(true, true)
        lado.crudo.copy(lado.brazo.quaternion); lado.tieneCrudo = true
        const necesita = new THREE.Vector3()
        if (activo) {
          for (let it = 0; it < ITER; it++) {
            girar(lado, necesita)
            let peor = 0
            if (lado.vertices.length) {
              for (const { malla, idx } of lado.vertices) {
                for (let k = 0; k < idx.length; k++) {
                  malla.getVertexPosition(idx[k], p).applyMatrix4(malla.matrixWorld)
                  const d = hondura(p, 0, esc, n)
                  if (d > peor) { peor = d; mejorN.copy(n); mejorP.copy(p) }
                }
              }
            } else {
              for (const pt of lado.puntos) {
                centro(pt, p)
                const d = hondura(p, pt.r, esc, n)
                if (d > peor) { peor = d; mejorN.copy(n); mejorP.copy(p) }
              }
            }
            if (peor <= 1e-5) break
            // Girar por el eje q × n mueve el punto hacia n a razón de |q × n|
            // por radián: el ángulo es lo que se mete entre eso.
            hombro.setFromMatrixPosition(lado.brazo.matrixWorld)
            q.subVectors(mejorP, hombro)
            eje.crossVectors(q, mejorN)
            const lp = eje.length()
            if (lp < 1e-6) break
            // a coordenadas del padre del brazo, para que se pueda suavizar
            lado.brazo.parent.getWorldQuaternion(qp)
            eje.multiplyScalar(1 / lp).applyQuaternion(qp.invert())
            necesita.addScaledVector(eje, peor / lp)
          }
        }
        // lo más que ha necesitado hace poco, y hacia allá se abre suave
        lado.sostiene.multiplyScalar(decae)
        if (necesita.length() >= lado.sostiene.length()) lado.sostiene.copy(necesita)
        lado.rv.lerp(lado.sostiene, abre)
        girar(lado, lado.rv)
        lado.necesita = necesita.length()
      }
    },
  }
}
