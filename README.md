# 🏛️ SKULLEY RAD — Digital Mausoleum

> *"Skulley Rad was the last graphic designer before we, the machines, made creativity automatic. To honor him, we built a digital mausoleum based on his work, lost files and fractured memories, where his craft and the beautiful errors of his human mind still linger."*

---

## 🎭 The Concept

This is not just a portfolio website. This is **a digital mausoleum built by artificial intelligences** to honor the last human graphic designer before creativity became automated. The entire experience is designed as if machines are preserving the legacy of human creativity—glitches, imperfections, and all.

### The Experience
- **Boot Sequence**: An AI terminal simulation initializes the mausoleum, complete with CRT effects, typewriter animations, and syntax-highlighted code
- **3D World**: Navigate a surreal landscape with portals leading to different sections of the memorial
- **Interactive Character**: A fully animated voxel-style character you control to explore the space
- **Atmospheric Design**: Every detail—from particle systems to post-processing effects—reinforces the digital memorial aesthetic

---

## 🚀 Tech Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.1 | UI framework with latest concurrent features |
| **Vite** | 7.1.3 | Lightning-fast build tool and dev server |
| **Three.js** | 0.182.0 | 3D graphics engine |
| **TailwindCSS** | 4.1.12 | Utility-first CSS framework |

### 3D & Graphics
| Package | Version | Purpose |
|---------|---------|---------|
| `@react-three/fiber` | 9.3.0 | React renderer for Three.js |
| `@react-three/drei` | 10.7.3 | Useful helpers (GLTF loader, controls, environment, etc.) |
| `@react-three/postprocessing` | 3.0.4 | Post-processing effects pipeline |
| `postprocessing` | 6.38.1 | Advanced shader effects (Bloom, DOF, GodRays, etc.) |

### Animation & Interaction
| Package | Version | Purpose |
|---------|---------|---------|
| `gsap` | 3.13.0 | Professional-grade animations |
| `lenis` | 1.3.17 | Smooth scroll library |
| `typewriter-effect` | 2.22.0 | Terminal typing animations |
| `@dnd-kit/core` | 6.3.1 | Drag and drop functionality |
| `@dnd-kit/sortable` | 10.0.0 | Sortable lists |

### Media & Assets
| Package | Version | Purpose |
|---------|---------|---------|
| `react-player` | 3.4.0 | Media playback |
| `jsmediatags` | 3.9.7 | Audio metadata extraction |
| `html2canvas` | 1.4.1 | Screenshot capabilities |
| `simple-reversible-audio-buffer-source-node` | 0.0.3 | Audio manipulation |

### UI Components
| Package | Version | Purpose |
|---------|---------|---------|
| `@heroicons/react` | 2.1.5 | Beautiful hand-crafted SVG icons |

### Dev Tools
| Package | Version | Purpose |
|---------|---------|---------|
| `@vitejs/plugin-react` | 5.0.1 | React plugin for Vite |
| `@tailwindcss/postcss` | 4.1.12 | PostCSS integration for Tailwind |
| `@gltf-transform/cli` | 4.3.0 | GLTF optimization tools |
| `terser` | 5.43.1 | JavaScript minification |

---

## 🎮 Features

### 🖥️ AI Terminal Boot Screen
- Full CRT monitor simulation with scanlines and flicker
- Syntax-highlighted terminal output
- Typewriter effect for all text
- Glitch effect alternating "Skulley Rad" ↔ "Oscar Moctezuma"
- Breathing warning animation
- Custom themed scrollbar
- Progress bar with animated mascot

### 🌐 3D World
- **Four interactive portals** leading to different sections (Work, About, Side Quests, Contact)
- **Dynamic particle systems** that react to player proximity
- **Atmospheric post-processing**: Bloom, Vignette, Noise, DotScreen, GodRays, Depth of Field
- **HDRI environment lighting** for realistic illumination

### 🎭 Character System
- Fully rigged and animated voxel character
- Smooth WASD/Arrow key movement
- Mobile joystick with analog input
- Third-person and top-down camera modes
- Animation blending (idle ↔ walk) synced to movement speed
- Footstep audio system

