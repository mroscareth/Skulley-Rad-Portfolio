/** @type {import('tailwindcss').Config} */
export default {
  // Let tailwind scan HTML and all JS/TS/JSX/TSX files inside the src directory
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Custom colors for portal sections can be defined here if needed
    },
  },
  plugins: [],
}