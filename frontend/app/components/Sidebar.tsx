import type { ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '~/providers/AuthProvider';
import { useLanguage } from '~/providers/LanguageProvider';
import { useSession } from '~/providers/SessionProvider';
import type { NavItem } from '~/types';
import { isPublicAppPath } from '~/utils/appPaths';
import { getGroupedNavItems } from './NavItems';

const SIDEBAR_STORAGE_KEY = 'ninjassets-sidebar-collapsed';
const SIDEBAR_SECTIONS_STORAGE_KEY = 'ninjassets-sidebar-sections-collapsed';
const ADMIN_ROOT_SECTION_ID = 'admin';
const MOBILE_BREAKPOINT = 768;

function useIsSmallScreen(): boolean {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsSmall(mql.matches);
    const handler = () => setIsSmall(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isSmall;
}

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored === null) return false;
  return stored === 'true';
}

function saveCollapsed(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
}

function getInitialSectionCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
  } catch {
    /* ignore invalid stored state */
  }
  return {};
}

function saveSectionCollapsed(sections: Record<string, boolean>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(sections));
}

function isNavItemActive(pathname: string, to: string): boolean {
  return (
    pathname === to || (to === '/dashboard' && pathname === '/') || (to !== '/dashboard' && pathname.startsWith(to))
  );
}

const navIcons: Record<string, ReactNode> = {
  '/dashboard': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="3"
        y="3"
        width="7"
        height="9"
        rx="1"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="5"
        rx="1"
      />
      <rect
        x="14"
        y="12"
        width="7"
        height="9"
        rx="1"
      />
      <rect
        x="3"
        y="16"
        width="7"
        height="5"
        rx="1"
      />
    </svg>
  ),
  '/admin/analytics': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line
        x1="18"
        y1="20"
        x2="18"
        y2="10"
      />
      <line
        x1="12"
        y1="20"
        x2="12"
        y2="4"
      />
      <line
        x1="6"
        y1="20"
        x2="6"
        y2="14"
      />
    </svg>
  ),
  '/admin/overview': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line
        x1="18"
        y1="20"
        x2="18"
        y2="10"
      />
      <line
        x1="12"
        y1="20"
        x2="12"
        y2="4"
      />
      <line
        x1="6"
        y1="20"
        x2="6"
        y2="14"
      />
    </svg>
  ),
  '/admin/reports': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect
        x="8"
        y="2"
        width="8"
        height="4"
        rx="1"
        ry="1"
      />
      <path d="M9 14h6" />
      <path d="M9 18h6" />
      <path d="M9 10h6" />
    </svg>
  ),
  '/admin/users': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle
        cx="9"
        cy="7"
        r="4"
      />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  '/assets': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line
        x1="12"
        y1="22.08"
        x2="12"
        y2="12"
      />
    </svg>
  ),
  '/admin/assets': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l3.58-3.58c.94-.94.94-2.48 0-3.42L9 5Z" />
      <path d="M6 9.01V9" />
      <path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19" />
    </svg>
  ),
  '/admin/categories': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line
        x1="12"
        y1="22.08"
        x2="12"
        y2="12"
      />
    </svg>
  ),
  '/admin/sites': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle
        cx="12"
        cy="10"
        r="3"
      />
    </svg>
  ),
  '/admin/manufacturers': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
      />
      <rect
        x="9"
        y="9"
        width="6"
        height="6"
        rx="1"
      />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  ),
  '/admin/vendors': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle
        cx="17"
        cy="18"
        r="2"
      />
      <circle
        cx="7"
        cy="18"
        r="2"
      />
    </svg>
  ),
  '/admin/api-keys': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="7.5"
        cy="15.5"
        r="5.5"
      />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  ),
  '/admin/webhooks': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 1 0 3.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" />
    </svg>
  ),
  '/admin/import-export': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="m21 8-4-4-4 4" />
      <path d="M17 4v16" />
    </svg>
  ),
  '/settings': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  '/logout': (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line
        x1="21"
        y1="12"
        x2="9"
        y2="12"
      />
    </svg>
  ),
};

const linkBase =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-[var(--color-sidebar-text-hover)] no-underline';

const linkActive =
  'bg-sidebar-active text-sidebar-active-text font-medium shadow-[inset_3px_0_0_0_var(--color-primary)]';

