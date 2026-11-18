import * as THREE from 'three'

// Los cordones del hoodie se mecen con el movimiento (Oscar, 2026-11-17). Cada
// cordón lleva una cadena de huesos propios que cuelgan del pecho (spine_03):
// sin física siguen al pecho como piel (el retrato), y con ella (Player, el rig)
// son una cuerda de puntos con inercia, gravedad y un resorte suave hacia su
// forma de reposo, en el mundo (así se quedan atrás al caminar y girar), que no
// se mete en la tela: cada punto se queda del lado de afuera del pedazo de tela
// que tenía debajo en reposo, a la misma distancia. La malla no se reescribe: la
// GPU los dibuja con su skinning, como todo lo demás, y el contorno, la tinta y
// el despiece los siguen sin código aparte.

const SEGMENTOS = 6
export const CORDON = {
  SUB: 3,            // subpasos por cuadro (el pecho se reparte entre ellos: corriendo brinca ~0.5 m por cuadro)
  ITER: 4,           // vueltas de las restricciones por subpaso
  AMORTIGUA: 3,      // por segundo: lo que se mece respecto al cuerpo
  AIRE: 0.6,         // por segundo: lo que frena el aire (respecto al mundo): corriendo se van un poco atrás
  GRAVEDAD: 9.8,     // m/s² (el personaje mide en metros)
  REGRESO: 2.2,      // por segundo: qué tanto vuelve a su forma
  SIGUE: 0.9,        // de lo que corrige el largo de los tramos, cuánto no se vuelve velocidad (sin latigazos)
  SALTO: 0.5,        // m: si el pecho brinca más que esto en un cuadro, la cuerda se reacomoda
}
const MATERIALES = ['Hoodie_Cordon', 'Hoodie_Punta']

/**
 * Cadenas de huesos para los cordones del hoodie, antes de crear su esqueleto:
 * agrega los huesos a `huesos`/`reposos` (reposo en el espacio de la escena) y
 * repinta los pesos de los vértices de los cordones a lo largo de su cadena.
 * Regresa lo que necesita `pasoCordones` (o null).
 */
