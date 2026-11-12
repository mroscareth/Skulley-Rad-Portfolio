import { calcularNube } from './nubePiso.js'

// La nube de lib/nubePiso.js fuera del hilo principal.
self.onmessage = (e) => {
  const res = calcularNube(e.data.mallas)
  const transferir = []
  for (const malla of res) transferir.push(malla.datos.buffer, malla.dominante.buffer)
  self.postMessage(res, transferir)
}
