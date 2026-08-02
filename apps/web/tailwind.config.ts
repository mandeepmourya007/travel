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
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-down': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'toast-exit': {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(30px)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(6px, -26px) rotate(8deg)' },
          '50%': { transform: 'translate(-4px, -34px) rotate(-6deg)' },
          '75%': { transform: 'translate(-8px, -14px) rotate(4deg)' },
        },
        'float-reverse': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(-8px, 22px) rotate(-9deg)' },
          '50%': { transform: 'translate(6px, 30px) rotate(7deg)' },
          '75%': { transform: 'translate(8px, 12px) rotate(-4deg)' },
        },
        drift: {
          '0%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(20px, -14px) rotate(10deg)' },
          '50%': { transform: 'translate(6px, -28px) rotate(-6deg)' },
          '75%': { transform: 'translate(-18px, -10px) rotate(8deg)' },
          '100%': { transform: 'translate(0, 0) rotate(0deg)' },
        },
        'fly-right': {
          '0%': { left: '-15%', transform: 'translateY(0)' },
          '50%': { left: '50%', transform: 'translateY(-10px)' },
          '100%': { left: '115%', transform: 'translateY(0)' },
        },
        'fly-left': {
          '0%': { left: '115%', transform: 'translateY(0)' },
          '50%': { left: '50%', transform: 'translateY(10px)' },
          '100%': { left: '-15%', transform: 'translateY(0)' },
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
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-down': 'slide-down 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'toast-exit': 'toast-exit 0.2s ease-in forwards',
        float: 'float 4s ease-in-out infinite',
        'float-slow': 'float 5.5s ease-in-out infinite',
        'float-reverse': 'float-reverse 4.5s ease-in-out infinite',
        drift: 'drift 6.5s ease-in-out infinite',
        'fly-right': 'fly-right 14s linear infinite',
        'fly-left': 'fly-left 17s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