export function Sidebar() {
  const { isAuthenticated } = useAuth();
  const { user } = useSession();
  const { t } = useLanguage();
  const location = useLocation();

  const { regularItems, adminSections, hasItems } = useMemo(() => {
    const grouped = getGroupedNavItems(isAuthenticated, t, user);
    const adminItemCount = grouped.admin.reduce((count, section) => count + section.items.length, 0);
    return {
      regularItems: grouped.regular,
      adminSections: grouped.admin,
      hasItems: grouped.regular.length + adminItemCount > 0,
    };
  }, [isAuthenticated, t, user]);

  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const isSmallScreen = useIsSmallScreen();

  useEffect(() => {
    setCollapsed(getInitialCollapsed());
    setCollapsedSections(getInitialSectionCollapsed());
  }, []);

  const isCollapsed = isSmallScreen || collapsed;

  useEffect(() => {
    if (isCollapsed) return;
    const sectionWithActiveRoute = adminSections.find((section) =>
      section.items.some((item) => isNavItemActive(location.pathname, item.to)),
    );
    if (!sectionWithActiveRoute) return;
    setCollapsedSections((prev) => {
      const needsAdminRoot = prev[ADMIN_ROOT_SECTION_ID] === true;
      const needsSubsection = prev[sectionWithActiveRoute.id] === true;
      if (!needsAdminRoot && !needsSubsection) return prev;
      const next = {
        ...prev,
        ...(needsAdminRoot ? { [ADMIN_ROOT_SECTION_ID]: false } : {}),
        ...(needsSubsection ? { [sectionWithActiveRoute.id]: false } : {}),
      };
      saveSectionCollapsed(next);
      return next;
    });
  }, [location.pathname, adminSections, isCollapsed]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      saveCollapsed(next);
      return next;
    });
  };

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      saveSectionCollapsed(next);
      return next;
    });
  };

  const isSectionCollapsed = (sectionId: string) => collapsedSections[sectionId] === true;

  const renderSectionToggle = (label: string, sectionId: string, paddingClass: string) => {
    const sectionCollapsed = isSectionCollapsed(sectionId);
    return (
      <button
        type="button"
        onClick={() => toggleSectionCollapsed(sectionId)}
        className={`sidebar-admin-label sidebar-section-toggle w-full flex items-center justify-between gap-2 ${paddingClass} text-[0.6875rem] uppercase tracking-wider rounded-lg hover:bg-sidebar-hover transition-colors cursor-pointer`}
        aria-expanded={!sectionCollapsed}
      >
        <span>{label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-200 ${sectionCollapsed ? '' : 'rotate-90'}`}
          aria-hidden
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  };

  const renderNavLink = (item: NavItem) => {
    const isActive = isNavItemActive(location.pathname, item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        className={`${linkBase} ${isActive ? `${linkActive} sidebar-link-active` : ''} ${isCollapsed ? 'justify-center px-2' : ''}`}
        title={isCollapsed ? item.label : undefined}
      >
        {navIcons[item.to] ?? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        )}
        {!isCollapsed && <span className="text-[0.9375rem] truncate">{item.label}</span>}
      </Link>
    );
  };

  if (!isAuthenticated || !hasItems || isPublicAppPath(location.pathname)) return null;

  return (
    <aside
      className={`sidebar flex flex-col border-r border-sidebar-border shrink-0 transition-[width] duration-200 ease-in-out ${
        isCollapsed ? 'w-[60px]' : 'w-68'
      }`}
    >
      <nav className="flex flex-col gap-1 p-2 flex-1 min-h-0 overflow-y-auto">
        {regularItems.map(renderNavLink)}
        {adminSections.length > 0 && (
          <>
            {isCollapsed ? (
              <div className="my-1 border-t border-sidebar-border" />
            ) : (
              renderSectionToggle(t('nav.adminSection'), ADMIN_ROOT_SECTION_ID, 'px-3 py-2')
            )}
            {(isCollapsed || !isSectionCollapsed(ADMIN_ROOT_SECTION_ID)) &&
              adminSections.map((section, sectionIndex) => {
                const sectionCollapsed = isSectionCollapsed(section.id);
                const showSectionItems = isCollapsed || !section.labelKey || !sectionCollapsed;

                return (
                  <Fragment key={section.id}>
                    {section.labelKey &&
                      (isCollapsed
                        ? sectionIndex > 0 && <div className="my-1 border-t border-sidebar-border" />
                        : renderSectionToggle(t(section.labelKey), section.id, 'px-3 pt-3 pb-1'))}
                    {showSectionItems && section.items.map(renderNavLink)}
                  </Fragment>
                );
              })}
          </>
        )}
        <div className="mt-auto pt-2 border-t border-sidebar-border">
          {renderNavLink({ label: t('nav.logout'), to: '/logout' })}
        </div>
      </nav>
      {!isSmallScreen && (
        <button
          onClick={toggleCollapsed}
          className="sidebar-collapse-btn mt-auto mx-2 mb-2 p-2 rounded-lg hover:bg-sidebar-hover transition-colors self-start"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
    </aside>
  );
}
