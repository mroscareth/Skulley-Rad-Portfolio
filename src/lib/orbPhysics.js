/**
 * Física de las esferas del home: el paso real (HomeOrbs) y la predicción de
 * la patada (la línea de trayectoria) leen de aquí. Sin React ni Three, así
 * que también se puede probar con números en Node.
 */

const GROUND_Y = 0.0
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Física de las esferas. Vive en su propio módulo, fuera del useFrame de
// HomeOrbs, porque la usan DOS
// cosas que tienen que coincidir al centímetro: el paso real de cada frame y
// la predicción de la trayectoria que se dibuja mientras cargas la patada
// (predictKick). Si cambia un número, cambian las dos.
export const ORB_PHYS = {
  GRAVITY: 9.8,
  RESTITUTION: 0.5,       // rebote contra el piso
  FRICTION: 0.98,         // por frame a 60 Hz, al tocar piso
  AIR_DRAG: 0.999,        // por frame a 60 Hz, en el aire
  ROLLING_DRAG: 0.996,    // por frame a 60 Hz, rodando
  MAX_CENTER_DIST: 55.0,  // más lejos, la esfera reaparece en el centro
  // Choques entre esferas, como en el billar (pedido de Oscar, 2026-10-24):
  // casi toda la energía pasa a la que recibe el golpe. Antes 0.7 con tope
  // de 7.2 u/s: una patada a carga completa (30-50 u/s) chocaba y las dos
  // quedaban recortadas a 7.2, así que la golpeada apenas salía.
  SPHERE_RESTITUTION: 0.92,
  MAX_XZ_AFTER_HIT: 40,   // solo un seguro contra valores absurdos
  // Masa ∝ radio^1.5: la grande sigue pesando más, pero ya no hasta 28 veces
  // más (con radio³ una chica que le pegaba a una grande ni la movía).
  MASS_EXP: 1.5,
}

export const orbMass = (r) => Math.pow(r, ORB_PHYS.MASS_EXP)

// Choque entre dos esferas `a` y `b` ({vel:{x,z}, radius}) con normal de
// contacto (nx, nz) que va de b hacia a. Impulso en el plano, como el billar.
// Cambia las velocidades y devuelve true si se estaban acercando.
export function resolveOrbHit(a, b, nx, nz) {
  const P = ORB_PHYS
  const vn = (a.vel.x - b.vel.x) * nx + (a.vel.z - b.vel.z) * nz
  if (vn >= 0) return false
  const m1 = orbMass(a.radius)
  const m2 = orbMass(b.radius)
  const j = -(1 + P.SPHERE_RESTITUTION) * vn / (1 / m1 + 1 / m2)
  a.vel.x += j * nx / m1; a.vel.z += j * nz / m1
  b.vel.x -= j * nx / m2; b.vel.z -= j * nz / m2
  for (const s of [a, b]) {
    const sp = Math.hypot(s.vel.x, s.vel.z)
    if (sp > P.MAX_XZ_AFTER_HIT) { const k = P.MAX_XZ_AFTER_HIT / sp; s.vel.x *= k; s.vel.z *= k }
  }
  return true
}

// Una va volando por encima de la otra: no se tocan aunque coincidan en el
// plano. Antes el choque solo miraba el plano y una esfera en el aire le
// pegaba a las que pasaba por encima.
export const orbsApartInHeight = (ya, yb, rSum) => Math.abs(ya - yb) > rSum * 0.95

// Anti-túnel: a 30-50 u/s una esfera avanza casi un metro por frame y puede
// cruzar a otra sin que ningún frame las vea encimadas. Dado dónde estaba
// la una respecto a la otra al inicio del paso (rx0, rz0) y cuánto se movió
// esa diferencia (rdx, rdz), devuelve la fracción t∈(0,1] del paso en que se
// tocaron por primera vez, o -1 si no se tocaron (o ya se tocaban).
export function sweptContactT(rx0, rz0, rdx, rdz, rSum) {
  const a = rdx * rdx + rdz * rdz
  if (!(a > 1e-9)) return -1
  const c = rx0 * rx0 + rz0 * rz0 - rSum * rSum
  if (c <= 0) return -1
  const b = 2 * (rx0 * rdx + rz0 * rdz)
  const disc = b * b - 4 * a * c
  if (disc < 0) return -1
  const t = (-b - Math.sqrt(disc)) / (2 * a)
  return t > 0 && t <= 1 ? t : -1
}

