import { Link, useParams } from 'react-router';
import { docsSections } from '~/data/docs-pages';

interface DocsSidebarProps {
  id?: string;
  className?: string;
  onNavigate?: () => void;
}

export function DocsSidebar({ id, className = '', onNavigate }: DocsSidebarProps) {
  const { section: activeSection, page: activePage } = useParams<{ section: string; page: string }>();

  return (
    <aside
      id={id}
      className={className}
    >
      <nav>
        {docsSections.map((sec) => (
          <div
            key={sec.id}
            className="mb-6"
          >
            <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-widest text-muted/70">
              {sec.label}
            </p>
            <ul className="space-y-0.5">
              {sec.pages.map((pg) => {
                const isActive = activeSection === sec.id && activePage === pg.id;
                return (
                  <li key={pg.id}>
                    <Link
                      to={`/docs/${sec.id}/${pg.id}`}
                      onClick={onNavigate}
                      className={[
                        'flex items-center rounded-lg px-3 py-1.5 text-sm no-underline transition-colors hover:no-underline',
                        isActive
                          ? 'bg-[var(--color-primary-2x-light)] font-medium text-[var(--color-primary-x-dark)] hover:text-[var(--color-primary-x-dark)]'
                          : 'text-muted hover:bg-surface-alt hover:text-foreground',
                      ].join(' ')}
                    >
                      {isActive && (
                        <span className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                      {pg.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
