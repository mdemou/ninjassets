import { GITHUB_REPO_URL } from '~/data/docs-pages';

interface GithubRepoLinkProps {
  className?: string;
}

export function GithubRepoLink({ className = '' }: GithubRepoLinkProps) {
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label="View Ninjasset on GitHub"
    >
      <img
        src="/github.png"
        alt=""
        width={24}
        height={24}
        className="h-6 w-6 object-contain"
      />
    </a>
  );
}
