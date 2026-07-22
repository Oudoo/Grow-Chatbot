import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefdf6",
          100: "#d6f9e8",
          200: "#aff1d3",
          300: "#79e4b8",
          400: "#3ecf96",
          500: "#16b67c",
          600: "#0a9264",
          700: "#0a7452",
          800: "#0c5c43",
          900: "#0c4b38",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-app)",
          "system-ui",
          "Segoe UI",
          "Tahoma",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
