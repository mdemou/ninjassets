import { Link, useLocation } from 'react-router';
import { NotificationBell } from '~/components/NotificationBell';

const NINJASSET_LOGO_SRC = '/ninjasset.png';
import { useAuth } from '~/providers/AuthProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import { isNavbarHiddenPath } from '~/utils/appPaths';

export function Navbar() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const { user } = useSession();
  const { t } = useLanguage();

  if (isNavbarHiddenPath(pathname)) return null;

  const isAdmin = isAuthenticated && user?.roleName === 'ADMIN';

  return (
    <nav className="flex items-center justify-between px-6 py-2 bg-surface border-b border-border shadow-sm sticky top-0 z-100">
      <Link
        to="/"
        className="flex items-center gap-2 font-semibold text-lg text-foreground no-underline hover:no-underline"
      >
        <img
          src={NINJASSET_LOGO_SRC}
          alt=""
          width={24}
          height={24}
          className="shrink-0"
        />
        Ninjassets
      </Link>

      <div className="flex items-center gap-2">
        {isAdmin && <NotificationBell />}
        {!isAuthenticated && (
          <Link
            to="/login"
            className="text-muted text-[0.9375rem] no-underline px-2 py-1 rounded transition-colors hover:text-foreground hover:bg-surface-alt hover:no-underline"
          >
            {t('nav.login')}
          </Link>
        )}
      </div>
    </nav>
  );
}
