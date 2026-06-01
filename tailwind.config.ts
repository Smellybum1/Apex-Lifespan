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
        amberline: "#b7791f",
        danger: "#b91c1c"
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 32, 51, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
