import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          sage: 'var(--brand-sage)',
          blush: 'var(--brand-blush)',
          cream: 'var(--brand-cream)',
          ink: 'var(--brand-ink)',
          gold: 'var(--brand-gold)',
        },
      },
      fontFamily: {
        heading: 'var(--font-fraunces)',
        body: 'var(--font-inter)',
      },
    },
  },
  plugins: [],
};

export default config;
