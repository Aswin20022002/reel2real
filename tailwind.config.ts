import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#0B1F3A", 700: "#24384f", 500: "#51657d", 300: "#93a3b8", 200: "#c9d3e0", 100: "#e4eaf2", 50: "#f1f5fa" },
        sky: { DEFAULT: "#0A6CFF", 50: "#eaf2ff", 100: "#d3e4ff", 700: "#0a4fbd" },
        signal: { DEFAULT: "#E5322D", 50: "#fdecec", 700: "#b3211d" },
        lagoon: { DEFAULT: "#0E9F8E", 50: "#e3f6f3", 700: "#0a7266" },
        amber: { DEFAULT: "#F5A524", 50: "#fff4dd", 700: "#a76a00" },
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Figtree", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        ticket: "0 1px 0 rgba(11,31,58,.06), 0 8px 24px -12px rgba(11,31,58,.25)",
      },
    },
  },
  plugins: [],
};
export default config;