// Impulso que la patada le da a UNA esfera, o null si queda fuera del
// abanico. Lo usan kickImpulse (la patada real) y predictKick (la línea de
// trayectoria): así lo que se dibuja es lo que pasa.
export function kickContact(s, center, dir, strength, radius, base, halfAngle) {
  if (!s || s._isDragging || s._thunderHidden) return null
  // ÁREA DE GOLPE = EXACTAMENTE EL ABANICO QUE SE DIBUJA.
  // El sector se mide desde el CUERPO (igual que el indicador), no
  // desde el pie: el pie se levanta y se adelanta durante la patada, y
  // usarlo como centro hacía que el área real no coincidiera con la
  // retícula. Lo que está dentro del abanico se patea; lo de fuera, no.
  const bx = base ? base.x : center.x
  const bz = base ? base.z : center.z
  const fx = s.pos.x - bx
  const fz = s.pos.z - bz
  const d = Math.hypot(fx, fz)
  // Radio: cuenta el BORDE de la esfera, no su centro. Si la esfera toca
  // el abanico, se patea (una esfera grande asomando al borde debe
  // contar; con el centro solo, las grandes se libraban).
  if (d - s.radius > radius) return null
  // Altura: el abanico es plano, pero las esferas flotan. El margen se
  // escala con el radio por el mismo motivo.
  const dy = s.pos.y - center.y
  if (dy > 1.25 + s.radius || dy < -1.35 - s.radius) return null
  // Ángulo: se compara contra el semiángulo del sector dibujado,
  // ensanchado por el ángulo que la propia esfera subtiende.
  let nx = 1
  let nz = 0
  if (d > 1e-4) { nx = fx / d; nz = fz / d }
  const facing = nx * dir.x + nz * dir.z
  if (d > s.radius) {
    const ang = Math.acos(Math.max(-1, Math.min(1, facing)))
    const angRadius = Math.asin(Math.max(0, Math.min(1, s.radius / d)))
    if (ang - angRadius > halfAngle) return null
  }
  // (si d <= s.radius la esfera envuelve al personaje: siempre golpea)
  //
  // Dirección de salida, COMO EN EL BILLAR: el pie viaja por la línea de
  // puntería (del cuerpo hacia `dir`) y la esfera sale por la normal del
  // punto donde el pie la toca. Pegarle al centro la manda derecho; por la
  // orilla, en ángulo hacia el otro lado (un "corte"). Antes salía casi por
  // la radial cuerpo→esfera y la puntería apenas cambiaba nada.
  //   along: qué tan adelante está la esfera sobre la línea
  //   side:  cuánto se desvía de la línea (signo = de qué lado)
  // Una esfera del abanico que la línea no alcanza a tocar recibe un roce:
  // la desviación se topa al borde y sale casi de lado, con poca fuerza.
  const FOOT_R = 0.16
  const reachR = s.radius + FOOT_R
  const along = fx * dir.x + fz * dir.z
  const side = fx * dir.z - fz * dir.x
  let ox, oz, cut
  if (along > 1e-3 && d > s.radius) {
    const sinT = Math.max(-0.97, Math.min(0.97, side / reachR))
    cut = Math.sqrt(1 - sinT * sinT)
    // Normal de contacto: la puntería girada hacia el lado de la esfera.
    ox = dir.x * cut + dir.z * sinT
    oz = dir.z * cut - dir.x * sinT
  } else {
    // Pegada al cuerpo o a la altura del pie: no hay línea que trazar, sale
    // por la radial con un sesgo al frente para que se lea como patada.
    const radialW = 0.85 * Math.min(1, d / 0.6)
    ox = nx * radialW + dir.x * (1 - radialW)
    oz = nz * radialW + dir.z * (1 - radialW)
    cut = Math.max(0, facing)
  }
  const ol = Math.max(1e-4, Math.hypot(ox, oz))
  ox /= ol; oz /= ol
  // Fuerza por CENTRADO del golpe: de lleno pega completo y de refilón
  // menos, como en el billar (la bola objetivo recibe el coseno del corte).
  // De lleno queda igual que antes, así que el balance para meterlas en un
  // portal no cambia. Y por cercanía dentro del abanico (el borde pega
  // menos que el centro).
  const centerHit = 0.35 + 0.65 * cut
  const near = 0.6 + 0.4 * Math.max(0, 1 - d / Math.max(1e-4, radius))
  // Peso por tamaño, CONTINUO: las chicas salen más rápido (por eso
  // valen 100 y cuesta meterlas), las grandes más lento. Antes era un
  // escalón (×1.9 hasta r=0.30, ×1.0 desde 0.31): dos esferas casi
  // iguales salían con el doble de fuerza una que otra.
  const sizeBoost = clamp(Math.pow(0.36 / s.radius, 0.6), 0.72, 1.35)
  const imp = strength * centerHit * near * sizeBoost
  // Loft: se eleva un poco — se lee como patada, no como empujón raso.
  // Las chicas brincan más: pueden pasar volando sobre el portal, que
  // es parte del reto de meterlas.
  const smallness = clamp((0.42 - s.radius) / 0.24, 0, 1)
  return { vx: ox * imp, vz: oz * imp, vy: imp * (0.22 + 0.12 * smallness), imp }
}

