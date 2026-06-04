import { Link } from 'react-router';

const NINJASSET_LOGO_SRC = '/ninjasset.png';

interface WordmarkProps {
  /** When set, wraps the wordmark in a home link. Omit for static branding inside a page header. */
  linkToHome?: boolean;
}

export function Wordmark({ linkToHome = true }: WordmarkProps) {
  const content = (
    <span className="flex items-center gap-2.5 font-semibold text-lg text-foreground">
      <img
        src={NINJASSET_LOGO_SRC}
        alt=""
        width={28}
        height={28}
        className="shrink-0"
      />
      <span className="bg-gradient-to-r from-[var(--color-primary-dark)] to-primary bg-clip-text text-transparent">
        Ninjasset
      </span>
    </span>
  );

  if (!linkToHome) return content;

  return (
    <Link
      to="/"
      className="no-underline hover:no-underline"
    >
      {content}
    </Link>
  );
}