export function prepararCordones(geo, nombresMateriales, huesos, reposos, porNombre, raizInv) {
  const pecho = porNombre.spine_03x
  if (!pecho || !geo.index) return null
  const pos = geo.attributes.position, nor = geo.attributes.normal
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight
  const idx = geo.index
  const deCordon = new Set(), deTela = new Set()
  for (const gr of geo.groups) {
    const nombre = nombresMateriales[gr.materialIndex]
    const destino = MATERIALES.includes(nombre) ? deCordon : nombre === 'Hoodie_Tela' ? deTela : null
    if (!destino) continue
    for (let k = gr.start; k < gr.start + gr.count; k++) destino.add(idx.getX(k))
  }
  if (!deCordon.size || !deTela.size) return null
  const tela = [...deTela]
  const pechoReposo = new THREE.Matrix4().multiplyMatrices(raizInv, pecho.matrixWorld)
  const pechoReposoInv = pechoReposo.clone().invert()
  const lados = []
  for (const [lado, s] of [['l', 1], ['r', -1]]) {
    const vs = [...deCordon].filter((i) => pos.getX(i) * s > 0)
    if (!vs.length) continue
    let arriba = -Infinity, abajo = Infinity
    for (const i of vs) { arriba = Math.max(arriba, pos.getY(i)); abajo = Math.min(abajo, pos.getY(i)) }
    const paso = (arriba - abajo) / SEGMENTOS
    // los nudos de la cadena: el promedio de los vértices a su altura (los cordones cuelgan)
    const nudos = []
    for (let j = 0; j <= SEGMENTOS; j++) {
      const y = arriba - paso * j
      const p = new THREE.Vector3(); let n = 0
      for (const i of vs) {
        if (Math.abs(pos.getY(i) - y) > paso * 0.5) continue
        p.x += pos.getX(i); p.y += pos.getY(i); p.z += pos.getZ(i); n++
      }
      if (n) p.multiplyScalar(1 / n)
      else p.set(nudos[j - 1]?.x ?? 0, y, nudos[j - 1]?.z ?? 0)
      nudos.push(p)
    }
    const base = huesos.length
    const locales = []
    const t = new THREE.Matrix4(), local = new THREE.Matrix4()
    nudos.forEach((p, j) => {
      const b = new THREE.Bone()
      b.name = `cordon_${lado}_${j}`
      t.makeTranslation(p.x, p.y, p.z)
      local.multiplyMatrices(pechoReposoInv, t)
      local.decompose(b.position, b.quaternion, b.scale)
      pecho.add(b)
      b.updateMatrixWorld(true)
      huesos.push(b)
      reposos.push(t.clone())
      locales.push(local.clone())
    })
    // pesos: cada vértice entre los dos nudos de su altura
    for (const i of vs) {
      const y = pos.getY(i)
      const f = Math.min(Math.max((arriba - y) / paso, 0), SEGMENTOS - 1e-6)
      const j = Math.floor(f), w = f - j
      si.setXYZW(i, base + j, base + Math.min(j + 1, SEGMENTOS), 0, 0)
      sw.setXYZW(i, 1 - w, w, 0, 0)
    }
    // debajo de cada nudo, el pedazo de tela que no debe atravesar (con su piel de siempre)
    const sup = nudos.map((p) => {
      let mejor = -1, d2 = Infinity
      for (const i of tela) {
        const dx = pos.getX(i) - p.x, dy = pos.getY(i) - p.y, dz = pos.getZ(i) - p.z
        const d = dx * dx + dy * dy + dz * dz
        if (d < d2) { d2 = d; mejor = i }
      }
      const q = new THREE.Vector3().fromBufferAttribute(pos, mejor)
      const n = new THREE.Vector3().fromBufferAttribute(nor, mejor).normalize()
      return {
        p: q, n,
        h: [0, 1, 2, 3].map((c) => si.getComponent(mejor, c)),
        w: [0, 1, 2, 3].map((c) => sw.getComponent(mejor, c)),
        aire: Math.max(p.clone().sub(q).dot(n), 0.002),
      }
    })
    const largos = nudos.slice(1).map((p, j) => p.distanceTo(nudos[j]))
    lados.push({
      lado, base, nudos, locales, sup, largos,
      x: new Float64Array((SEGMENTOS + 1) * 3), antes: new Float64Array((SEGMENTOS + 1) * 3),
      // dónde iba cada nudo siguiendo al pecho el cuadro pasado (se reparte entre los subpasos)
      sigueAntes: new Float64Array((SEGMENTOS + 1) * 3),
    })
  }
  si.needsUpdate = true; sw.needsUpdate = true
  return lados.length ? { pecho, lados, listo: false, previo: new THREE.Vector3() } : null
}

const _F = new THREE.Matrix4(), _W = new THREE.Matrix4(), _M = new THREE.Matrix4(), _Pinv = new THREE.Matrix4()
const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3()
const _s = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3()
const _segue = [], _M4 = []

