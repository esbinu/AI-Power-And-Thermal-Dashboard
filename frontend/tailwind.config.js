/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          900: '#0b0f1a',
          800: '#111827',
          700: '#1a2238',
          600: '#202a44',
        },
        accent: {
          blue:  '#3b82f6',
          cyan:  '#22d3ee',
          green: '#10b981',
          amber: '#f59e0b',
          red:   '#ef4444',
          purple:'#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
}
