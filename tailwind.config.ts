import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#f5f7fb",
        line: "#d9e1ec",
        spruce: "#0f766e",
        signal: "#1d4ed8",
        amberline: "#8a5a0a",
        danger: "#b91c1c"
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 32, 51, 0.08)",
        card: "0 1px 3px rgba(23,32,51,0.07), 0 1px 2px rgba(23,32,51,0.04)",
        lift: "0 4px 16px rgba(23,32,51,0.08), 0 1px 3px rgba(23,32,51,0.05)"
      },
      borderRadius: {
        xl2: "0.875rem"
      },
      maxWidth: {
        "prose-wide": "68ch"
      }
    }
  },
  plugins: []
};

export default config;
