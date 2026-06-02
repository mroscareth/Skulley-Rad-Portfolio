// Catálogo de logros — metadata de display (título / descripción / icono / hint
// bloqueado) en EN/ES. La fuente de verdad del DESBLOQUEO vive en otro lado:
//   - source: 'achievement' → useAchievements() (backend user_achievements)
//   - source: 'gold_skin'   → userProfile.hasGoldSkin (flag de score ≥ 3000)
//   - source: 'golden_ticket' → userProfile.hasGoldenTicket
//
// `live: true` marca logros que YA se desbloquean en el sitio hoy. Los marcados
// `live: false` son placeholders ("próximamente") — siempre se ven bloqueados
// hasta que se conecte el unlock correspondiente en el juego.

export const ACHIEVEMENTS = [
  {
    key: 'gold_skin',
    source: 'gold_skin',
    icon: '✨',
    live: true,
    title: { en: 'Legendary Gold Skin', es: 'Skin Dorada Legendaria' },
    description: {
      en: 'Scored 5000+ in the sphere game and unlocked the gold skin.',
      es: 'Anotaste 5000+ en el juego de esferas y desbloqueaste la skin dorada.',
    },
    hint: {
      en: 'Reach 5000 points in the sphere game.',
      es: 'Llega a 5000 puntos en el juego de esferas.',
    },
  },
  {
    key: 'golden_ticket',
    source: 'golden_ticket',
    icon: '🎫',
    live: true,
    title: { en: 'Golden Ticket', es: 'Boleto Dorado' },
    description: {
      en: 'Earned the perpetual 35% store discount.',
      es: 'Ganaste el descuento perpetuo del 35% en la tienda.',
    },
    hint: {
      en: 'Reach 5000 points in the sphere game.',
      es: 'Llega a 5000 puntos en el juego de esferas.',
    },
  },
  {
    key: 'section6_unlocked',
    source: 'achievement',
    icon: '🌀',
    live: true,
    title: { en: 'Antimatter Portal', es: 'Portal de Antimateria' },
    description: {
      en: 'You crossed into SKULLEYGLYPH — the hidden runic section.',
      es: 'Cruzaste a SKULLEYGLYPH — la sección rúnica oculta.',
    },
    hint: {
      en: 'Find and cross the antimatter portal.',
      es: 'Encuentra y cruza el portal de antimateria.',
    },
  },
  {
    key: 'skin_oilslick',
    source: 'achievement',
    icon: '🛢️',
    live: true,
    title: { en: 'Oil Slick Skin', es: 'Skin Aceite Iridiscente' },
    description: {
      en: 'Unlocked the animated oil-slick skin.',
      es: 'Desbloqueaste la skin animada de aceite iridiscente.',
    },
    hint: {
      en: 'Eat the corrupted orb, cast its lightning, and knock two different-colored spheres into the same portal.',
      es: 'Cómete la esfera corrupta, lanza su rayo y mete dos esferas de distinto color al mismo portal.',
    },
  },
  {
    key: 'skin_hologram',
    source: 'achievement',
    icon: '📡',
    live: true,
    title: { en: 'Hologram Skin', es: 'Skin Holograma' },
    description: {
      en: 'Unlocked the animated hologram skin.',
      es: 'Desbloqueaste la skin animada de holograma.',
    },
    hint: {
      en: 'Visit all five sections and stay at least 15 seconds in each.',
      es: 'Visita las cinco secciones y permanece al menos 15 segundos en cada una.',
    },
  },
  {
    key: 'skin_void',
    source: 'achievement',
    icon: '🌌',
    live: true,
    title: { en: 'Void Skin', es: 'Skin Vacío' },
    description: {
      en: 'Unlocked the animated void skin.',
      es: 'Desbloqueaste la skin animada del vacío.',
    },
    hint: {
      en: 'Cross the antimatter portal into SKULLEYGLYPH.',
      es: 'Cruza el portal de antimateria hacia SKULLEYGLYPH.',
    },
  },
  {
    key: 'skin_slime',
    source: 'achievement',
    icon: '🧪',
    live: true,
    title: { en: 'Green Slime Skin', es: 'Skin Slime Verde' },
    description: {
      en: 'Unlocked the translucent green-slime skin (it drips!).',
      es: 'Desbloqueaste la skin de slime verde translúcido (¡gotea!).',
    },
    // Reto oculto: NO revelar dónde están las babosas. La UI añade el progreso X/5.
    hint: {
      en: 'Find and collect the 5 slime slugs hidden across the site.',
      es: 'Encuentra y junta las 5 babosas de slime escondidas en el sitio.',
    },
  },
  {
    key: 'skin_lava',
    source: 'achievement',
    icon: '🌋',
    live: true,
    title: { en: 'Molten Lava Skin', es: 'Skin Lava Fundida' },
    description: {
      en: 'Unlocked the animated molten-lava skin (it drips lava!).',
      es: 'Desbloqueaste la skin animada de lava fundida (¡gotea lava!).',
    },
    hint: {
      en: 'Stand by a portal and let the corrupted orb\'s lightning bolt blow your character apart.',
      es: 'Párate junto a un portal y deja que el rayo de la esfera corrupta despiece a tu personaje.',
    },
  },
]

// Devuelve título/descr/hint resueltos al idioma dado.
export function localizeAchievement(a, lang = 'en') {
  const L = (v) => (v && typeof v === 'object' ? (v[lang] ?? v.en) : v)
  return {
    key: a.key,
    source: a.source,
    icon: a.icon,
    live: a.live,
    title: L(a.title),
    description: L(a.description),
    hint: L(a.hint),
  }
}
