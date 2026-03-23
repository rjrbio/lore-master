/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'Segoe UI', 'sans-serif'],
        body: ['IBM Plex Sans', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        carbon: '#0d1017',
        cobalt: '#1c56ff',
        violet: '#7a2dff',
      },
      boxShadow: {
        glass: '0 24px 56px rgba(8, 11, 19, 0.42)',
        neon: '0 0 0 1px rgba(122, 45, 255, 0.5), 0 0 24px rgba(28, 86, 255, 0.25)',
      },
      backdropBlur: {
        glass: '14px',
      },
      borderRadius: {
        glass: '18px',
      },
      keyframes: {
        pulseY: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.45' },
          '50%': { transform: 'translateY(-6px)', opacity: '1' },
        },
      },
      animation: {
        pulseY: 'pulseY 1.2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
