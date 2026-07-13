/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefdf9', 100: '#d3faf0', 200: '#a6f2e0', 300: '#6fe4cc',
          400: '#3ecdb4', 500: '#1eb09a', 600: '#0f766e', 700: '#115e56',
          800: '#124b46', 900: '#123f3b'
        },
        surface: { light: '#f7faf9', dark: '#0b1120' }
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 8px 24px -12px rgba(15,23,42,0.15)'
      }
    }
  },
  plugins: []
};
