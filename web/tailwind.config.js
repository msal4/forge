/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // ============================================
      // Modern Mesopotamian Color Palette
      // ============================================
      colors: {
        // Lapis Lazuli - Deep blues for primary elements
        lapis: {
          50: '#eef4ff',
          100: '#d9e5ff',
          200: '#bcd1ff',
          300: '#8eb3ff',
          400: '#5988ff',
          500: '#1a365d', // Primary - deep lapis blue
          600: '#152c4d',
          700: '#12243f',
          800: '#0f1d33',
          900: '#0c1627',
          950: '#080e19',
        },
        // Clay - Terracotta warm accent colors
        clay: {
          50: '#fdf6f3',
          100: '#fbeae4',
          200: '#f8d5c8',
          300: '#f2b8a3',
          400: '#e99373',
          500: '#c46243', // Primary - warm terracotta
          600: '#b04d32',
          700: '#923d29',
          800: '#773426',
          900: '#632f24',
          950: '#35160f',
        },
        // Parchment - Off-white backgrounds
        parchment: {
          50: '#fdfcfa',
          100: '#f9f6f0',
          200: '#f5f0e6', // Primary - light parchment
          300: '#ece3d3',
          400: '#dfd1b8',
          500: '#d0bc99',
          600: '#bda37a',
          700: '#a68960',
          800: '#8a7050',
          900: '#725d44',
          950: '#3d3022',
        },
        // Gold - Accent for special elements
        gold: {
          50: '#fdfaeb',
          100: '#faf2c7',
          200: '#f5e38b',
          300: '#f0d04f',
          400: '#e9bd28',
          500: '#d4a017', // Primary - gilded gold
          600: '#b77c11',
          700: '#925811',
          800: '#794615',
          900: '#673a17',
          950: '#3c1e09',
        },
        // Stone - Warm grays for muted/secondary text
        // Inspired by weathered clay tablets and limestone
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e', // Muted icons, borders
          500: '#78716c', // Primary - secondary text, placeholders
          600: '#57534e', // Darker muted text
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
      },
      // ============================================
      // Typography - Serif for ancient inscription feel
      // ============================================
      fontFamily: {
        // Serif for headers - evokes stone inscriptions
        inscription: ['Crimson Pro', 'Noto Naskh Arabic', 'Crimson Text', 'Georgia', 'serif'],
        // Sans for body text - modern readability
        body: ['Inter', 'Noto Naskh Arabic', 'system-ui', '-apple-system', 'sans-serif'],
        // Arabic - Noto Naskh for authentic Mesopotamian feel
        arabic: ['Noto Naskh Arabic', 'Amiri', 'serif'],
        // Monospace for code
        code: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      // ============================================
      // Spacing & Sizing
      // ============================================
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // ============================================
      // Border Radius - Slightly softer for tablet feel
      // ============================================
      borderRadius: {
        'tablet': '0.375rem',
      },
      // ============================================
      // Box Shadows - Subtle depth
      // ============================================
      boxShadow: {
        'tablet': '0 2px 8px -2px rgba(26, 54, 93, 0.15), 0 4px 16px -4px rgba(26, 54, 93, 0.1)',
        'tablet-hover': '0 4px 12px -2px rgba(26, 54, 93, 0.2), 0 8px 24px -4px rgba(26, 54, 93, 0.15)',
        'inner-glow': 'inset 0 1px 2px rgba(255, 255, 255, 0.5)',
      },
      // ============================================
      // Animations
      // ============================================
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
