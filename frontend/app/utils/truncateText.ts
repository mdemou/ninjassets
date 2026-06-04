export const TABLE_TEXT_MAX_LENGTH = 32;

export function truncateText(value: string, maxLength = TABLE_TEXT_MAX_LENGTH): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

export function isTruncatedText(value: string, maxLength = TABLE_TEXT_MAX_LENGTH): boolean {
  return value.length > maxLength;
}
