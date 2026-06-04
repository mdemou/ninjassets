import { isTruncatedText, TABLE_TEXT_MAX_LENGTH, truncateText } from '~/utils/truncateText';

interface TableCellTextProps {
  value: string | null | undefined;
  className?: string;
  empty?: string;
  maxLength?: number;
}

export function TableCellText({
  value,
  className,
  empty = '—',
  maxLength = TABLE_TEXT_MAX_LENGTH,
}: TableCellTextProps) {
  if (value == null || value === '') {
    return <span className={className}>{empty}</span>;
  }

  const display = truncateText(value, maxLength);
  const title = isTruncatedText(value, maxLength) ? value : undefined;

  return (
    <span className={className} title={title}>
      {display}
    </span>
  );
}
