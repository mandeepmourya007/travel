import type { Config } from 'tailwindcss'
import tokens from '../../packages/shared/src/theme/tokens.json'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: tokens.colors.primary,
        accent: tokens.colors.accent,
        highlight: tokens.colors.highlight,
        neutral: tokens.colors.neutral,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        error: tokens.colors.error,
        info: tokens.colors.info,
      },
      fontFamily: {
        sans: [tokens.typography.fontFamily.sans],
        display: [tokens.typography.fontFamily.display],
        mono: [tokens.typography.fontFamily.mono],
      },
      borderRadius: tokens.borderRadius,
      boxShadow: tokens.shadows,
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-zoom': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'page-enter': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
        spin: 'spin 0.8s linear infinite',
        'pulse-zoom': 'pulse-zoom 0.6s ease-in-out 0.2s 3',
        pop: 'pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
        'page-enter': 'page-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        shake: 'shake 0.4s ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
