/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0f",
        panel: "#12121a",
        line: "#23232f",
      },
    },
  },
  plugins: [],
};
