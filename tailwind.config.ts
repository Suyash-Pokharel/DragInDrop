import type { Config } from "tailwindcss";

/**
 * NOTE: With Tailwind CSS v4 and the `@import "tailwindcss"` + `@tailwindcss/postcss` setup,
 * this traditional config file is NOT used by the build pipeline (v4 uses CSS-based config).
 * It is kept solely for editor tooling (IntelliSense, VS Code extension, etc.).
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