/** Un cuadro de los cordones (después del mixer y de las poses). `activo` en falso los deja seguir al pecho. */
export function pasoCordones(sm, dt, activo = true) {
  const C = sm?.userData?.cordones
  if (!C) return
  const pecho = C.pecho
  if (!activo || !sm.visible) {
    if (C.listo) {
      // de regreso a su reposo (siguen al pecho como piel)
      for (const L of C.lados) {
        L.locales.forEach((m, j) => m.decompose(sm.skeleton.bones[L.base + j].position, sm.skeleton.bones[L.base + j].quaternion, sm.skeleton.bones[L.base + j].scale))
      }
    }
    C.listo = false
    return
  }
  pecho.updateWorldMatrix(true, false)
  // unidades del mundo por metro del personaje (la escena del personaje puede ir escalada)
  const raiz = sm.parent
  const esc = raiz ? raiz.matrixWorld.getMaxScaleOnAxis() : 1
  const huesos = sm.skeleton.bones, inversas = sm.skeleton.boneInverses
  // los huesos del cuerpo en su lugar de este cuadro (para la tela de abajo)
  for (let k = 0; k < huesos.length; k++) {
    if (!_M4[k]) _M4[k] = new THREE.Matrix4()
    if (huesos[k].name.startsWith('cordon_')) continue
    huesos[k].updateWorldMatrix(true, false)
    _M4[k].multiplyMatrices(huesos[k].matrixWorld, inversas[k])
  }
  _Pinv.copy(pecho.matrixWorld).invert()
  const h = Math.min(Math.max(dt, 0), 0.05) / CORDON.SUB
  const g = CORDON.GRAVEDAD * esc
  const amort = Math.exp(-CORDON.AMORTIGUA * h)
  const aire = Math.exp(-CORDON.AIRE * h)
  const regreso = 1 - Math.exp(-CORDON.REGRESO * h)
  _a.setFromMatrixPosition(pecho.matrixWorld)
  const salto = C.listo && _a.distanceTo(C.previo) > CORDON.SALTO * esc
  C.previo.copy(_a)
  for (const L of C.lados) {
    const N = L.nudos.length
    while (_segue.length < N) _segue.push(new THREE.Vector3())
    for (let j = 0; j < N; j++) {
      _F.multiplyMatrices(pecho.matrixWorld, L.locales[j])
      _segue[j].setFromMatrixPosition(_F)
    }
    const x = L.x, xa = L.antes, sa = L.sigueAntes
    if (!C.listo || salto) {
      for (let j = 0; j < N; j++) {
        x[j * 3] = xa[j * 3] = sa[j * 3] = _segue[j].x
        x[j * 3 + 1] = xa[j * 3 + 1] = sa[j * 3 + 1] = _segue[j].y
        x[j * 3 + 2] = xa[j * 3 + 2] = sa[j * 3 + 2] = _segue[j].z
      }
    }
    // la tela de abajo de cada nudo, donde va ahora
    const sup = L.sup.map((S) => {
      _s.set(0, 0, 0); _n.set(0, 0, 0)
      for (let c = 0; c < 4; c++) {
        if (S.w[c] <= 0) continue
        _s.addScaledVector(_t.copy(S.p).applyMatrix4(_M4[S.h[c]]), S.w[c])
        _n.addScaledVector(_t.copy(S.n).transformDirection(_M4[S.h[c]]), S.w[c])
      }
      return [_s.x, _s.y, _s.z, ...(_n.normalize().toArray())]
    })
    const seg = [0, 0, 0], segAntes = [0, 0, 0]
    // dónde va el nudo j siguiendo al pecho a la fracción f del cuadro
    const sigue = (out, j, f) => {
      const o = j * 3
      out[0] = sa[o] + (_segue[j].x - sa[o]) * f; out[1] = sa[o + 1] + (_segue[j].y - sa[o + 1]) * f; out[2] = sa[o + 2] + (_segue[j].z - sa[o + 2]) * f
      return out
    }
    for (let sub = 0; sub < CORDON.SUB; sub++) {
      const f = (sub + 1) / CORDON.SUB, f0 = sub / CORDON.SUB
      sigue(seg, 0, f)
      x[0] = xa[0] = seg[0]; x[1] = xa[1] = seg[1]; x[2] = xa[2] = seg[2]
      for (let j = 1; j < N; j++) {
        const o = j * 3
        sigue(seg, j, f); sigue(segAntes, j, f0)
        for (let e = 0; e < 3; e++) {
          // lo que se mueve con el cuerpo se queda; lo que se mece respecto a él se frena
          const vc = seg[e] - segAntes[e]
          const v = (vc + (x[o + e] - xa[o + e] - vc) * amort) * aire
          xa[o + e] = x[o + e]
          x[o + e] += v
        }
        x[o + 1] -= g * h * h
        x[o] += (seg[0] - x[o]) * regreso
        x[o + 1] += (seg[1] - x[o + 1]) * regreso
        x[o + 2] += (seg[2] - x[o + 2]) * regreso
      }
      for (let it = 0; it < CORDON.ITER; it++) {
        for (let j = 1; j < N; j++) {
          const a = (j - 1) * 3, b = j * 3
          const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9
          const l0 = L.largos[j - 1] * esc
          const k = (d - l0) / d
          const wa = j === 1 ? 0 : 0.5, wb = j === 1 ? 1 : 0.5
          x[a] += dx * k * wa; x[a + 1] += dy * k * wa; x[a + 2] += dz * k * wa
          x[b] -= dx * k * wb; x[b + 1] -= dy * k * wb; x[b + 2] -= dz * k * wb
        }
        // del lado de afuera de la tela
        for (let j = 1; j < N; j++) {
          const o = j * 3, S = sup[j]
          const d = (x[o] - S[0]) * S[3] + (x[o + 1] - S[1]) * S[4] + (x[o + 2] - S[2]) * S[5] - L.sup[j].aire * esc
          if (d < 0) { x[o] -= S[3] * d; x[o + 1] -= S[4] * d; x[o + 2] -= S[5] * d }
        }
      }
      // y al final cada tramo con su largo exacto, desde el ancla (un cordón no se estira); de lo que
      // corrige, casi nada se vuelve velocidad
      for (let j = 1; j < N; j++) {
        const a = (j - 1) * 3, b = j * 3
        const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9
        const l0 = L.largos[j - 1] * esc
        const nx = x[a] + dx / d * l0, ny = x[a + 1] + dy / d * l0, nz = x[a + 2] + dz / d * l0
        xa[b] += (nx - x[b]) * CORDON.SIGUE; xa[b + 1] += (ny - x[b + 1]) * CORDON.SIGUE; xa[b + 2] += (nz - x[b + 2]) * CORDON.SIGUE
        x[b] = nx; x[b + 1] = ny; x[b + 2] = nz
      }
    }
    for (let j = 0; j < N; j++) { sa[j * 3] = _segue[j].x; sa[j * 3 + 1] = _segue[j].y; sa[j * 3 + 2] = _segue[j].z }
    // cada hueso: del reposo que sigue al pecho, girado hacia donde apunta su tramo y llevado a su punto
    for (let j = 0; j < N; j++) {
      const j0 = j < N - 1 ? j : j - 1, j1 = j0 + 1
      _a.subVectors(_segue[j1], _segue[j0]).normalize()
      _b.set(x[j1 * 3] - x[j0 * 3], x[j1 * 3 + 1] - x[j0 * 3 + 1], x[j1 * 3 + 2] - x[j0 * 3 + 2]).normalize()
      _q.setFromUnitVectors(_a, _b)
      _F.multiplyMatrices(pecho.matrixWorld, L.locales[j])
      _W.makeRotationFromQuaternion(_q)
      _v.set(x[j * 3], x[j * 3 + 1], x[j * 3 + 2])
      // W = T(x) · R · T(−segue) · F
      _M.makeTranslation(-_segue[j].x, -_segue[j].y, -_segue[j].z)
      _W.multiply(_M).multiply(_F)
      _W.setPosition(_v.x + _W.elements[12], _v.y + _W.elements[13], _v.z + _W.elements[14])
      const hueso = huesos[L.base + j]
      _M.multiplyMatrices(_Pinv, _W)
      _M.decompose(hueso.position, hueso.quaternion, hueso.scale)
    }
  }
  C.listo = true
}
