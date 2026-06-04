export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          dark: 'var(--color-primary-dark)',
          light: 'var(--color-primary-light)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          hover: 'var(--color-secondary-hover)',
          dark: 'var(--color-secondary-dark)',
        },
        neutral: {
          DEFAULT: 'var(--color-neutral)',
          2: 'var(--color-neutral2)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          hover: 'var(--color-danger-hover)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        info: 'var(--color-info)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        card: 'var(--color-card)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        sidebar: {
          bg: 'var(--color-sidebar-bg)',
          border: 'var(--color-sidebar-border)',
          text: 'var(--color-sidebar-text)',
          'text-muted': 'var(--color-sidebar-text-muted)',
          hover: 'var(--color-sidebar-hover-bg)',
          active: 'var(--color-sidebar-active-bg)',
          'active-text': 'var(--color-sidebar-active-text)',
        },
      },
      fontFamily: {
        sans: [
          'Urbanist',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      keyframes: {
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(-0.5deg)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'toast-in': 'toast-in 0.2s ease-out',
        'fade-in': 'fade-in 0.15s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out both',
        float: 'float 5s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
      },
    },
  },
};
