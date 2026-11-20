import * as THREE from 'three'
import { crearArticulado } from './cuerpoArticulado.js'

// Los lentes de Customize (accesorios.js, malla `Egg_Lentes`) como tres
// piezas con bisagras: el armazón y las dos patas, con su física
// (cuerpoArticulado.js). Los usa el rig cuando se los picas (PicarOjos en
// SkulleyFallRig) y sirven para cualquier otro lugar donde se caigan, como el
// despiece del juego (Oscar, 2026-11-17: que se vea cuando Skulley se despieza).
//
// Uso: `const l = armarLentesArticulados(malla)` una vez (en reposo; no depende
// de la pose); al tirarlos, `l.cuerpo.colocar(q, centro, v, w)` con el giro de
// reposo a donde van y `centro` = `l.centroReposo` llevado ahí; cada cuadro,
// `l.cuerpo.paso(dt, g, piso)` y `ponerPiezasLentes(l)`. Las piezas son
// mallas sin esqueleto con el material de los lentes, ya marcadas para la
// tinta y la sombra (`__disassembleOwned`); quien las use las cuelga de su
// contenedor (el espacio en que corre la física).

// Medidas de lentes.glb en reposo (si cambia el modelo, se vuelven a medir):
// lo de atrás de `bisagraZ` son las patas; el eje de cada bisagra es vertical,
// en ±`bisagraX`, de `bisagraY[0]` a `bisagraY[1]`.
export const LENTES_BISAGRAS = {
  muestra: 3000,     // vértices para la masa y los apoyos (traen ~27 mil)
  bisagraZ: 0.232,
  bisagraX: 0.226,
  bisagraY: [1.505, 1.540],
  cierra: 1.5,       // rad: dobladas casi contra las micas
  abre: -0.1,        // rad: lo que se abren de más
}

// Las de lentes3d.glb (Oscar, 2026-11-19; las da bisagras() de
// scripts/skulley-anim/lentes3d.py). El plano queda entre la lengüeta del
// armazón y el principio de las patas (0.3 mm de cada lado) y el eje, en la
// esquina de adentro de la pata: doblada queda detrás del plano, sin meterse
// en el armazón, como el cartón que se dobla en la orilla.
export const LENTES3D_BISAGRAS = {
  ...LENTES_BISAGRAS,
  bisagraZ: 0.2441,
  bisagraX: 0.224,
  bisagraY: [1.5111, 1.5363],
}

// Qué lentes caen con bisagras, por su id de accesorio (accesorios.js)
export const BISAGRAS_DE = { lentes: LENTES_BISAGRAS, lentes3d: LENTES3D_BISAGRAS }

/** Las tres piezas y su física. Cada vértice es del armazón o de una pata
 *  según dónde queda respecto a la bisagra; cada triángulo, de la pieza de la
 *  mayoría de sus vértices. */
export function armarLentesArticulados(malla, C = LENTES_BISAGRAS) {
  const src = malla.geometry
  const pos = src.attributes.position, nor = src.attributes.normal
  const n = pos.count
  const parte = new Uint8Array(n)
  for (let i = 0; i < n; i++) parte[i] = pos.getZ(i) >= C.bisagraZ ? 0 : (pos.getX(i) > 0 ? 1 : 2)
  // muestra de vértices de cada pieza, centrada en el centro de todo
  const cada = Math.max(1, Math.floor(n / C.muestra))
  const centro = [0, 0, 0]
  let cuantos = 0
  for (let i = 0; i < n; i += cada) { centro[0] += pos.getX(i); centro[1] += pos.getY(i); centro[2] += pos.getZ(i); cuantos++ }
  centro[0] /= cuantos; centro[1] /= cuantos; centro[2] /= cuantos
  const puntos = [[], [], []]
  for (let i = 0; i < n; i += cada) puntos[parte[i]].push([pos.getX(i) - centro[0], pos.getY(i) - centro[1], pos.getZ(i) - centro[2]])
  const eje = (sx) => C.bisagraY.map((y) => [sx * C.bisagraX - centro[0], y - centro[1], C.bisagraZ - centro[2]])
  const cuerpo = crearArticulado(puntos.map((p) => ({ puntos: p })), [
    { a: 0, b: 1, eje: eje(1), dir: 1, cierra: C.cierra, abre: C.abre },
    { a: 0, b: 2, eje: eje(-1), dir: -1, cierra: C.cierra, abre: C.abre },
  ])
  // geometría de cada pieza: todos los vértices, centrados en el centro de
  // su grupo, y solo sus triángulos (por material)
  const idx = src.index ? src.index.array : null
  const piezas = [0, 1, 2].map((k) => {
    const c0 = cuerpo.grupos[k].c0
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pos.getX(i) - centro[0] - c0[0]
      arr[i * 3 + 1] = pos.getY(i) - centro[1] - c0[1]
      arr[i * 3 + 2] = pos.getZ(i) - centro[2] - c0[2]
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    if (nor) g.setAttribute('normal', nor.clone())
    const tri = []
    const grupos = src.groups.length ? src.groups : [{ start: 0, count: idx ? idx.length : n, materialIndex: 0 }]
    for (const gr of grupos) {
      const inicio = tri.length
      for (let t = gr.start; t < gr.start + gr.count; t += 3) {
        const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2
        const pa = parte[a], pb = parte[b], pc = parte[c]
        const de = (pa === pb || pa === pc) ? pa : (pb === pc ? pb : pa)
        if (de === k) tri.push(a, b, c)
      }
      if (tri.length > inicio) g.addGroup(inicio, tri.length - inicio, gr.materialIndex)
    }
    g.setIndex(tri)
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, malla.material)
    m.frustumCulled = false
    m.userData.__disassembleOwned = true
    return m
  })
  return { piezas, cuerpo, centroReposo: new THREE.Vector3(centro[0], centro[1], centro[2]) }
}

/** Cada pieza donde la tiene su grupo de la física. */
export function ponerPiezasLentes(l) {
  const pz = l.cuerpo.piezas()
  l.piezas.forEach((m, k) => {
    m.position.set(pz[k].c[0], pz[k].c[1], pz[k].c[2])
    m.quaternion.set(pz[k].q[0], pz[k].q[1], pz[k].q[2], pz[k].q[3])
  })
}
