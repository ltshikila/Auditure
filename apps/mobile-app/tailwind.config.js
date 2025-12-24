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