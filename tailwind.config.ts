import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#e8ecef",
        sidebar: {
          bg: "#18181b",
          active: "#ffffff",
          text: "#a1a1aa",
        },
        card: {
          bg: "#ffffff",
          dark: "#202327",
        },
        accent: {
          yellow: "#d9f99d",
          lime: "#bef264",
          border: "#ca8a04",
        }
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      }
    },
  },
  plugins: [],
};
export default config;
