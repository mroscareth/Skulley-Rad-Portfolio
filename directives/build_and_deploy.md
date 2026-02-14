# Build & Deploy

## Goal
Build the production bundle and deploy the Skulley Rad portfolio site.

## Inputs
- Clean working tree (no uncommitted changes that shouldn't ship)
- Node.js ^20.19.0 or >=22.12.0

## Steps

### Local Development
1. Run `npm run dev` — starts Vite dev server
2. Open the local URL shown in terminal

### Production Build
1. Run `npm run build`
   - Vite bundles the app
   - `scripts/post-build.mjs` runs automatically (cache-busting, asset processing)
2. Run `npm run preview` to test the production build locally

### Build with Clean Deploy
1. Run `npm run build:update`
   - Same as `build` but adds `--clean` flag to `post-build.mjs`
   - Use when deploying fresh (removes stale hashed assets)

### Full Start (PowerShell)
1. Run `npm run start:site`
   - Executes `scripts/start-site.ps1`
   - Handles environment setup + dev server launch

## Outputs
- `dist/` — Production-ready files for deployment
- Dev server at `http://localhost:5173` (or next available port)

## Edge Cases
- If `crypto.hash is not a function` → Node version is too old, update to 20.19+
- Song manifest is auto-generated on install (`npm run gen:songs` via `postinstall`)
- `dist/` is gitignored — never commit build artifacts
