// runas_neon.mjs con la ligadura LL (la única de SKULLEYGLYPH) como una runa propia: en la palabra va
// como '#', así CERILLOS sale como la escribe la fuente. Lo usa scripts/estilo/props_hitos.py.
//
//   node scripts/estilo/runas_hito.mjs "CERI#OS"

import { UPPER, LIGATURES } from '../../src/lib/runeStrokes.js'

UPPER['#'] = LIGATURES.LL
await import('./runas_neon.mjs')
