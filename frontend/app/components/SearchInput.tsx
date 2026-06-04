interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Shared height and border for search fields and inline filter controls. */
export const searchInputClass =
  'box-border h-10 rounded border border-border bg-input px-4 text-base leading-10 text-foreground transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15';

export function SearchInput({ value, onChange, placeholder, className = '' }: SearchInputProps) {
  return (
    <div className={`mb-4 ${className}`.trim()}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${searchInputClass} w-full`}
      />
    </div>
  );
}
