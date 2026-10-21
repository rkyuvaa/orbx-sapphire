/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          accent: '#16C47F',
          light: '#3ae09d',
          dark: '#0b965f',
          pine: '#1e4d36',
        },
        dark: {
          bg: '#0A1712',
          surface: '#0F211A',
          surface2: '#142A21',
          border: 'rgba(255, 255, 255, 0.09)',
        },
        light: {
          bg: '#F4F6F5',
          surface: '#FFFFFF',
          surface2: '#E8ECE9',
          border: 'rgba(0, 0, 0, 0.08)',
        },
        primary: {
          DEFAULT: '#16C47F',
          light: '#3ae09d',
          dark: '#0b965f',
        },
        accent: {
          DEFAULT: '#16C47F',
          alt: '#3ae09d',
          light: '#3ae09d',
        },
        sage: {
          DEFAULT: '#1e4d36',
          dark: '#142A21',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        brand: ['Comfortaa', 'cursive'],
      },
      borderRadius: {
        DEFAULT: '12px',
        card: '14px',
        modal: '16px',
        btn: '8px',
        chip: '6px',
      },
      boxShadow: {
        'orbx': '0 4px 20px rgba(0, 0, 0, 0.25)',
        'orbx-hover': '0 8px 32px rgba(0, 0, 0, 0.40)',
      },
      transitionTimingFunction: {
        'ease-out-orbx': 'cubic-bezier(.22, .8, .25, 1)',
        'ease-standard': 'cubic-bezier(.4, 0, .2, 1)',
      },
      transitionDuration: {
        'micro': '150ms',
        'short': '220ms',
        'primary': '240ms',
        'complex': '320ms',
      },
    },
  },
  plugins: [],
};
