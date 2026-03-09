/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#f5c542", // gold
        bgsoft: "#0f0f0f",  // dark background
        card: "#1c1c1c",
        muted: "#a1a1aa",
      },
    },
  },
  plugins: [],
};
