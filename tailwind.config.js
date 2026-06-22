/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#f3f4f6", // Locatel light gray
        foreground: "#1f2937", // Slate text
        card: {
          DEFAULT: "#ffffff",
          foreground: "#1f2937",
        },
        border: "#e5e7eb",
        primary: {
          DEFAULT: "#009639", // Locatel Green
          hover: "#008030",
          light: "#e6f4ea",
          foreground: "#ffffff",
        },
        accent: {
          orange: "#ffb81c" // Locatel Orange
        }
      },
    },
  },
  plugins: [],
}
