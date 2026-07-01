import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f8f9ff",
        surface: "#ffffff",
        "surface-subtle": "#f9fafb",
        "surface-muted": "#eef4ff",
        primary: "#00696b",
        "primary-hover": "#00585a",
        "primary-soft": "#e0f2f1",
        "on-primary": "#ffffff",
        ink: "#121c28",
        "ink-muted": "#3d4949",
        "ink-subtle": "#6d7a79",
        border: "#e5e7eb",
        "status-done-bg": "#def7ec",
        "status-done-text": "#03543f",
        "status-progress-bg": "#e1effe",
        "status-progress-text": "#1e429f",
        "status-todo-bg": "#f3f4f6",
        "status-todo-text": "#4b5563",
        "status-error-bg": "#fdf2f2",
        "status-error-text": "#9b1c1c",
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
