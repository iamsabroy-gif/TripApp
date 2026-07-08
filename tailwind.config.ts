import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#f2f7f3",
          100: "#dfecdf",
          200: "#c0d9c3",
          300: "#96bf9d",
          400: "#689f73",
          500: "#478255",
          600: "#346842",
          700: "#2a5336",
          800: "#23432d",
          900: "#1d3726",
          950: "#0f1f15",
        },
      },
    },
  },
  plugins: [],
};

export default config;
