import type { ChangeEvent } from "react";
import { SearchSelect, type SearchSelectOption } from "./SearchSelect";

type Option = SearchSelectOption;

interface FormInputProps {
  label: string;
  name: string;
  type?:
  | "text"
  | "email"
  | "password"
  | "number"
  | "date"
  | "time"
  | "select"
  | "checkbox"
  | "radio"
  | "textarea";
  value: string | number | boolean;
  onChange: (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Option[];
  fetchOptions?: (search: string) => Promise<Option[]>;
  emptyOption?: Option;
  selectedOption?: Option | null;
  searchPlaceholder?: string;
  debounceMs?: number;
  /** Hide the in-menu search box (static short lists). */
  hideSearch?: boolean;
  className?: string;
  /** Maps to data-testid on the native input (for E2E). */
  testId?: string;
}

const inputClass =
  "w-full px-4 py-2 border border-border rounded bg-input text-foreground text-base transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted disabled:border-border/80 disabled:opacity-100";

export function FormInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  required,
  disabled,
  options,
  fetchOptions,
  emptyOption,
  selectedOption,
  searchPlaceholder,
  debounceMs,
  hideSearch,
  className = "",
  testId,
}: FormInputProps) {
  const id = `field-${name}`;
  const wrapperClass = `flex flex-col gap-1 mb-4 ${className}`.trim();

  if (type === "checkbox") {
    return (
      <div className={wrapperClass}>
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            id={id}
            type="checkbox"
            name={name}
            checked={value as boolean}
            onChange={onChange}
            disabled={disabled}
          />
          {label}
        </label>
        {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
      </div>
    );
  }

  if (type === "select") {
    const selectOnChange = (next: string) => {
      onChange({
        target: { name, value: next },
      } as ChangeEvent<HTMLSelectElement>);
    };

    if (fetchOptions) {
      return (
        <SearchSelect
          label={label}
          name={name}
          value={value as string}
          onChange={selectOnChange}
          fetchOptions={fetchOptions}
          emptyOption={emptyOption}
          selectedOption={selectedOption}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          hideSearch={hideSearch}
          required={required}
          disabled={disabled}
          error={error}
          className={className}
          debounceMs={debounceMs}
          testId={testId}
        />
      );
    }

    return (
      <SearchSelect
        label={label}
        name={name}
        value={value as string}
        onChange={selectOnChange}
        options={options ?? []}
        emptyOption={emptyOption}
        selectedOption={selectedOption}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        hideSearch={hideSearch}
        required={required}
        disabled={disabled}
        error={error}
        className={className}
        debounceMs={debounceMs}
        testId={testId}
      />
    );
  }

  if (type === "radio") {
    return (
      <div className={wrapperClass}>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {options?.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={onChange}
              disabled={disabled}
            />
            {opt.label}
          </label>
        ))}
        {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className={wrapperClass}>
        <label className="text-sm font-medium text-foreground" htmlFor={id}>
          {label}
        </label>
        <textarea
          id={id}
          name={name}
          value={value as string}
          onChange={onChange}
          className={inputClass}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={4}
        />
        {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        data-testid={testId}
        value={value as string | number}
        onChange={onChange}
        className={inputClass}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
    </div>
  );
}
