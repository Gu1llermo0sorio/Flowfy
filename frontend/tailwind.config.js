/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary (Teal/Emerald)
        primary: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',  // primary main
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Accent (Indigo/Violet)
        accent: {
          50:  '#eef2ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          purple: '#8b5cf6',
        },
        // Semantic status colors with levels
        positive: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        danger: {
          50:  '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        warning: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Dark base
        slate: {
          850: '#1a2537',
          950: '#0a0f1e',
        },
        // Surface tokens — driven by CSS variables so they flip between dark/light
        surface: {
          50:  'var(--s50)',
          100: 'var(--s100)',
          200: 'var(--s200)',
          300: 'var(--s300)',
          400: 'var(--s400)',
          500: 'var(--s500)',
          600: 'var(--s600)',
          700: 'var(--s700)',
          800: 'var(--s800)',
          900: 'var(--s900)',
          950: 'var(--s950)',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        teal:    '0 4px 24px rgba(13, 148, 136, 0.15)',
        'teal-lg': '0 8px 40px rgba(13, 148, 136, 0.25)',
        card:    '0 2px 16px rgba(15, 23, 42, 0.08)',
        'card-dark': '0 2px 16px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'gradient-flowfy': 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)',
        'gradient-accent': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'gradient-dark':   'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      },
      animation: {
        'float-up': 'floatUp 1s ease forwards',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'slide-in-bottom': 'slideInBottom 0.3s ease forwards',
        'celebrate': 'celebrate 0.5s ease forwards',
        'counter': 'counter 0.8s ease',
      },
      keyframes: {
        floatUp: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-50px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        slideInBottom: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        celebrate: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

