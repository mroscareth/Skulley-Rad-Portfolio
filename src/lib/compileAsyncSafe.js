// Reemplazo de `gl.compileAsync(scene, camera)` para los warm-ups.
//
// El de three (r182) revisa cada material en un setTimeout propio con
// `properties.get(material).currentProgram.isReady()`. Si el material se
// desecha mientras espera (React desmonta, el desarme o la skin cambian
// materiales), `currentProgram` queda undefined y truena DENTRO de ese
// setTimeout: el try/catch de quien llama no lo ve, sale como "Uncaught
// TypeError ... reading 'isReady'" y la promesa nunca resuelve. Todo lo que
// venía después del await (el pre-pase del warm-up) se perdía sin aviso.
//
// Mismo ciclo que three, pero un material sin programa cuenta como listo y hay
// un tope de tiempo para que el warm-up siga aunque algo se atore.
export function compileAsyncSafe(gl, scene, camera, timeoutMs = 10000) {
  const materials = gl.compile(scene, camera)
  const deadline = performance.now() + timeoutMs
  return new Promise((resolve) => {
    const check = () => {
      materials.forEach((material) => {
        try {
          const program = gl.properties.get(material).currentProgram
          if (!program || program.isReady()) materials.delete(material)
        } catch {
          materials.delete(material)
        }
      })
      if (materials.size === 0 || performance.now() > deadline) {
        resolve(scene)
        return
      }
      setTimeout(check, 10)
    }
    if (gl.extensions.get('KHR_parallel_shader_compile') !== null) check()
    else setTimeout(check, 10)
  })
}
