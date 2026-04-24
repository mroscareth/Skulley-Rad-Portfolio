// Pure URL ↔ section helpers (History API routing).
// Module-level constants/helpers — no React state. Imported by App.jsx.

export const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'

// section id → URL slug
export const sectionSlug = {
  section1: 'work',
  section2: 'about',
  section3: 'lost-and-found-shop',
  section4: 'contact',
  section5: 'blog',
  section6: 'skulleyglyph',
  section7: 'fragmented-memories',
}

// URL slug → section id. Incluye el slug legacy 'side-quests' como alias
// para que links viejos sigan resolviendo a section3 sin romper.
export const slugToSection = {
  work: 'section1',
  about: 'section2',
  'lost-and-found-shop': 'section3',
  'side-quests': 'section3', // legacy alias
  contact: 'section4',
  blog: 'section5',
  skulleyglyph: 'section6',
  'fragmented-memories': 'section7',
}

// Resolve the relative path (minus base) for a given pathname.
function relFromPath(path) {
  const base = new URL(baseUrl, window.location.origin)
  const full = new URL(path, window.location.origin)
  let rel = full.pathname
  const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`
  if (rel.startsWith(basePath)) rel = rel.slice(basePath.length)
  return rel.replace(/^\//, '')
}

export function sectionToPath(s) {
  return s && s !== 'home' ? `${baseUrl}${sectionSlug[s] || s}` : baseUrl
}

// Extract blog post slug from path (e.g., /blog/my-post → 'my-post')
export function extractBlogSlug(path) {
  try {
    const rel = relFromPath(path)
    const match = rel.match(/^blog\/(.+)$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

// Extract work project slug from path (e.g., /work/heritage → 'heritage')
export function extractWorkSlug(path) {
  try {
    const rel = relFromPath(path)
    const match = rel.match(/^work\/(.+)$/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export function pathToSection(path) {
  try {
    const rel = relFromPath(path)
    if (rel === '' || rel === '/') return 'home'
    if (rel.startsWith('work/')) return 'section1'
    if (rel.startsWith('blog/')) return 'section5'
    if (slugToSection[rel]) return slugToSection[rel]
    if (['section1', 'section2', 'section3', 'section4', 'section5', 'section6', 'section7'].includes(rel)) return rel
    return 'home'
  } catch {
    return 'home'
  }
}
