// Top-level constants and pure helpers shared across App.jsx.
// Extracted to keep App.jsx focused on orchestration.

// Color palette per section — drives portals, glows and transition materials.
// Keep in sync with DESIGN.md §1.1 (tailwind `section-*` tokens).
export const sectionColors = {
  home: '#0f172a',
  section1: '#00bfff', // Work
  section2: '#00ff26', // About
  section3: '#e600ff', // Side Quests
  section4: '#decf00', // Contact
  section5: '#ff6b00', // Blog - orange neon
  section6: '#ff2200', // Runic codex - lava red (antimateria / hidden portal)
}

// Optional background overrides when section bg should differ from portal color.
export const sectionBgOverrides = {
  section5: '#020817', // Blog uses dark bg, portal stays orange
  section6: '#050000', // Codex: negro absoluto con tint sangre
}

// Critical WORK image URLs used by the portal CTA preload step — avoids
// importing the heavy Section1.jsx just to learn about these assets.
export function getWorkImageUrls() {
  try {
    return [`${import.meta.env.BASE_URL}Etherean.jpg`]
  } catch {
    return []
  }
}

// Random "memories" shown line by line in the boot terminal preloader.
export const LOADING_MEMORIES = [
  'toddler memories',
  'first crayon drawing',
  'kindergarten art class',
  'childhood doodles',
  'first computer',
  'MS Paint masterpieces',
  'school notebooks',
  'first logo attempt',
  'highschool memories',
  'first Photoshop crash',
  'design tutorials',
  'all-nighter projects',
  'coffee-fueled deadlines',
  'first freelance client',
  'creative blocks',
  'font obsession',
  'color theory notes',
  'rejected concepts',
  'pixel perfect dreams',
  'Ctrl+Z muscle memory',
  'layer naming chaos',
  'client revision #47',
  'first portfolio',
  'dribbble likes',
  'behance projects',
  'award submissions',
  'brand guidelines',
  'mood boards',
  'style explorations',
  'typography experiments',
  'grid systems',
  'golden ratio sketches',
  'first 3D render',
  'render farm nightmares',
  'GPU meltdowns',
  'lost PSD files',
  'backup hard drives',
  'design system docs',
  'component libraries',
  'responsive breakpoints',
  'browser compatibility',
  'accessibility fixes',
  'dark mode variants',
  'motion principles',
  'easing curves',
  'micro-interactions',
  'user flow diagrams',
  'wireframe sessions',
  'prototype links',
  'usability tests',
  'stakeholder feedback',
  'creative briefs',
  'pitch decks',
  'conference talks',
  'workshop materials',
  'mentorship moments',
  'imposter syndrome',
  'creative breakthroughs',
  'design awards',
  'team celebrations',
  'studio playlists',
  'desk plant memories',
  'sticky note walls',
  'whiteboard sessions',
  'late night commits',
  'first open source',
  'side project dreams',
  'passion projects',
  'experimental work',
  'artistic expression',
]
