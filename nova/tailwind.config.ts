import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.06), 0 8px 24px -8px rgb(0 0 0 / 0.04)",
        elevated:
          "0 1px 0 0 rgb(255 255 255 / 0.8) inset, 0 4px 24px -4px rgb(0 0 0 / 0.08), 0 12px 40px -12px rgb(16 185 129 / 0.08)",
        glow: "0 0 0 1px rgb(16 185 129 / 0.1), 0 8px 32px -8px rgb(16 185 129 / 0.25)",
        "inner-soft": "inset 0 1px 0 0 rgb(255 255 255 / 0.6)",
        raised:
          "0 1px 0 0 rgb(255 255 255 / 0.95) inset, 0 -1px 0 0 rgb(0 0 0 / 0.04) inset, 0 2px 4px rgb(0 0 0 / 0.04), 0 8px 20px -4px rgb(0 0 0 / 0.1), 0 16px 40px -12px rgb(0 0 0 / 0.08)",
        "raised-hover":
          "0 1px 0 0 rgb(255 255 255 / 1) inset, 0 -1px 0 0 rgb(0 0 0 / 0.03) inset, 0 4px 8px rgb(0 0 0 / 0.06), 0 16px 32px -6px rgb(0 0 0 / 0.12), 0 28px 56px -16px rgb(16 185 129 / 0.15)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "logo-flip-rtl": {
          "0%": {
            opacity: "0.4",
            transform: "perspective(520px) rotateY(95deg) scale(0.88)",
          },
          "35%": {
            opacity: "1",
            transform: "perspective(520px) rotateY(35deg) scale(0.96)",
          },
          "70%": {
            opacity: "1",
            transform: "perspective(520px) rotateY(-14deg) scale(1.04)",
          },
          "100%": {
            opacity: "1",
            transform: "perspective(520px) rotateY(0deg) scale(1)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "fade-up": "fade-up 0.4s ease-out both",
        float: "float 4s ease-in-out infinite",
        "logo-flip-rtl": "logo-flip-rtl 2.4s cubic-bezier(0.33, 0.1, 0.25, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
