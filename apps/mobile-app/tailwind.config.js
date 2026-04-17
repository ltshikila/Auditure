/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{js,ts,tsx,jsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.{js,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#920002',
          gold: '#BF9A54',
          beige: '#FBF8F2',
          input: '#F1EEE3',
          black: '#2F2F2F',

          // Dark mode palette
          'dark-bg': '#151718',
          'dark-surface': '#1E2022',
          'dark-surface-elevated': '#2A2C2E',
          'dark-input': '#252729',
          'dark-border': '#2E3235',
          'dark-text': '#ECEDEE',
          'dark-text-secondary': '#9BA1A6',
          'dark-text-muted': '#687076',
        }
      },
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-medium": ["Inter_500Medium"],
        "inter-bold": ["Inter_700Bold"],

        jakarta: ["PlusJakartaSans_400Regular"],
        "jakarta-medium": ["PlusJakartaSans_500Medium"],
        "jakarta-bold": ["PlusJakartaSans_700Bold"],

        "dm-serif": ["DMSerifDisplay_400Regular"],
      }
    },
  },
  plugins: [],
}
