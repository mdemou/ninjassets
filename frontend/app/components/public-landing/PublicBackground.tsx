export function PublicBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-card)_0%,var(--color-surface-alt)_100%)]" />
      <div className="absolute -top-32 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,var(--color-primary-2x-light)_0%,transparent_70%)] animate-pulse-glow" />
      <div className="absolute top-24 -left-20 h-64 w-64 rounded-full bg-[var(--color-primary-pale)]/40 blur-3xl animate-float" />
      <div className="absolute top-40 -right-16 h-72 w-72 rounded-full bg-[var(--color-status-stock-light)]/50 blur-3xl animate-float-slow" />
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(var(--color-foreground) 1px, transparent 1px), linear-gradient(90deg, var(--color-foreground) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}
