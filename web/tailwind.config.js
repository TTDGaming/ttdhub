/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        page: 'rgb(var(--page-rgb) / <alpha-value>)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        muted: 'var(--muted)',
        hairline: 'var(--hairline)',
        brand: 'rgb(var(--brand-rgb) / <alpha-value>)',
        'brand-hover': 'var(--brand-hover)',
        pos: 'var(--pos)',
        'pos-strong': 'var(--pos-strong)',
        neg: 'var(--neg)',
        sidebar: 'var(--sidebar)',
        'sidebar-2': 'var(--sidebar-2)',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
