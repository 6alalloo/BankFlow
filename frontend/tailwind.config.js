/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        raycast: {
          canvas: "#040506",
          surface: {
            1: "#07080a",
            2: "#111214",
            3: "#1b1c1e",
          },
          text: {
            primary: "#ffffff",
            secondary: "#9c9c9d",
            tertiary: "#6a6b6c",
          },
          ember: "#ff6363",
          mint: "#59d499",
          sky: {
            start: "#56c2ff",
            end: "#138af2",
          },
        },
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "IBM Plex Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "raycast-key": "rgba(0,0,0,0.4) 0px 1.5px 0.5px 2.5px, rgb(0,0,0) 0px 0px 0.5px 1px, rgba(0,0,0,0.25) 0px 2px 1px 1px inset, rgba(255,255,255,0.2) 0px 1px 1px 1px inset",
        "raycast-ring": "rgb(27,28,30) 0px 0px 0px 1px, rgb(7,8,10) 0px 0px 0px 1px inset",
        "raycast-highlight": "rgba(255,255,255,0.05) 0px 1px 0px 0px inset, rgba(255,255,255,0.18) 0px 0px 0px 1px, rgba(0,0,0,0.2) 0px -1px 0px 0px inset",
      },
    },
  },
  plugins: [],
};
