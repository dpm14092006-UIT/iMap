const denim = {
  50: '#F0F7FC',
  100: '#DEEDF9',
  200: '#B8DBF6',
  300: '#83CAFF',
  400: '#65AFEA',
  500: '#176AA7',
  600: '#005A9C',
  700: '#004779',
  800: '#073959',
  900: '#102B41',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
        },
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        focus: 'rgb(var(--focus) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        brand: denim,
        indigo: denim,
        accent: { 500: denim[500], 600: denim[600] },
        ink: { DEFAULT: '#172b43', soft: '#475569' },
        traffic: { fast: '#22c55e', moderate: '#facc15', slow: '#ef4444', jam: '#991b1b' },
      },
      boxShadow: {
        float: '0 12px 38px rgba(25, 42, 69, .13), 0 2px 8px rgba(25, 42, 69, .05)',
        'float-dark': '0 12px 38px rgba(0, 0, 0, .5), 0 2px 8px rgba(0, 0, 0, .3)',
        'glass-dark': '0 10px 40px rgba(0, 0, 0, .55), 0 1px 0 rgba(255, 255, 255, .06) inset',
        glass: '0 2px 8px rgba(25, 28, 34, .12)',
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
