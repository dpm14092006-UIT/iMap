/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3176e8',
          600: '#2464d2',
          700: '#1f51ad',
        },
        ink: '#172b43',
      },
      boxShadow: {
        float: '0 12px 38px rgba(25, 42, 69, .13), 0 2px 8px rgba(25, 42, 69, .05)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
