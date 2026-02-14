# Execution Scripts

Deterministic scripts that handle API calls, data processing, file operations,
and other automated tasks. These are called by the orchestration layer (agent)
based on instructions in `directives/`.

## Conventions

- Scripts should be **deterministic** — same input → same output
- Use `.mjs` for Node scripts, `.py` for Python, `.ps1` for PowerShell
- Accept inputs via CLI arguments or environment variables (from `.env`)
- Write intermediate files to `.tmp/`
- Log meaningful output to stdout/stderr
- Include clear comments explaining what the script does

## Existing Tools

The `scripts/` directory contains project-specific build tools that predate
this layer. They remain in `scripts/` since they're tied to npm lifecycle hooks.

| Script | Purpose |
|--------|---------|
| `scripts/check-node.mjs` | Validates Node.js version on install/dev/build |
| `scripts/gen-images-manifest.mjs` | Generates image manifest |
| `scripts/gen-songs-manifest.mjs` | Generates song manifest for audio player |
| `scripts/post-build.mjs` | Post-build asset processing |
| `scripts/start-site.ps1` | PowerShell site launcher |
| `scripts/translate-*.mjs` | Translation pipeline scripts |

New automation scripts should go in `execution/` to keep the separation clean.
