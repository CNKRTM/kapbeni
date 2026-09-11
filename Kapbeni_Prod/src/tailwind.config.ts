import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#b61722',
        'primary-container': '#8a1019',
        secondary: '#1d4ed8',
        'secondary-container': '#1e40af',
        tertiary: '#15803d',
        'tertiary-container': '#166534',
      },
      fontSize: {
        '3.5xl': ['2rem', { lineHeight: '2.25rem' }],
      },
    },
  },
  plugins: [],
}

export default config
