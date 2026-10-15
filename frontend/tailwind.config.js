/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        orca: {
          dark: "#0b1320",
          navy: "#132238",
          card: "#192d4a",
          border: "#233d63",
          teal: "#06b6d4",
          cyan: "#38bdf8",
          accent: "#0284c7",
          muted: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
