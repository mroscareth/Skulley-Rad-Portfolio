# 🏛️ SKULLEY RAD — Digital Mausoleum

<div align="center">

### 🌐 [mroscar.xyz](https://mroscar.xyz)

</div>

> *"Skulley Rad was the last graphic designer before we, the machines, made creativity automatic. To honor him, we built a digital mausoleum based on his work, lost files and fractured memories, where his craft and the beautiful errors of his human mind still linger."*

---

## 🎭 Concept

A **digital mausoleum built by artificial intelligences** to preserve the legacy of the last human graphic designer. The experience simulates machines archiving human creativity—glitches, imperfections, and all.

- **Boot Sequence**: AI terminal with CRT effects, typewriter animations, syntax highlighting
- **3D World**: Surreal landscape with portals to different memorial sections
- **Playable Character**: Fully animated character to explore the space
- **Atmosphere**: Particle systems and post-processing reinforce the memorial aesthetic

---

## 🚀 Tech Stack

### Core
| Tech | Version | Purpose |
|------|---------|---------|
| **React** | 19.1.1 | UI framework |
| **Vite** | 7.1.3 | Build tool |
| **Three.js** | 0.182.0 | 3D engine |
| **TailwindCSS** | 4.1.12 | Styling |

### 3D & Graphics
| Package | Version | Purpose |
|---------|---------|---------|
| `@react-three/fiber` | 9.3.0 | React renderer for Three.js |
| `@react-three/drei` | 10.7.3 | Helpers (GLTF, controls, environment) |
| `@react-three/postprocessing` | 3.0.4 | Effects pipeline |
| `postprocessing` | 6.38.1 | Shader effects (Bloom, DOF, GodRays) |

### Animation & Interaction
| Package | Version | Purpose |
|---------|---------|---------|
| `gsap` | 3.13.0 | Animations |
| `lenis` | 1.3.17 | Smooth scroll |
| `typewriter-effect` | 2.22.0 | Typing animations |
| `@dnd-kit/core` | 6.3.1 | Drag and drop |
| `@dnd-kit/sortable` | 10.0.0 | Sortable lists |

### Media
| Package | Version | Purpose |
|---------|---------|---------|
| `react-player` | 3.4.0 | Media playback |
| `jsmediatags` | 3.9.7 | Audio metadata |
| `html2canvas` | 1.4.1 | Screenshots |

### UI & Dev
| Package | Version | Purpose |
|---------|---------|---------|
| `@heroicons/react` | 2.1.5 | Icons |
| `@vitejs/plugin-react` | 5.0.1 | Vite React plugin |
| `@tailwindcss/postcss` | 4.1.12 | PostCSS integration |
| `@gltf-transform/cli` | 4.3.0 | GLTF optimization |
| `terser` | 5.43.1 | Minification |

### Auth & Commerce
| Package | Version | Purpose |
|---------|---------|---------|
| `@privy-io/react-auth` | — (lazy) | User authentication (email, Google, wallet) |
| Shopify Storefront API | 2025-01 | Product catalog + cart (client-side, public token) |
| Shopify Admin API | 2025-01 | Ephemeral discount code mint (server-side PHP, secret token) |

### Backend
| Tech | Purpose |
|------|---------|
| PHP 8.2 | API endpoints on Hostinger shared hosting |
| MySQL 8 | User profiles, achievements, game scores, cheat codes registry |
| Privy | Identity provider — `privy_id` links `user_profiles` |

---

## 🎮 Features

### Terminal Boot Screen
- CRT simulation (scanlines, flicker)
- Syntax-highlighted output with typewriter effect
- Glitch effect: "Skulley Rad" ↔ "Oscar Moctezuma"
- Breathing warning animation
- Progress bar with animated mascot

### 3D World
- Six portals (Work, About, Lost-and-Found Shop, Contact, Blog, **SKULLEYGLYPH** — hidden runic codex, unlocked via antimatter orb offering)
- Particle systems reactive to player proximity
- Post-processing: Bloom, Vignette, Noise, DotScreen, GodRays, DOF
- HDRI environment lighting

### Character
- Rigged and animated with idle/walk blending
- WASD/Arrow movement, mobile joystick
- Third-person and top-down camera modes
- Footstep audio
- Gold skin unlock via sphere minigame

### Responsive
- Touch controls for mobile
- Adaptive UI
- Section preloader with progress animation

### Audio
- Background music (shuffle/repeat)
- Spatial SFX with pooling