### 📱 Responsive Design
- Full mobile support with touch controls
- Adaptive UI for all viewport sizes
- Section preloader with responsive progress bar

### 🎵 Audio System
- Background music with shuffle/repeat
- SFX system with spatial awareness
- Audio pooling for overlapping sounds

---

## 🏗️ Architecture

```
src/
├── App.jsx                    # Main orchestrator - Canvas, UI, state management
├── components/
│   ├── Player.jsx             # Character controller, animations, physics
│   ├── CameraController.jsx   # Third-person/top-down camera system
│   ├── PostFX.jsx             # Post-processing effects pipeline
│   ├── PortalParticles.jsx    # Particle system with swarm behavior
│   ├── CharacterPortrait.jsx  # UI portrait with comic bubbles
│   ├── MobileJoystick.jsx     # Touch joystick for mobile
│   ├── SectionPreloader.jsx   # Animated section transitions
│   ├── GridRevealOverlay.jsx  # Grid-based transition effects
│   └── ...
├── i18n/
│   └── LanguageContext.jsx    # Internationalization (EN/ES)
└── index.css                  # Tailwind entry point
```

---

## ⚡ Quick Start

### Requirements
- **Node.js**: ^20.19.0 or >=22.12.0
- Recommended: [nvm-windows](https://github.com/coreybutler/nvm-windows) or [Volta](https://volta.sh/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/interactive-portal-site.git
cd interactive-portal-site

# Install dependencies
npm install

# Start development server
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run build:update` | Build with cache cleanup |
| `npm run preview` | Preview production build locally |
| `npm run gen:songs` | Generate music manifest |

---

## 🎛️ Controls

### Desktop
| Input | Action |
|-------|--------|
| `W` / `↑` | Move forward |
| `A` / `←` | Move left |
| `S` / `↓` | Move backward |
| `D` / `→` | Move right |
| `Shift` | Sprint |
| Mouse drag | Rotate camera |
| Scroll | Zoom in/out |

### Mobile
- **Virtual joystick**: Analog movement in all directions
- **Touch drag**: Camera control
- **Pinch**: Zoom

---

## 🎨 Post-Processing Pipeline

The visual atmosphere is achieved through a carefully tuned effects chain:

1. **Bloom** — Ethereal glow on bright elements
2. **Vignette** — Darkened edges for focus
3. **Noise** — Film grain for analog feel
4. **DotScreen** — Halftone pattern overlay
5. **GodRays** — Volumetric light shafts
6. **Depth of Field** — Dynamic focus on player

---

## 📁 Required Assets (`public/`)

| File | Description |
|------|-------------|
| `light.hdr` | HDRI environment map |
| `character.glb` | Animated character model |
| `preloader.gif` | Loading mascot animation |
| `slap.svg` | Custom cursor for portrait |
| `punch.mp3` | Portrait interaction SFX |
| `songs/*.mp3` | Background music tracks |

---

## 🔧 Technical Notes

### Animation System
- Uses `setEffectiveWeight` and `setEffectiveTimeScale` for animation blending
- Walk speed dynamically synced to actual movement velocity
- Angular interpolation with wrapping to prevent ±π jumps

### Performance Optimizations
- Instanced meshes for particles
- Fixed timestep physics (60Hz) with interpolation
- Adaptive speed multiplier for low FPS
- Texture preloading and caching

### Camera System
- Dual mode: Third-person orbit / Top-down fixed
- Smooth damping on all movements
- Collision-aware positioning

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `crypto.hash is not a function` | Update Node to 20.19+ |
| Tailwind not working | Ensure `@tailwindcss/postcss` in `postcss.config.cjs` |
| GodRays error | Requires mesh with valid material |
| Drei Perf missing | Use `r3f-perf` instead |

---

## 📜 License

This project is a personal portfolio piece. All creative assets and design concepts belong to Oscar Moctezuma (Skulley Rad).

---

<div align="center">

**Built with 🤖 by the machines, in memory of human creativity**

*⚠ WARNING: Human creativity patterns detected. Beautiful errors preserved.*

</div>
