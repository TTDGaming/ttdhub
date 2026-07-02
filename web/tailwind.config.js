/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#f9f9f7',
        surface: '#fcfcfb',
        ink: '#0b0b0b',
        'ink-2': '#52514e',
        muted: '#898781',
        hairline: '#e1e0d9',
        brand: '#2a78d6',
        'brand-dark': '#1c5cab',
        sidebar: '#101623',
        'sidebar-2': '#1a2334',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,11,0.04), 0 1px 3px rgba(11,11,11,0.06)',
      },
    },
  },
  plugins: [],
};
