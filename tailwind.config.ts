import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        'sans': ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'display': ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'body': ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'heading': ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mono': ['var(--font-figure)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'label': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em', fontWeight: '600' }],
        'xs': ['0.8125rem', { lineHeight: '1.15rem' }],
        'sm': ['0.9375rem', { lineHeight: '1.45rem' }],
        'base': ['1.0625rem', { lineHeight: '1.6rem' }],
        'lg': ['1.1875rem', { lineHeight: '1.65rem' }],
        'xl': ['1.375rem', { lineHeight: '1.8rem', letterSpacing: '-0.01em' }],
        '2xl': ['1.75rem', { lineHeight: '2.15rem', letterSpacing: '-0.015em' }],
        '3xl': ['2.125rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }],
        '4xl': ['2.75rem', { lineHeight: '3rem', letterSpacing: '-0.025em' }],
        '5xl': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        '6xl': ['4rem', { lineHeight: '1.03', letterSpacing: '-0.035em' }],
        '7xl': ['5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
        '8xl': ['6.25rem', { lineHeight: '0.98', letterSpacing: '-0.045em' }],
        '9xl': ['8rem', { lineHeight: '0.95', letterSpacing: '-0.05em' }],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          fill: 'hsl(var(--primary-fill))',
          'fill-foreground': 'hsl(var(--primary-fill-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Legacy generic tokens. Not used inside src/components/ui; kept so
        // call sites elsewhere that still reference them are not left
        // fully unstyled while they migrate to safe/watch/breach.
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        glow: 'hsl(var(--glow))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          raised: 'hsl(var(--surface-raised))',
        },
        sunken: 'hsl(var(--sunken))',
        // Compliance-clock and payment-status colours only. Never buttons,
        // never chart series, never decoration.
        safe: 'hsl(var(--safe))',
        watch: 'hsl(var(--watch))',
        breach: 'hsl(var(--breach))',
        // Chart series only. Capped at 4; a 5th vendor folds into "Other".
        series: {
          1: 'hsl(var(--series-1))',
          2: 'hsl(var(--series-2))',
          3: 'hsl(var(--series-3))',
          4: 'hsl(var(--series-4))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'slide-in': 'slide-in 0.4s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
