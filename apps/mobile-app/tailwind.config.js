/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.{js,ts,tsx,jsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./index.{js,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#920002',      // Deep Red Button
          gold: '#BF9A54',     // Gold/Tan Toggle & Accents
          beige: '#FBF8F2',    // Beige Background
          input: '#F1EEE3',    // Input Background
          black: '#2F2F2F'
        }
      },
      fontFamily: {
        // Inter (Body)
        inter: ["Inter_400Regular"],        // Default: className="font-inter"
        "inter-medium": ["Inter_500Medium"], // Medium: className="font-inter-medium"
        "inter-bold": ["Inter_700Bold"],     // Bold: className="font-inter-bold"

        // Plus Jakarta Sans (Headings)
        jakarta: ["PlusJakartaSans_400Regular"],         // Default: className="font-jakarta"
        "jakarta-medium": ["PlusJakartaSans_500Medium"], // Medium: className="font-jakarta-medium"
        "jakarta-bold": ["PlusJakartaSans_700Bold"],     // Bold: className="font-jakarta-bold"
      }
    },
  },
  plugins: [],
}