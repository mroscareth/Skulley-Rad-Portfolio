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
  SPHERE_RESTITUTION: 0.7,
  MAX_XZ_AFTER_HIT: 7.2,  // tope de velocidad tras chocar dos esferas
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
  const floorY = GROUND_Y + r
  const max2 = P.MAX_CENTER_DIST * P.MAX_CENTER_DIST
  const steps = Math.round(maxT / dt)
  const clampXZ = (v) => {
    const sp = Math.hypot(v.x, v.z)
    if (sp > P.MAX_XZ_AFTER_HIT) { const k = P.MAX_XZ_AFTER_HIT / sp; v.x *= k; v.z *= k }
    return v
  }
  for (let i = 0; i < steps; i += 1) {
    vy -= P.GRAVITY * dt
    px += vx * dt; py += vy * dt; pz += vz * dt
    if (py < floorY) {
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
        // Igual que el juego: el choque entre esferas se mide en el plano.
        const dx = px - o.pos.x
        const dz = pz - o.pos.z
        const rs = r + o.radius
        const d2 = dx * dx + dz * dz
        if (d2 > rs * rs) continue
        const d = Math.max(1e-5, Math.sqrt(d2))
        const nx = dx / d
        const nz = dz / d
        // Donde se tocan: la "bola fantasma" del billar.
        px += nx * (rs - d); pz += nz * (rs - d)
        const m1 = r * r * r
        const m2 = o.radius * o.radius * o.radius
        const vn = (vx - o.vel.x) * nx + (vz - o.vel.z) * nz
        const self2 = { x: vx, y: vy, z: vz }
        const other2 = { x: o.vel.x, y: o.vel.y, z: o.vel.z }
        if (vn < 0) {
          const j = -(1 + P.SPHERE_RESTITUTION) * vn / (1 / m1 + 1 / m2)
          self2.x += j * nx / m1; self2.z += j * nz / m1
          other2.x -= j * nx / m2; other2.z -= j * nz / m2
          clampXZ(self2); clampXZ(other2)
        }
        contact = { x: px, y: py, z: pz, other: o, selfVel: self2, otherVel: other2 }
        break
      }
      if (contact) { pts.push(px, py, pz); break }
    }
    if (i & 1) pts.push(px, py, pz)
    // Ya se detuvo: no tiene caso seguir.
    if (py <= floorY + 1e-3 && vx * vx + vz * vz < 0.0025) break
  }
  return { points: pts, end: { x: px, y: py, z: pz }, contact, out }
}
