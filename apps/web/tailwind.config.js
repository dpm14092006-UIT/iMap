/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
        },
        accent: { 500: '#14b8a6', 600: '#0d9488' },
        ink: { DEFAULT: '#172b43', soft: '#475569' },
        traffic: { fast: '#22c55e', moderate: '#facc15', slow: '#ef4444', jam: '#991b1b' },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg,#4338ca 0%,#0d9488 100%)',
      },
      boxShadow: {
        float: '0 12px 38px rgba(25, 42, 69, .13), 0 2px 8px rgba(25, 42, 69, .05)',
        'float-dark': '0 12px 38px rgba(0, 0, 0, .5), 0 2px 8px rgba(0, 0, 0, .3)',
        'glass-dark': '0 10px 40px rgba(0, 0, 0, .55), 0 1px 0 rgba(255, 255, 255, .06) inset',
        glass: '0 10px 40px rgba(30, 27, 75, .16), 0 1px 0 rgba(255, 255, 255, .6) inset',
      },
      keyframes: {
        'sheet-in': {
          from: { opacity: '0', transform: 'translateX(-14px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        pop: {
          from: { opacity: '0', transform: 'scale(.94)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 180ms ease-out',
        'sheet-up': 'sheet-up 180ms ease-out',
        'fade-in': 'fade-in 180ms ease-out',
        pop: 'pop 140ms ease-out',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