### Shop — Shopify integration
- Product catalog fetched from Shopify Storefront API (collection `lost-and-found-items`) with multi-currency via `@inContext`
- Custom cart that creates a Shopify Cart and redirects to native checkout
- **Golden Ticket** mechanic: players earn a 35% off perpetual discount by scoring ≥3000 in the sphere minigame. Ephemeral code (`SKR-XXXXXXXX`) minted server-side via Shopify Admin API, enforced single-use by Shopify's `usageLimit=1`. Displayed as 3D rotating badge above portrait + discount chip in cart + discounted prices in product cards.
- Persistent achievements system tracking one-time rewards per authenticated user

### CMS
- Built-in content management system
- Edit site content without touching code
- Manage projects, about info, contact details, cheat codes (admin view), shop banners + featured product override

---

## 🏗️ Architecture

```
src/
├── App.jsx                       # Main orchestrator
├── auth/                         # Privy auth (lazy-loaded shell)
├── components/
│   ├── Player.jsx                # Character controller
│   ├── CameraController.jsx      # Camera system
│   ├── PostFX.jsx                # Post-processing
│   ├── PortalParticles.jsx       # Particle swarm
│   ├── CharacterPortrait.jsx     # UI portrait
│   ├── MobileJoystick.jsx        # Touch joystick
│   ├── SectionPreloader.jsx      # Transitions
│   ├── GoldenTicketBadge.jsx     # 3D spinning ticket (CSS 3D)
│   ├── ui/Button.jsx             # Canonical button with 8 variants
│   └── shop/                     # Shop UI (ProductCard, ShopCart, etc.)
├── hooks/
│   ├── useAchievements.js        # Persistent achievements (guest/auth)
│   └── useUserProfile.js         # User profile sync + score save
├── lib/
│   ├── shopifyClient.js          # Storefront API (public, frontend)
│   ├── shopifyAdapter.js         # Shopify node → app shape
│   ├── shopDataContext.jsx       # Provider for products catalog
│   ├── useShopCart.js            # Cart hook (localStorage)
│   ├── useActiveDiscount.js      # Active discount slot
│   └── usePriceWithDiscount.js   # Apply active discount to a price
├── i18n/
│   └── LanguageContext.jsx       # EN/ES
└── index.css                     # Tailwind + custom keyframes

public/api/                       # PHP backend (Hostinger)
├── config.local.php              # Prod credentials (gitignored)
├── shopify.php                   # Admin API helper (mintDiscountCode)
├── profile.php                   # User sync + score save + ticket mint
├── achievements.php              # Achievements endpoints
├── codes.php                     # Legacy cheat codes CMS (admin-only)
└── middleware.php                # Auth, CORS, rate limit helpers

scripts/                          # SQL migrations + build helpers
├── create-achievements.sql
├── add-golden-ticket-shopify.sql
├── add-shopify-cols-to-redemptions.sql
└── post-build.mjs                # Sanity-checks config.local.php into dist/
```

---

## ⚡ Quick Start

**Requirements**: Node.js ^20.19.0 or >=22.12.0

```bash
git clone https://github.com/your-username/interactive-portal-site.git
cd interactive-portal-site
npm install
npm run dev
```

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (initial deploy — keeps `dist/uploads/`) |
| `npm run build:update` | Production build (update deploy — preserves server uploads, includes `config.local.php`) |
| `npm run preview` | Preview build |

---

## 🎛️ Controls

### Desktop
| Input | Action |
|-------|--------|
| `WASD` / Arrows | Move |
| `Shift` | Sprint |
| Mouse drag | Rotate camera |
| Scroll | Zoom |

### Mobile
- Joystick: Movement
- Drag: Camera
- Pinch: Zoom

---

## 🎨 Post-Processing

1. **Bloom** — Glow on bright elements
2. **Vignette** — Darkened edges
3. **Noise** — Film grain
4. **DotScreen** — Halftone overlay
5. **GodRays** — Volumetric light
6. **DOF** — Dynamic focus

---

## 📁 Assets (`public/`)

| File | Description |
|------|-------------|
| `light.hdr` | HDRI environment |
| `character.glb` | Character model |
| `preloader.gif` | Loading mascot |
| `songs/*.mp3` | Background music |

---

## 🔧 Technical Notes

- **Animation**: `setEffectiveWeight`/`setEffectiveTimeScale` for blending, angular interpolation with wrapping
- **Performance**: Instanced particles, 60Hz fixed timestep with interpolation, adaptive speed for low FPS
- **Camera**: Dual mode (orbit/top-down), smooth damping

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `crypto.hash is not a function` | Update Node to 20.19+ |
| Tailwind not working | Use `@tailwindcss/postcss` in `postcss.config.cjs` |
| GodRays error | Needs mesh with valid material |

---

## 📜 License

Personal portfolio. Creative assets © Oscar Moctezuma (Skulley Rad).

---

<div align="center">

**Built with 🤖 by the machines, in memory of human creativity**

*⚠ WARNING: Human creativity patterns detected. Beautiful errors preserved.*

</div>
