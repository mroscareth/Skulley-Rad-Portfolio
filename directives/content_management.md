# Content Management

## Goal
Manage site content (projects, about info, contact details) through the built-in
CMS without touching source code.

## Inputs
- Access to the admin panel (`src/admin/`)
- Backend API running (PHP on Hostinger)

## Overview
The site includes a built-in CMS admin panel that allows editing content directly.
The backend is PHP-based, deployed on Hostinger, with local config in
`public/api/config.local.php` (gitignored).

## Key Files
| File | Purpose |
|------|---------|
| `src/admin/` | Admin panel React components (7 files) |
| `public/api/config.local.php` | Local PHP config (gitignored) |
| `public/api/vendor/` | Composer dependencies (gitignored, install on server) |
| `public/uploads/projects/` | User-uploaded project assets (gitignored) |

## Steps

### Adding/Editing Projects
1. Access the admin panel
2. Use the project editor to add or modify entries
3. Upload project images — they go to `public/uploads/projects/`

### Translation
- Site supports EN/ES via `src/i18n/LanguageContext.jsx`
- Translation scripts in `scripts/`:
  - `translate-comments-*.mjs` — Various iteration of comment translation
  - `translate-locales.mjs` — Locale string translation
  - `_translate_batch.mjs` — Batch translation helper

## Edge Cases
- `public/uploads/projects/` is gitignored — assets must be managed per-environment
- `public/api/config.local.php` contains secrets — never commit
- Composer vendor must be installed on the server separately
