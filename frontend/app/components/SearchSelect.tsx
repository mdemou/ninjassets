import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '~/providers/LanguageProvider';

const MENU_GAP_PX = 4;
const MENU_SEARCH_AREA_PX = 52;
const MENU_LIST_MAX_PX = 192;
const MENU_Z_INDEX = 250;

export interface SearchSelectOption {
  label: string;
  value: string;
  /** When set, renders the label as a colored pill (e.g. asset status). */
  badgeClass?: string;
}

interface SearchSelectBaseProps {
  label?: string;
  /** Used as the trigger's accessible name when no visible `label` is rendered. */
  ariaLabel?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  emptyOption?: SearchSelectOption;
  selectedOption?: SearchSelectOption | null;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Hide the in-menu search box (e.g. when an external filter already covers it). */
  hideSearch?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  debounceMs?: number;
  /** Maps to data-testid on the trigger button (for E2E). */
  testId?: string;
}

interface StaticSearchSelectProps extends SearchSelectBaseProps {
  options: SearchSelectOption[];
  fetchOptions?: never;
}

interface AsyncSearchSelectProps extends SearchSelectBaseProps {
  options?: never;
  fetchOptions: (search: string) => Promise<SearchSelectOption[]>;
}

export type SearchSelectProps = StaticSearchSelectProps | AsyncSearchSelectProps;

const triggerClass =
  'w-full px-4 py-2 border border-border rounded bg-input text-foreground text-base text-left transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted disabled:border-border/80 disabled:opacity-100';

const searchClass =
  'w-full px-3 py-2 border border-border rounded bg-input text-foreground text-sm transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/15 placeholder:text-muted';

function filterBySearch(items: SearchSelectOption[], search: string): SearchSelectOption[] {
  const q = search.trim().toLowerCase();
  if (!q) return items;
  return items.filter((o) => o.label.toLowerCase().includes(q));
}

