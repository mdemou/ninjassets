import type { MouseEvent, ReactNode, Ref } from 'react';

interface IconButtonProps {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}

interface TableRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
  /** Rendered before edit/delete (e.g. QR hover preview). */
  leadingAction?: ReactNode;
  /** Optional change-password action, rendered between edit and delete. */
  onChangePassword?: () => void;
  changePasswordLabel?: string;
}

export { stripedTableRowClass } from '~/components/Table';

export function TableRowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  leadingAction,
  onChangePassword,
  changePasswordLabel,
}: TableRowActionsProps) {
  return (
    <div className="flex gap-1">
      {leadingAction}
      <EditIconButton onClick={onEdit} title={editLabel} />
      {onChangePassword && <PasswordIconButton onClick={onChangePassword} title={changePasswordLabel} />}
      <DeleteIconButton onClick={onDelete} title={deleteLabel} />
    </div>
  );
}

function iconButtonAttrs(title: string, disabled?: boolean) {
  return { title, 'aria-label': title, disabled };
}

const baseClass =
  'inline-flex items-center justify-center p-1.5 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

const tertiaryClass = 'bg-transparent text-primary border border-border hover:not-disabled:bg-surface-alt';

const dangerClass = 'bg-danger text-white hover:not-disabled:bg-danger-hover';

export function ViewIconButton({ onClick, title = 'View', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle
          cx="12"
          cy="12"
          r="3"
        />
      </svg>
    </button>
  );
}

export function EditIconButton({ onClick, title = 'Edit', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

export function PasswordIconButton({ onClick, title = 'Change password', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect
          x="3"
          y="11"
          width="18"
          height="11"
          rx="2"
          ry="2"
        />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </button>
  );
}

export function AddIconButton({ onClick, title = 'Add', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line
          x1="12"
          y1="5"
          x2="12"
          y2="19"
        />
        <line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
        />
      </svg>
    </button>
  );
}

interface QrIconButtonProps {
  title?: string;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function QrIconButton({
  title = 'QR code',
  disabled,
  buttonRef,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: QrIconButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`${baseClass} ${tertiaryClass}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v3h-3v-3zm-5 0h3v3h-3v-3zm5 5h3v3h-3v-3zm-5 0h3v3h-3v-3zm5 5h3v3h-3v-3zm-5 0h3v3h-3v-3z" />
      </svg>
    </button>
  );
}

export function SendIconButton({ onClick, title = 'Send', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    </button>
  );
}

export function PowerIconButton({ onClick, title = 'Toggle', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${tertiaryClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    </button>
  );
}

export function DeleteIconButton({ onClick, title = 'Delete', disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${dangerClass}`}
      {...iconButtonAttrs(title, disabled)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  );
}
