/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'status-idle': '#9ca3af',
        'status-connecting': '#facc15',
        'status-connected': '#4ade80',
        'status-transferring': '#60a5fa',
        'status-complete': '#10b981',
        'status-error': '#ef4444',
        'status-disconnected': '#f97316',
      }
    },
  },
  plugins: [],
}