export function SearchSelect(props: SearchSelectProps) {
  const {
    label,
    ariaLabel,
    name,
    value,
    onChange,
    emptyOption,
    selectedOption,
    placeholder,
    searchPlaceholder,
    hideSearch,
    required,
    disabled,
    error,
    className = '',
    debounceMs = 300,
    testId,
  } = props;

  const fetchOptions = 'fetchOptions' in props ? props.fetchOptions : undefined;
  const isAsync = fetchOptions != null;
  const staticOptionsSource = isAsync ? null : props.options;
  const staticOptions = useMemo(
    (): SearchSelectOption[] => staticOptionsSource ?? [],
    [staticOptionsSource],
  );

  const { t } = useLanguage();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState<{
    style: CSSProperties;
    listMaxHeight: number;
    openUpward: boolean;
  } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<SearchSelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const loadOptionsRequestId = useRef(0);

  const fieldId = `field-${name}`;

  const staticListOptions = useMemo(() => {
    const base = emptyOption
      ? [emptyOption, ...staticOptions.filter((o) => o.value !== emptyOption.value)]
      : staticOptions;
    return filterBySearch(base, debouncedSearch);
  }, [staticOptions, emptyOption, debouncedSearch]);

  const loadAsyncOptions = useCallback(
    async (search: string) => {
      if (!fetchOptions) return;
      const requestId = ++loadOptionsRequestId.current;
      setLoading(true);
      try {
        const result = await fetchOptions(search);
        if (requestId === loadOptionsRequestId.current) {
          setAsyncOptions(result);
        }
      } catch {
        if (requestId === loadOptionsRequestId.current) {
          setAsyncOptions([]);
        }
      } finally {
        if (requestId === loadOptionsRequestId.current) {
          setLoading(false);
        }
      }
    },
    [fetchOptions],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handle = setTimeout(() => setDebouncedSearch(searchInput), debounceMs);
    return () => clearTimeout(handle);
  }, [isOpen, searchInput, debounceMs]);

  useEffect(() => {
    if (!isOpen || !isAsync) return;
    void loadAsyncOptions(debouncedSearch);
  }, [isOpen, debouncedSearch, isAsync, loadAsyncOptions]);

  const listOptions = isAsync
    ? emptyOption
      ? [emptyOption, ...asyncOptions.filter((o) => o.value !== emptyOption.value)]
      : asyncOptions
    : staticListOptions;

  const updateMenuPlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const searchAreaPx = hideSearch ? 0 : MENU_SEARCH_AREA_PX;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.getBoundingClientRect().height ?? searchAreaPx + MENU_LIST_MAX_PX;
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP_PX;
    const spaceAbove = rect.top - MENU_GAP_PX;
    const openUpward = spaceBelow < menuHeight && spaceAbove >= spaceBelow;

    const listMaxHeight = Math.max(
      80,
      Math.min(
        MENU_LIST_MAX_PX,
        (openUpward ? spaceAbove : spaceBelow) - searchAreaPx - MENU_GAP_PX,
      ),
    );

    setMenuPlacement({
      openUpward,
      listMaxHeight,
      style: openUpward
        ? {
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            bottom: window.innerHeight - rect.top + MENU_GAP_PX,
            zIndex: MENU_Z_INDEX,
          }
        : {
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            top: rect.bottom + MENU_GAP_PX,
            zIndex: MENU_Z_INDEX,
          },
    });
  }, [hideSearch]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPlacement(null);
      return;
    }
    updateMenuPlacement();
    const raf = requestAnimationFrame(updateMenuPlacement);
    window.addEventListener('resize', updateMenuPlacement);
    window.addEventListener('scroll', updateMenuPlacement, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', updateMenuPlacement);
      window.removeEventListener('scroll', updateMenuPlacement, true);
    };
  }, [isOpen, updateMenuPlacement, listOptions.length, loading, debouncedSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      searchRef.current?.focus();
    }
  }, [isOpen]);

  const labelPool = useMemo(() => {
    if (isAsync) {
      return emptyOption
        ? [emptyOption, ...asyncOptions.filter((o) => o.value !== emptyOption.value)]
        : asyncOptions;
    }
    const base = emptyOption
      ? [emptyOption, ...staticOptions.filter((o) => o.value !== emptyOption.value)]
      : staticOptions;
    return base;
  }, [isAsync, emptyOption, asyncOptions, staticOptions]);

  const resolvedOption = (() => {
    if (!value) return emptyOption ?? null;
    const fromList = labelPool.find((o) => o.value === value);
    if (fromList) return fromList;
    if (selectedOption?.value === value) return selectedOption;
    if (emptyOption?.value === value) return emptyOption;
    return null;
  })();

  const resolvedLabel = (() => {
    if (!value) return emptyOption?.label ?? placeholder ?? '';
    return resolvedOption?.label ?? placeholder ?? value;
  })();

  const resolvedBadgeClass = resolvedOption?.badgeClass;

  const open = () => {
    if (disabled) return;
    setSearchInput('');
    setDebouncedSearch('');
    setIsOpen(true);
  };

  const selectValue = (next: string) => {
    onChange(next);
    setIsOpen(false);
  };

  const wrapperClass = `relative flex flex-col gap-1 mb-4 ${className}`.trim();

  return (
    <div className={wrapperClass} ref={rootRef}>
      {label && (
        <label className="text-sm font-medium text-foreground" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <input type="hidden" name={name} value={value} required={required && !value} />
      <button
        ref={triggerRef}
        id={fieldId}
        type="button"
        className={`${triggerClass} flex items-center justify-between gap-2`}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        data-testid={testId}
      >
        <span className={value || emptyOption ? 'truncate' : 'truncate text-muted'}>
          {resolvedBadgeClass ? (
            <span className={`inline-block max-w-full truncate px-2 py-0.5 rounded-full text-xs font-medium ${resolvedBadgeClass}`}>
              {resolvedLabel}
            </span>
          ) : (
            resolvedLabel
          )}
        </span>
        <span className="text-muted shrink-0" aria-hidden>
          ▾
        </span>
      </button>

      {isOpen &&
        menuPlacement &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={menuPlacement.style}
            className="rounded border border-border bg-surface shadow-lg"
          >
            {!hideSearch && (
              <div className="p-2 border-b border-border">
                <input
                  ref={searchRef}
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={searchPlaceholder ?? t('common.selectSearchPlaceholder')}
                  className={searchClass}
                  aria-label={searchPlaceholder ?? t('common.selectSearchPlaceholder')}
                />
              </div>
            )}
            <ul
              id={listId}
              role="listbox"
              className="overflow-y-auto py-1"
              style={{ maxHeight: menuPlacement.listMaxHeight }}
              aria-busy={isAsync && loading}
            >
              {isAsync && loading && listOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">{t('common.loading')}</li>
              ) : listOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">{t('common.noResults')}</li>
              ) : (
                listOptions.map((opt) => (
                  <li key={opt.value || '__empty__'} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === opt.value}
                      className={
                        opt.badgeClass
                          ? `w-full px-3 py-2 text-left text-sm hover:bg-surface-alt ${
                              value === opt.value ? 'bg-surface-alt' : ''
                            }`
                          : `w-full px-3 py-2 text-left text-sm hover:bg-primary/10 ${
                              value === opt.value ? 'bg-primary/15 text-primary font-medium' : 'text-foreground'
                            }`
                      }
                      onClick={() => selectValue(opt.value)}
                    >
                      {opt.badgeClass ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${opt.badgeClass}`}
                        >
                          {opt.label}
                        </span>
                      ) : (
                        opt.label
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )}

      {error && <span className="text-[0.8125rem] text-danger">{error}</span>}
    </div>
  );
}

/** @deprecated Use `SearchSelect` with `fetchOptions` instead. */
export const AsyncSearchSelect = SearchSelect;

export type AsyncSearchSelectOption = SearchSelectOption;
