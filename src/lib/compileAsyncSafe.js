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
//
// `target`: compilar con un render target puesto. La llave del programa de
// three depende de a dónde se dibuja: contra la pantalla lleva el tone mapping
// del renderer y salida sRGB; dentro de un render target, sin tone mapping y
// lineal. Una escena que pasa por un EffectComposer siempre se dibuja en su
// buffer, así que compilar contra la pantalla daba programas que nadie usaba y
// el primer cuadro real compilaba los buenos de golpe (medido el 2026-11-10).
// Cualquier render target que no sea de XR da la misma llave.
export function compileAsyncSafe(gl, scene, camera, timeoutMs = 10000, target = null) {
  const prevTarget = gl.getRenderTarget()
  if (target) gl.setRenderTarget(target)
  let materials
  try { materials = gl.compile(scene, camera) } finally { if (target) gl.setRenderTarget(prevTarget) }
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
