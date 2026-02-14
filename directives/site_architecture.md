# Site Architecture

## Goal
Provide a quick-reference map of how the Skulley Rad portfolio is structured so
any agent can orient itself before making changes.

## Tech Stack
| Layer       | Tech                         |
|-------------|------------------------------|
| Framework   | React 19 + Vite 7            |
| 3D          | Three.js 0.182, R3F, Drei    |
| Styling     | TailwindCSS 4                |
| Animation   | GSAP 3.13, Lenis             |
| Media       | react-player, jsmediatags    |
| CMS Backend | PHP (Hostinger), SQLite      |

## Key Directories
```
├── src/
│   ├── App.jsx              # Main orchestrator (large, ~206 KB)
│   ├── components/          # 47 child items — UI, 3D, overlays
│   ├── admin/               # CMS admin panel (7 files)
│   ├── i18n/                # EN/ES language context
│   ├── lib/                 # Utility libraries (5 files)
│   └── index.css            # Tailwind + custom styles
├── public/                  # Static assets (75 items — models, HDR, songs, images)
├── scripts/                 # Build & utility scripts (13 .mjs/.ps1 files)
├── directives/              # SOPs (this directory)
├── execution/               # Deterministic Python/JS scripts
└── .tmp/                    # Intermediate/temp files (gitignored)
```

## Important Files
| File | Notes |
|------|-------|
| `src/App.jsx` | Massive orchestrator — boot sequence, 3D world, sections, CMS |
| `src/components/Player.jsx` | Character controller (WASD, mobile joystick) |
| `src/components/CameraController.jsx` | Orbit + top-down dual camera |
| `src/components/PostFX.jsx` | Bloom, vignette, noise, GodRays, DOF |
| `vite.config.js` | Build config, aliases, chunk splitting |
| `scripts/post-build.mjs` | Post-build processing |
| `scripts/start-site.ps1` | PowerShell launcher |

## Edge Cases
- `App.jsx` is ~206 KB — edits should be surgical; prefer extracting to components
- Node version must be ^20.19.0 or >=22.12.0 (enforced by `scripts/check-node.mjs`)
- GodRays post-processing requires a mesh with valid material or it will error
- `@tailwindcss/postcss` is required in `postcss.config.cjs` (not the old plugin)
