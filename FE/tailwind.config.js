module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          main: 'var(--bg-main)',
          card: 'var(--bg-card)',
          glass: 'var(--bg-glass)',
          glassHover: 'var(--bg-glass-hover)',
          border: 'var(--border-glass)',
          borderFocus: 'var(--border-glass-focus)',
        },
        cyan: {
          premium: '#06b6d4',
          glow: 'rgba(6, 182, 212, 0.3)',
        },
        purple: {
          premium: '#8b5cf6',
          glow: 'rgba(139, 92, 246, 0.3)',
        },
        teal: {
          premium: '#14b8a6',
        },
        emerald: {
          premium: '#10b981',
          glow: 'rgba(16, 185, 129, 0.15)',
        },
        rose: {
          premium: '#f43f5e',
          glow: 'rgba(244, 63, 94, 0.15)',
        },
        amber: {
          premium: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.15)',
        }
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 12px rgba(6, 182, 212, 0.3)',
        'rose-glow': '0 0 12px rgba(244, 63, 94, 0.3)',
      }
    },
  },
  plugins: [],
}