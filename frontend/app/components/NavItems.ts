import type { NavItem, User } from '~/types';
import type { TranslationKey } from '~/utils/translations';

type AdminSubsection = 'inventory' | 'organization' | 'platform';

interface NavConfig {
  labelKey: TranslationKey;
  to: string;
  authenticated: boolean | null; // null = always shown
  adminOnly?: boolean;
  adminSubsection?: AdminSubsection;
  hideForAdmin?: boolean; // hidden from admins (e.g. personal "My Assets" view)
}

export interface NavSection {
  /** Stable id for collapse state (e.g. inventory, organization). */
  id: string;
  labelKey?: TranslationKey;
  items: NavItem[];
}

const navConfig: NavConfig[] = [
  // Personal dashboard — visible to everyone (admins included). It reads the
  // caller's own data via the /api/me/* endpoints. Admins also get the global
  // analytics dashboard under the Admin section below.
  { labelKey: 'nav.dashboard', to: '/dashboard', authenticated: true, hideForAdmin: false },
  { labelKey: 'nav.assets', to: '/assets', authenticated: true, hideForAdmin: false },
  { labelKey: 'nav.settings', to: '/settings', authenticated: true, hideForAdmin: false },
  {
    labelKey: 'nav.overview',
    to: '/admin/overview',
    authenticated: true,
    adminOnly: true,
  },
  {
    labelKey: 'nav.adminReports',
    to: '/admin/reports',
    authenticated: true,
    adminOnly: true,
  },
  {
    labelKey: 'nav.adminAssets',
    to: '/admin/assets',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'inventory',
  },
  {
    labelKey: 'nav.adminCategories',
    to: '/admin/categories',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'inventory',
  },
  {
    labelKey: 'nav.adminSites',
    to: '/admin/sites',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'inventory',
  },
  {
    labelKey: 'nav.adminManufacturers',
    to: '/admin/manufacturers',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'inventory',
  },
  {
    labelKey: 'nav.adminVendors',
    to: '/admin/vendors',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'inventory',
  },
  {
    labelKey: 'nav.adminUsers',
    to: '/admin/users',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'organization',
  },
  {
    labelKey: 'nav.adminImportExport',
    to: '/admin/import-export',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'platform',
  },
  {
    labelKey: 'nav.adminApiKeys',
    to: '/admin/api-keys',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'platform',
  },
  {
    labelKey: 'nav.adminWebhooks',
    to: '/admin/webhooks',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'platform',
  },
  {
    labelKey: 'nav.adminAi',
    to: '/admin/ai',
    authenticated: true,
    adminOnly: true,
    adminSubsection: 'platform',
  },
];

const adminSubsectionLabelKeys: Record<AdminSubsection, TranslationKey> = {
  inventory: 'nav.adminSubsectionInventory',
  organization: 'nav.adminSubsectionOrganization',
  platform: 'nav.adminSubsectionPlatform',
};

export function getNavItems(
  isAuthenticated: boolean,
  t: (key: TranslationKey) => string,
  user: User | null,
): NavItem[] {
  const { regular, admin } = getGroupedNavItems(isAuthenticated, t, user);
  return [...regular, ...admin.flatMap((section) => section.items)];
}

export function getGroupedNavItems(
  isAuthenticated: boolean,
  t: (key: TranslationKey) => string,
  user: User | null,
): { regular: NavItem[]; admin: NavSection[] } {
  const isAdmin = user?.roleName === 'ADMIN';

  const regular: NavItem[] = [];
  const admin: NavSection[] = [];
  let currentSection: NavSection | null = null;

  for (const item of navConfig) {
    if (item.adminOnly && !isAdmin) continue;
    if (item.hideForAdmin && isAdmin) continue;
    if (item.authenticated !== null && item.authenticated !== isAuthenticated) continue;

    const navItem = { label: t(item.labelKey), to: item.to };
    if (item.adminOnly) {
      const labelKey = item.adminSubsection
        ? adminSubsectionLabelKeys[item.adminSubsection]
        : undefined;

      if (!currentSection || currentSection.labelKey !== labelKey) {
        const id = item.adminSubsection ?? 'general';
        currentSection = { id, labelKey, items: [] };
        admin.push(currentSection);
      }
      currentSection.items.push(navItem);
    } else {
      regular.push(navItem);
    }
  }

  return { regular, admin };
}
