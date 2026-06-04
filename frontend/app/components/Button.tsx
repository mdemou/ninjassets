import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "danger";
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-primary text-white hover:not-disabled:bg-primary-hover",
  secondary:
    "bg-secondary text-white hover:not-disabled:bg-secondary-hover",
  tertiary:
    "bg-transparent text-primary border border-border hover:not-disabled:bg-surface-alt",
  danger:
    "bg-danger text-white hover:not-disabled:bg-danger-hover",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-6 py-2 rounded text-[0.9375rem] font-medium cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