// Recorrido de una esfera con la física del juego, a 60 Hz fijos, como lo
// integra el useFrame. Las demás esferas se toman quietas donde están; con
// `collide`, se detiene en el primer choque y calcula cómo salen las dos
// (mismo impulso que el choque real). Devuelve puntos [x,y,z,…] para dibujar.
export function simulateOrbPath(pos, vel, r, all, self, maxT, collide, ignore) {
  const P = ORB_PHYS
  const dt = 1 / 60
  let px = pos.x, py = pos.y, pz = pos.z
  let vx = vel.x, vy = vel.y, vz = vel.z
  const pts = [px, py, pz]
  let contact = null
  let out = false
  // Dónde toca piso (los primeros botes): la línea de la patada marca el
  // primero, que es "donde cae".
  const landings = []
  const floorY = GROUND_Y + r
  const max2 = P.MAX_CENTER_DIST * P.MAX_CENTER_DIST
  const steps = Math.round(maxT / dt)
  for (let i = 0; i < steps; i += 1) {
    const ppx = px, ppz = pz
    vy -= P.GRAVITY * dt
    px += vx * dt; py += vy * dt; pz += vz * dt
    if (py < floorY) {
      // Un bote de verdad, no el roce de ir rodando.
      if (vy < -0.6 && landings.length < 3) {
        landings.push({ x: px, z: pz, i: pts.length / 3 })
        pts.push(px, floorY, pz)
      }
      py = floorY
      vy = Math.abs(vy) * P.RESTITUTION
      vx *= P.FRICTION; vz *= P.FRICTION
    }
    if (py <= floorY + 1e-3) { vx *= P.ROLLING_DRAG; vz *= P.ROLLING_DRAG }
    else { vx *= P.AIR_DRAG; vz *= P.AIR_DRAG }
    if (px * px + pz * pz > max2) { out = true; break }
    if (collide) {
      for (const o of all) {
        if (!o || o === self || o === ignore || o._thunderHidden || o._isDragging) continue
        // Igual que el juego: choque en el plano, salvo que una pase por
        // encima de la otra; y con barrido para que no se crucen.
        const rs = r + o.radius
        if (orbsApartInHeight(py, o.pos.y, rs)) continue
        let dx = px - o.pos.x
        let dz = pz - o.pos.z
        let d2 = dx * dx + dz * dz
        if (d2 > rs * rs) {
          const tc = sweptContactT(ppx - o.pos.x, ppz - o.pos.z, px - ppx, pz - ppz, rs)
          if (tc < 0) continue
          px = ppx + (px - ppx) * tc; pz = ppz + (pz - ppz) * tc
          dx = px - o.pos.x; dz = pz - o.pos.z
          d2 = dx * dx + dz * dz
        }
        const d = Math.max(1e-5, Math.sqrt(d2))
        const nx = dx / d
        const nz = dz / d
        // Donde se tocan: la "bola fantasma" del billar.
        px += nx * (rs - d); pz += nz * (rs - d)
        const self2 = { vel: { x: vx, y: vy, z: vz }, radius: r }
        const other2 = { vel: { x: o.vel.x, y: o.vel.y, z: o.vel.z }, radius: o.radius }
        resolveOrbHit(self2, other2, nx, nz)
        contact = { x: px, y: py, z: pz, other: o, selfVel: self2.vel, otherVel: other2.vel }
        break
      }
      if (contact) { pts.push(px, py, pz); break }
    }
    if (i & 1) pts.push(px, py, pz)
    // Ya se detuvo: no tiene caso seguir.
    if (py <= floorY + 1e-3 && vx * vx + vz * vz < 0.0025) break
  }
  return { points: pts, end: { x: px, y: py, z: pz }, contact, out, landings }
}
