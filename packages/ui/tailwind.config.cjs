/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        muted: "var(--muted)",
        text: "var(--text)",
        textMuted: "var(--text-muted)",
        border: "var(--border)",
        info: "var(--info)",
        warn: "var(--warn)",
        error: "var(--error)",
        success: "var(--success)",
        selectionBg: "var(--selected-bg)",
        selectionText: "var(--selected-text)"
      },
      boxShadow: {
        card: "0 4px 18px rgba(0,0,0,0.06)"
      }
    }
  },
  plugins: []
};
