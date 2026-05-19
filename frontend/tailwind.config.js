/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: "#0f1012",
        ghost: "#f2f2f4",
        canvas: "#fdfdfd",
        skyline: "#868788",
        slate: "#8f8f8f",
        graphite: "#020201",
        future: "#0071e3",
      },
      fontFamily: {
        sans: ["PP Neue Montreal", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(15, 16, 18, 0.06)",
        card: "0 4px 20px rgba(15, 16, 18, 0.06)",
        elevated: "0 8px 30px rgba(15, 16, 18, 0.08)",
      },
    },
  },
  plugins: [],
};
