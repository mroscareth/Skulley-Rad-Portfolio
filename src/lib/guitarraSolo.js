import * as THREE from 'three'
import { estadoGuitarra, escalaPua } from './siestaSkulley.js'

// La guitarra del solo (Egg_Guitarra, ponerGuitarra en accesorios.js) en un cuadro del clip Guitarra: la usan Player
// y el visor de idles. Va colgada del pecho con un esqueleto propio de un hueso; todo lo que le pasa encima (la caída
// dando vueltas, encogerse en ceniza) se mete en el inverso de ese hueso, así el contorno y la tinta, que comparten
// el esqueleto, la siguen sin compilar nada:
//   hueso · inverso' = W · hueso · inverso · S   →   inverso' = hueso⁻¹ · W · hueso · inverso · S
// con S la escala desde su centro (en reposo) y W la caída y el giro en el mundo. Lo quemado oscurece el color de sus
// materiales hacia el carbón y le prende un brillo de brasa (uniforms). La púa (Egg_GuitarraPua, del pulgar) crece
// en su mano al cacharla y se encoge al soltarla, por el inverso de su hueso igual.
// Fuera del solo ninguna de las dos se oculta: se encogen a casi nada (`NADA`). Oculta, three no la compilaba con la
// escena y su programa se compilaba al caer (medido en /world: 1 programa en el cuadro 21); así entra al warm-up.

const CARBON = new THREE.Color('#140d0b')
const BRASA = new THREE.Color('#ff5a14')
const NADA = 1e-4

function crearPua(mallas) {
  const pua = mallas.find((m) => m.name === 'Egg_GuitarraPua')
  if (!pua?.skeleton) return null
  pua.geometry.computeBoundingBox()
  const c = pua.geometry.boundingBox.getCenter(new THREE.Vector3())
  const esq = pua.skeleton
  const inv0 = esq.boneInverses[0].clone()
  const S = new THREE.Matrix4()
  const a = new THREE.Matrix4()
  const b = new THREE.Matrix4()
  return (k) => {
    k = Math.max(NADA, k)
    S.makeTranslation(c.x, c.y, c.z).multiply(a.makeScale(k, k, k)).multiply(b.makeTranslation(-c.x, -c.y, -c.z))
    esq.boneInverses[0].copy(inv0).multiply(S)
  }
}

export function crearGuitarraSolo(escena) {
  const todas = []
  escena.traverse((o) => { if (o.isMesh && o.name.startsWith('Egg_Guitarra')) todas.push(o) })
  const mallas = todas.filter((o) => !o.name.startsWith('Egg_GuitarraPua'))
  const ponPua = crearPua(todas.filter((o) => o.name.startsWith('Egg_GuitarraPua')))
  const cuerpo = mallas.find((m) => m.name === 'Egg_Guitarra')
  if (!cuerpo?.skeleton) return null
  const geo = cuerpo.geometry
  geo.computeBoundingBox()
  const centro = geo.boundingBox.getCenter(new THREE.Vector3())
  const pos = geo.attributes.position
  const esq = cuerpo.skeleton
  const hueso = esq.bones[0]
  const inv0 = esq.boneInverses[0].clone()
  const t = {
    S: new THREE.Matrix4(), W: new THREE.Matrix4(), B: new THREE.Matrix4(), Bi: new THREE.Matrix4(),
    a: new THREE.Matrix4(), b: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), cw: new THREE.Vector3(),
  }
  let colores = null // material → { color, emissive } de antes de quemarla
  const materiales = () => [].concat(cuerpo.material).filter(Boolean)
  const quemar = (k) => {
    if (k <= 0) {
      if (colores) for (const [m, c] of colores) { m.color.copy(c.color); if (m.emissive) m.emissive.copy(c.emissive) }
      colores = null
      return
    }
    if (!colores) colores = new Map(materiales().map((m) => [m, { color: m.color.clone(), emissive: m.emissive ? m.emissive.clone() : null }]))
    for (const [m, c] of colores) {
      m.color.copy(c.color).lerp(CARBON, 0.92 * k)
      if (m.emissive) m.emissive.copy(c.emissive).lerp(BRASA, 0.35 * Math.sin(Math.PI * Math.min(1, k * 1.2)))
    }
  }

  return {
    mallas,
    // `f`: cuadro del clip; `peso`: lo que pesa el clip (si lo cortan se encoge con la mezcla); `eje`: hacia dónde
    // gira cayendo (Vector3 en el mundo: la vista, así se ve la vuelta). Regresa el estado del cuadro o null.
    aplicar(f, peso = 1, eje = null) {
      ponPua?.(escalaPua(f) * Math.min(1, peso / 0.6))
      const e = f == null ? null : estadoGuitarra(f)
      const esc = e ? e.escala * Math.min(1, peso / 0.6) : 0
      if (!e || esc < 0.001) {
        quemar(0)
        t.S.makeTranslation(centro.x, centro.y, centro.z).multiply(t.a.makeScale(NADA, NADA, NADA)).multiply(t.b.makeTranslation(-centro.x, -centro.y, -centro.z))
        esq.boneInverses[0].copy(inv0).multiply(t.S)
        return null
      }
      quemar(e.carbon)
      hueso.updateWorldMatrix(true, false)
      t.B.copy(hueso.matrixWorld)
      // S: la escala desde su centro, en reposo
      t.S.makeTranslation(centro.x, centro.y, centro.z).multiply(t.a.makeScale(esc, esc, esc)).multiply(t.b.makeTranslation(-centro.x, -centro.y, -centro.z))
      // W: la caída y la vuelta alrededor de su centro en el mundo
      t.cw.copy(centro).applyMatrix4(t.a.multiplyMatrices(t.B, inv0))
      if (e.alto > 0 || e.giro !== 0) {
        t.q.setFromAxisAngle(eje ? t.v.copy(eje).normalize() : t.v.set(0, 0, 1), e.giro)
        t.W.makeTranslation(t.cw.x, t.cw.y + e.alto, t.cw.z).multiply(t.a.makeRotationFromQuaternion(t.q)).multiply(t.b.makeTranslation(-t.cw.x, -t.cw.y, -t.cw.z))
        t.Bi.copy(t.B).invert()
        esq.boneInverses[0].copy(t.Bi).multiply(t.W).multiply(t.B).multiply(inv0).multiply(t.S)
      } else {
        esq.boneInverses[0].copy(inv0).multiply(t.S)
      }
      e.centro = t.cw.clone()
      e.centro.y += e.alto
      return e
    },
    // un punto al azar de la guitarra en el mundo (de dónde sale el fuego), con lo que tenga puesto ahora
    puntoAlAzar(destino) {
      const i = Math.floor(Math.random() * pos.count)
      destino.fromBufferAttribute(pos, i)
      t.a.multiplyMatrices(hueso.matrixWorld, esq.boneInverses[0])
      return destino.applyMatrix4(t.a)
    },
  }
}
