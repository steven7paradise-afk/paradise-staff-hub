import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paradise: {
          pink: "#FFA8DD",
          softPink: "#FFD6EA",
          nude: "#F7E9EF",
          noir: "#1F1F1F",
          gold: "#E8C98B",
        },
      },
      boxShadow: {
        luxury: "0 24px 70px rgba(31, 31, 31, 0.10)",
        soft: "0 14px 34px rgba(31, 31, 31, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
