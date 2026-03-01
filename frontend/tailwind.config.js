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
        // Positive
        positive: '#10b981',
        // Danger
        danger: '#f43f5e',
        // Warning
        warning: '#f59e0b',
        // Dark base
        slate: {
          850: '#1a2537',
          950: '#0a0f1e',
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

