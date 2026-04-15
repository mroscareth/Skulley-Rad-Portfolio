/** @type {import('tailwindcss').Config} */
// Design tokens — fuente de verdad sincronizada con DESIGN.md.
// Cualquier token nuevo debe agregarse también al documento.
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta por sección (DESIGN.md §1.1)
        section: {
          home: '#0f172a',
          work: '#00bfff',
          about: '#00ff26',
          quests: '#e600ff',
          contact: '#decf00',
          blog: '#ff6b00',
        },
        // Terminal UI (DESIGN.md §1.2)
        terminal: {
          bg: '#0a0a14',
          border: '#3b82f6',
          prompt: '#00ffff',
          promptAlt: '#00ff00',
          caret: '#4ade80',
        },
        // Semánticos (DESIGN.md §1.3)
        feedback: {
          success: '#22c55e',
          error: '#ef4444',
          warning: '#fbbf24',
          info: '#38bdf8',
        },
        power: '#facc15',
      },
      fontFamily: {
        // Consumen CSS variables definidas en :root (src/index.css)
        sans: ['var(--font-body)'],
        body: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        glitch: ['var(--font-glitch)'],
      },
      zIndex: {
        // Escala canónica (DESIGN.md §8)
        base: '0',
        scene: '1',
        hud: '10',
        overlay: '20',
        dropdown: '30',
        sticky: '40',
        modal: '50',
        toast: '60',
        tutorial: '70',
        debug: '100',
      },
      transitionTimingFunction: {
        // Curvas canónicas (DESIGN.md §7.6)
        'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'expo-in': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-bounce': 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'elev-sm': '0 2px 8px rgba(0,0,0,0.2)',
        'elev-md': '0 3px 12px rgba(0,0,0,0.3)',
        'elev-lg': '0 8px 32px rgba(0,0,0,0.4)',
        'glow-terminal': '0 0 20px rgba(59,130,246,0.3), inset 0 0 60px rgba(59,130,246,0.05)',
        'glow-portal': '0 0 20px var(--portal-color, #00bfff), 0 0 40px color-mix(in srgb, var(--portal-color, #00bfff) 40%, transparent)',
      },
      keyframes: {
        'ui-enter-up': {
          '0%': { transform: 'translateY(32px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'ui-exit-down': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(32px)', opacity: '0' },
        },
      },
      animation: {
        'ui-enter-up': 'ui-enter-up 500ms cubic-bezier(0.16,1,0.3,1) both',
        'ui-exit-down': 'ui-exit-down 250ms cubic-bezier(0.4,0,0.2,1) both',
      },
    },
  },
  plugins: [],
}
