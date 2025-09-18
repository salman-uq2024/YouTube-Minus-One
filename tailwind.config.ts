import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        surface: '#181818',
        accent: '#ff5252'
      }
    }
  },
  plugins: []
};

export default config;
