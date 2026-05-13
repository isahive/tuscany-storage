import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brown:  { DEFAULT: '#1C0F06', light: '#2C1A0E' },
        tan:    { DEFAULT: '#9E7B3C', light: '#B8914A' },
        cream:  { DEFAULT: '#FAF7F2' },
        mid:    { DEFAULT: '#EDE5D8' },
        muted:  { DEFAULT: '#8A7B6B' },
        olive:  { DEFAULT: '#8CA87C', dark: '#7E9770', darker: '#708663' },
      },
      fontFamily: {
        // Match live tuscanystorage.com — Bootstrap default system stack
        sans:  ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', '"Noto Sans"', '"Liberation Sans"', 'Arial', 'sans-serif'],
        serif: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
  // Respect prefers-reduced-motion — disables transitions/animations for users who prefer it
  // Applied via `motion-safe:` and `motion-reduce:` variants in Tailwind
}

export default config
