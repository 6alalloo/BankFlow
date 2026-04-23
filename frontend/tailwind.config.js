/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
            // "Premium Dark" palette
            navy: {
                950: "#05050a", // Deep background
                900: "#0b1120", // Card background
                800: "#1e293b", // Lighter elements
            },
            "cyan-glow": "#38bdf8", // Primary glow (use as text-cyan-glow, bg-cyan-glow)
            neon: {
                green: "#4ade80",
                red: "#f87171",
                purple: "#a855f7"
            }
        },
        fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
        },
        boxShadow: {
            'glow-sm': '0 0 10px rgba(56, 189, 248, 0.1)',
            'glow-md': '0 0 20px rgba(56, 189, 248, 0.2)',
            'glow-lg': '0 0 30px rgba(56, 189, 248, 0.3)',
        }
      },
    },
    plugins: [],
  }
