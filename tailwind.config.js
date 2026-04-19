/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Industrial palette — steel, diesel, safety-yellow accent
        steel: {
          50:  '#f6f7f8',
          100: '#e9ecef',
          200: '#cfd4da',
          300: '#a9b1ba',
          400: '#7c8691',
          500: '#586069',
          600: '#434a52',
          700: '#333940',
          800: '#22262b',
          900: '#14171a',
        },
        safety: {
          DEFAULT: '#FFB500', // caterpillar-ish yellow
          dark:    '#CC8F00',
        },
        diesel: '#1b1e22',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
