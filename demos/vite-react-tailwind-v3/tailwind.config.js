/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    spacing: {
      0: "0px",
      xs: "0.25rem",
      sm: "0.5rem",
      md: "1rem",
      lg: "1.5rem",
      xl: "2rem",
      "2xl": "3rem",
      "3xl": "4rem",
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "2rem",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
    borderRadius: {
      none: "0px",
      sm: "0.25rem",
      md: "0.5rem",
      lg: "0.75rem",
      xl: "1rem",
      full: "9999px",
    },
    extend: {
      colors: {
        primary: { DEFAULT: "#6366f1", foreground: "#ffffff" },
        secondary: { DEFAULT: "#e2e8f0", foreground: "#1e293b" },
        destructive: { DEFAULT: "#ef4444", foreground: "#ffffff" },
        muted: { DEFAULT: "#f1f5f9", foreground: "#64748b" },
        card: { DEFAULT: "#ffffff", foreground: "#0f172a" },
        border: "#e2e8f0",
      },
    },
  },
};
