// Prueba en Node el humor de M.A.D.R.E. y Argus (src/lib/humorNpc.js) y los
// saludos que salen de él, con un reloj falso. Correr con:
//   node scripts/npc/probar_humor.mjs
// Si cambian los números de HUMOR, aquí se ve cuántas cortadas o aperturas
// seguidas hacen falta para que no te hablen.
let reloj = 1000
globalThis.performance = { now: () => reloj * 1000 }
const avanza = (s) => { reloj += s }

const M = await import('../../src/lib/droneNpc.js')
const A = await import('../../src/lib/argusNpc.js')
const { dialogoMadre } = await import('../../src/lib/dialogoMadre.js')
const { dialogoArgus } = await import('../../src/lib/dialogoArgus.js')

function corre(nombre, picar, tomar, cerrar) {
  const abre = () => {
    const r = picar()
    const s = r.tipo === 'charla' ? tomar() : null
    return r.tipo + (s ? ':' + s.tipo : r.n ? ':' + r.n : '')
  }
  // cortarlo con Esc a media frase cada vez, cada 8 s
  const cortes = [abre()]
  avanza(5); cerrar('cortada')
  for (let i = 0; i < 4; i++) {
    avanza(5); cortes.push(abre()); avanza(3)
    if (cortes.at(-1).startsWith('charla')) cerrar('cortada')
  }
  avanza(2); cortes.push(abre()); avanza(2); cortes.push(abre())
  console.log(`${nombre}, cortándolo:`, cortes.join(' '))
  // abrir y despedirse bien, una y otra vez
  avanza(400)
  const clics = []
  for (let i = 0; i < 9; i++) {
    avanza(4); clics.push(abre()); avanza(4)
    if (clics.at(-1).startsWith('charla')) cerrar('adios')
  }
  console.log(`${nombre}, abriendo seguido:`, clics.join(' '))
}

corre('M.A.D.R.E.', M.picarMadre, M.tomarSaludo, M.cerrarConMadre)
corre('Argus', A.picarArgus, A.tomarSaludoArgus, A.cerrarConArgus)

// Argus picado de lejos
avanza(600)
const lejos = []
for (let i = 0; i < 9; i++) { avanza(1.5); const r = A.picarArgusLejos(); lejos.push(r.tipo + (r.n ? ':' + r.n : '')) }
console.log('Argus, picado de lejos:', lejos.join(' '))

// cada uno lleva su cuenta
avanza(600)
M.picarMadre(); M.tomarSaludo(); M.cerrarConMadre('cortada')
console.log('cuentas aparte (cortes M.A.D.R.E. / Argus):', M.animoMadre.cortes.toFixed(2), A.animoArgus.cortes.toFixed(2))

// la recomendación de un proyecto: picarla en la ventana abre la charla del proyecto
avanza(600)
M.recomendo({ slug: 'arttoys', titulo: 'Art Toys I' })
avanza(8); M.picarMadre(); console.log('picándola tras recomendar:', M.tomarSaludo().tipo)
M.cerrarConMadre('adios')
M.recomendo({ slug: 'arttoys', titulo: 'Art Toys I' })
avanza(30); M.picarMadre(); console.log('ya pasada la ventana:', M.tomarSaludo().tipo)
M.cerrarConMadre('adios')

const D = dialogoMadre('es')
const largos = Object.entries(D.proyectos).map(([slug, p]) => [p.t.length, slug]).sort((a, b) => b[0] - a[0])
console.log(`proyectos con texto: ${largos.length}; los más largos:`, largos.slice(0, 3).map(([n, s]) => `${s} (${n})`).join(', '))
const base = { gold: { score: 6000, pct: 35 }, silver: { score: 1500, pct: 10 } }
for (const humor of ['regano', 'perdon', null]) console.log(`Argus, saludo con humor ${humor}:`, dialogoArgus('es', { ...base, humor, semilla: 0.4 }).otraVez[0].t)
